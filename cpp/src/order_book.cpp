#include "order_book.h"

#include <cmath>
#include <limits>
#include <algorithm>

/*
Core principles:
- All incoming prices (Add/Cancel) are rounded to the tick grid
- Marketable limit orders immediately execute against the opposite side
- Pure market orders also consume opposite side
- Price only changes when a best level is fully depleted
*/

OrderBook::OrderBook(double tick_size)
    : tick_size_(tick_size)
{
    if (!(tick_size_ > 0.0) || !std::isfinite(tick_size_)) {
        tick_size_ = 0.1;  // sane fallback
    }
}

double OrderBook::round_to_tick(double price) const
{
    return std::round(price / tick_size_) * tick_size_;
}

void OrderBook::add_level(std::map<double, int>& side_map, double price, int qty)
{
    if (qty <= 0) return;
    side_map[price] += qty;
}

void OrderBook::remove_level_qty(std::map<double, int>& side_map, double price, int qty)
{
    if (qty <= 0) return;
    auto it = side_map.find(price);
    if (it == side_map.end()) return;
    it->second -= qty;
    if (it->second <= 0) {
        side_map.erase(it);
    }
}

void OrderBook::consume_best_ask(std::map<double, int>& asks, int qty)
{
    while (qty > 0 && !asks.empty()) {
        auto it = asks.begin();  // lowest ask = best ask
        int available = it->second;
        if (available > qty) {
            it->second -= qty;
            qty = 0;
        } else {
            qty -= available;
            asks.erase(it);
        }
    }
}

void OrderBook::consume_best_bid(std::map<double, int>& bids, int qty)
{
    while (qty > 0 && !bids.empty()) {
        auto it = std::prev(bids.end());  // highest bid = best bid
        int available = it->second;
        if (available > qty) {
            it->second -= qty;
            qty = 0;
        } else {
            qty -= available;
            bids.erase(it);
        }
    }
}

bool OrderBook::apply(const Event& e)
{
    if (!std::isfinite(e.t) || e.quantity <= 0) return false;

    // Get current top-of-book for marketable checks
    const TopOfBook tob = top();
    const double best_bid = tob.best_bid_price ? *tob.best_bid_price
                                              : std::numeric_limits<double>::quiet_NaN();
    const double best_ask = tob.best_ask_price ? *tob.best_ask_price
                                              : std::numeric_limits<double>::quiet_NaN();

    switch (e.type) {
        case EventType::Add: {
            if (!std::isfinite(e.price) || e.price <= 0.0) return false;

            const double px = round_to_tick(e.price);

            if (e.side == Side::Bid) {
                // Marketable limit buy: price >= best ask → execute immediately
                if (!std::isnan(best_ask) && px >= best_ask) {
                    consume_best_ask(asks_, e.quantity);
                    return true;
                }
                // Passive: add to bids
                add_level(bids_, px, e.quantity);
                return true;
            } else {  // Ask side
                // Marketable limit sell: price <= best bid → execute immediately
                if (!std::isnan(best_bid) && px <= best_bid) {
                    consume_best_bid(bids_, e.quantity);
                    return true;
                }
                // Passive: add to asks
                add_level(asks_, px, e.quantity);
                return true;
            }
        }

        case EventType::Cancel: {
            if (!std::isfinite(e.price) || e.price <= 0.0) return false;
            const double px = round_to_tick(e.price);

            if (e.side == Side::Bid) {
                remove_level_qty(bids_, px, e.quantity);
            } else {
                remove_level_qty(asks_, px, e.quantity);
            }
            return true;
        }

        case EventType::Market: {
            if (e.side == Side::Bid) {           // Market Buy → consume asks
                consume_best_ask(asks_, e.quantity);
            } else {                             // Market Sell → consume bids
                consume_best_bid(bids_, e.quantity);
            }
            return true;
        }

        default:
            return false;
    }
}

TopOfBook OrderBook::top() const
{
    TopOfBook tob{};

    if (!bids_.empty()) {
        auto it = std::prev(bids_.end());
        tob.best_bid_price = it->first;
        tob.best_bid_qty   = it->second;
    }

    if (!asks_.empty()) {
        auto it = asks_.begin();
        tob.best_ask_price = it->first;
        tob.best_ask_qty   = it->second;
    }

    return tob;
}

Metrics OrderBook::metrics() const
{
    Metrics m{};
    const auto tob = top();

    if (tob.best_bid_price && tob.best_ask_price) {
        const double bid = *tob.best_bid_price;
        const double ask = *tob.best_ask_price;

        m.mid    = 0.5 * (bid + ask);
        m.spread = ask - bid;

        const double qb = tob.best_bid_qty ? static_cast<double>(*tob.best_bid_qty) : 0.0;
        const double qa = tob.best_ask_qty ? static_cast<double>(*tob.best_ask_qty) : 0.0;

        const double denom = qb + qa;
        if (denom > 0.0) {
            m.imbalance_top1 = (qb - qa) / denom;
        }
    }

    return m;
}