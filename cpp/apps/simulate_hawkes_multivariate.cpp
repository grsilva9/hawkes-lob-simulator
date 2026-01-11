#include "order_book.h"
#include "hawkes_multivariate_process.h"
#include "csv_logger.h"

#include <iostream>
#include <vector>
#include <random>
#include <algorithm>
#include <cmath>

// ------------------------------------------------------------
// STATE-DEPENDENT HAWKES WEIGHTS
// ------------------------------------------------------------
static std::vector<double> compute_weights(const OrderBook& book)
{
    // 0 Bid Add, 1 Ask Add, 2 Bid Cancel, 3 Ask Cancel, 4 Mkt Buy, 5 Mkt Sell
    std::vector<double> w(6, 1.0);

    const TopOfBook tob = book.top();
    if (!tob.best_bid_price || !tob.best_ask_price) {
        return w; // neutral if book incomplete
    }

    const double bid = *tob.best_bid_price;
    const double ask = *tob.best_ask_price;
    const double tick = book.tick_size();
    const double spread = ask - bid;
    const double spread_ticks = (tick > 0.0) ? (spread / tick) : 1.0;

    const double qb = tob.best_bid_qty ? static_cast<double>(*tob.best_bid_qty) : 0.0;
    const double qa = tob.best_ask_qty ? static_cast<double>(*tob.best_ask_qty) : 0.0;
    const double denom = qb + qa;
    const double imbalance = (denom > 0.0) ? (qb - qa) / denom : 0.0;

    // Wide spread → more liquidity provision
    const double wide  = 1.0 + 0.8 * spread_ticks;
    // Tight spread → more aggressive taking
    const double tight = 1.0 + 2.5 / (1.0 + spread_ticks);

    w[0] = wide;  // Bid Add
    w[1] = wide;  // Ask Add
    w[2] = 1.0 + 0.01 * qb;  // Bid Cancel
    w[3] = 1.0 + 0.01 * qa;  // Ask Cancel
    w[4] = tight * (1.0 + 1.5 * std::max(0.0, imbalance));   // Market Buy
    w[5] = tight * (1.0 + 1.5 * std::max(0.0, -imbalance));  // Market Sell

    for (double& x : w) {
        if (!std::isfinite(x) || x < 0.05) x = 0.05;
        if (x > 50.0) x = 50.0;
    }
    return w;
}

// ------------------------------------------------------------
// MAIN
// ------------------------------------------------------------
int main()
{
    const double price_center = 100.0;
    const double tick = 0.1;

    OrderBook book(tick);

    // CSV logger (write into build folder or current working directory)
    CsvLogger logger("lob_events.csv");
    if (!logger.is_open()) {
        std::cerr << "ERROR: could not open lob_events.csv for writing\n";
        return 1;
    }
    logger.write_header();

    // ---------------- Hawkes parameters ----------------
    std::vector<double> mu = {1.5, 1.5, 0.8, 0.8, 1.0, 1.0};

    std::vector<std::vector<double>> alpha = {
        {0.6, 0.1, 0.1, 0.0, 0.2, 0.0},
        {0.1, 0.6, 0.0, 0.1, 0.0, 0.2},
        {0.1, 0.0, 0.4, 0.1, 0.1, 0.0},
        {0.0, 0.1, 0.1, 0.4, 0.0, 0.1},
        {0.2, 0.0, 0.1, 0.0, 0.5, 0.1},
        {0.0, 0.2, 0.0, 0.1, 0.1, 0.5}
    };

    std::vector<std::vector<double>> beta(6, std::vector<double>(6, 1.5));

    HawkesMultivariateProcess process(
        mu, alpha, beta,
        /* qty_min */ 5,
        /* qty_max */ 50,
        /* seed */ 42
    );

    // RNG for placement logic (reproducible)
    std::mt19937 rng(42);
    std::uniform_int_distribution<int> place_dist(0, 99);
    std::uniform_int_distribution<int> depth_dist(1, 5);  // 1–5 ticks behind

    // ---------------- Seed deep book ----------------
    for (int k = 1; k <= 10; ++k) {
        book.apply({0.0, EventType::Add, Side::Bid, price_center - k * tick, 60});
        book.apply({0.0, EventType::Add, Side::Ask, price_center + k * tick, 60});
    }

    double t = 0.0;

    // ---------------- Simulation loop ----------------
    for (int n = 0; n < 800; ++n) {
        process.set_weights(compute_weights(book));

        Event e = process.next(t);
        t = e.t;

        // Safety net: never let the book go empty
        TopOfBook tob = book.top();
        if (!tob.best_bid_price) {
            book.apply({t, EventType::Add, Side::Bid, price_center - tick, 50});
        }
        if (!tob.best_ask_price) {
            book.apply({t, EventType::Add, Side::Ask, price_center + tick, 50});
        }

        tob = book.top();
        const double best_bid = *tob.best_bid_price;
        const double best_ask = *tob.best_ask_price;
        const double spread_ticks = (best_ask - best_bid) / tick;

        // ---------------- Placement logic ----------------
        if (e.type == EventType::Add) {
            double improve_prob = (spread_ticks >= 3.0) ? 0.45 : 0.20;
            double join_prob    = 0.50;

            int roll = place_dist(rng);

            if (e.side == Side::Bid) {
                if (roll < static_cast<int>(improve_prob * 100) && (best_bid + tick < best_ask)) {
                    e.price = best_bid + tick;
                } else if (roll < static_cast<int>((improve_prob + join_prob) * 100)) {
                    e.price = best_bid;
                } else {
                    int depth = depth_dist(rng);
                    e.price = best_bid - depth * tick;
                }
            } else {  // Ask side
                if (roll < static_cast<int>(improve_prob * 100) && (best_ask - tick > best_bid)) {
                    e.price = best_ask - tick;
                } else if (roll < static_cast<int>((improve_prob + join_prob) * 100)) {
                    e.price = best_ask;
                } else {
                    int depth = depth_dist(rng);
                    e.price = best_ask + depth * tick;
                }
            }
        } else if (e.type == EventType::Cancel) {
            e.price = (e.side == Side::Bid) ? best_bid : best_ask;
        } else { // Market
            e.price = 0.0;
        }

        // Apply event
        book.apply(e);

        // Log AFTER apply
        const TopOfBook tob_after = book.top();
        const Metrics m = book.metrics();
        logger.log(t, e, tob_after, m);

        // Optional stdout for “live market”
        if (m.mid && m.spread) {
            double displayed_spread = (*m.spread < 1e-8) ? 0.0 : *m.spread;
            std::cout << "t=" << t
                      << " mid=" << *m.mid
                      << " spread=" << displayed_spread
                      << " evt=" << static_cast<int>(e.type)
                      << " side=" << static_cast<int>(e.side)
                      << " qty=" << e.quantity
                      << "\n";
        }
    }

    return 0;
}
