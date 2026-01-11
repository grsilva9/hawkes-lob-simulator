#include <pybind11/pybind11.h>
#include <pybind11/stl.h>  // For automatic STL conversions
#include <pybind11/numpy.h>  // For numpy array support

#include <random>
#include "order_book.h"
#include "event.h"
#include "hawkes_multivariate_process.h"

namespace py = pybind11;

// Helper function to run a simulation and return results as Python dict
py::dict run_simulation(
    const std::vector<double>& mu,
    const std::vector<std::vector<double>>& alpha,
    const std::vector<std::vector<double>>& beta,
    int num_events,
    double price_center,
    double tick_size,
    int qty_min,
    int qty_max,
    unsigned seed
) {
    // Create order book
    OrderBook book(tick_size);
    
    // Seed initial book depth
    for (int k = 1; k <= 10; ++k) {
        book.apply({0.0, EventType::Add, Side::Bid, price_center - k * tick_size, 60});
        book.apply({0.0, EventType::Add, Side::Ask, price_center + k * tick_size, 60});
    }
    
    // Create Hawkes process
    HawkesMultivariateProcess process(mu, alpha, beta, qty_min, qty_max, seed);
    
    // Storage for results
    std::vector<double> times;
    std::vector<int> event_types;
    std::vector<int> sides;
    std::vector<int> quantities;
    std::vector<double> prices;
    std::vector<double> best_bids;
    std::vector<double> best_asks;
    std::vector<double> mids;
    std::vector<double> spreads;
    
    double t = 0.0;
    
    // Simple weight computation (we'll improve this)
    auto compute_weights = [&book]() {
        std::vector<double> w(6, 1.0);
        const TopOfBook tob = book.top();
        
        if (!tob.best_bid_price || !tob.best_ask_price) {
            return w;
        }
        
        const double spread = *tob.best_ask_price - *tob.best_bid_price;
        const double spread_ticks = spread / book.tick_size();
        
        const double wide = 1.0 + 0.8 * spread_ticks;
        const double tight = 1.0 + 2.5 / (1.0 + spread_ticks);
        
        w[0] = wide;   // Bid Add
        w[1] = wide;   // Ask Add
        w[4] = tight;  // Market Buy
        w[5] = tight;  // Market Sell
        
        return w;
    };
    
    // Simulation loop
    for (int n = 0; n < num_events; ++n) {
        process.set_weights(compute_weights());
        Event e = process.next(t);
        t = e.t;
        
        // Safety: keep book alive
        TopOfBook tob = book.top();
        if (!tob.best_bid_price) {
            book.apply({t, EventType::Add, Side::Bid, price_center - tick_size, 50});
        }
        if (!tob.best_ask_price) {
            book.apply({t, EventType::Add, Side::Ask, price_center + tick_size, 50});
        }
        
        tob = book.top();
        const double best_bid = *tob.best_bid_price;
        const double best_ask = *tob.best_ask_price;
        
        // RNG for placement (seeded for reproducibility per event)
        std::mt19937 place_rng(static_cast<unsigned>(t * 1000 + n));
        std::uniform_int_distribution<int> place_dist(0, 99);
        std::uniform_int_distribution<int> depth_dist(1, 5);

        const double spread_ticks = (best_ask - best_bid) / tick_size;

        // Realistic placement logic
        if (e.type == EventType::Add) {
            double improve_prob = (spread_ticks >= 3.0) ? 0.45 : 0.20;
            double join_prob = 0.50;
            
            int roll = place_dist(place_rng);
            
            if (e.side == Side::Bid) {
                // Try to improve the bid
                if (roll < static_cast<int>(improve_prob * 100) && (best_bid + tick_size < best_ask)) {
                    e.price = best_bid + tick_size;
                } 
                // Join the best bid
                else if (roll < static_cast<int>((improve_prob + join_prob) * 100)) {
                    e.price = best_bid;
                } 
                // Place behind the best bid
                else {
                    int depth = depth_dist(place_rng);
                    e.price = best_bid - depth * tick_size;
                }
            } else {  // Ask side
                // Try to improve the ask
                if (roll < static_cast<int>(improve_prob * 100) && (best_ask - tick_size > best_bid)) {
                    e.price = best_ask - tick_size;
                } 
                // Join the best ask
                else if (roll < static_cast<int>((improve_prob + join_prob) * 100)) {
                    e.price = best_ask;
                } 
                // Place behind the best ask
                else {
                    int depth = depth_dist(place_rng);
                    e.price = best_ask + depth * tick_size;
                }
            }
        } else if (e.type == EventType::Cancel) {
            e.price = (e.side == Side::Bid) ? best_bid : best_ask;
        }
        
        // Apply event
        book.apply(e);
        
        // Record results
        const TopOfBook tob_after = book.top();
        const Metrics m = book.metrics();
        
        times.push_back(t);
        event_types.push_back(static_cast<int>(e.type));
        sides.push_back(static_cast<int>(e.side));
        quantities.push_back(e.quantity);
        prices.push_back(e.price);
        
        if (tob_after.best_bid_price) best_bids.push_back(*tob_after.best_bid_price);
        else best_bids.push_back(std::nan(""));
        
        if (tob_after.best_ask_price) best_asks.push_back(*tob_after.best_ask_price);
        else best_asks.push_back(std::nan(""));
        
        if (m.mid) mids.push_back(*m.mid);
        else mids.push_back(std::nan(""));
        
        if (m.spread) spreads.push_back(*m.spread);
        else spreads.push_back(std::nan(""));
    }
    
    // Return as Python dict (will convert to pandas DataFrame in Python)
    py::dict results;
    results["t"] = times;
    results["evt"] = event_types;
    results["side"] = sides;
    results["qty"] = quantities;
    results["price"] = prices;
    results["best_bid"] = best_bids;
    results["best_ask"] = best_asks;
    results["mid"] = mids;
    results["spread"] = spreads;
    
    return results;
}

// New: Regime-switching simulation
py::dict run_regime_simulation(
    const std::vector<py::dict>& regimes,  // List of regime configurations
    double price_center,
    double tick_size,
    int qty_min,
    int qty_max
) {
    // Validate input
    if (regimes.empty()) {
        throw std::runtime_error("At least one regime must be specified");
    }
    
    // Create order book
    OrderBook book(tick_size);
    
    // Seed initial book depth
    for (int k = 1; k <= 10; ++k) {
        book.apply({0.0, EventType::Add, Side::Bid, price_center - k * tick_size, 60});
        book.apply({0.0, EventType::Add, Side::Ask, price_center + k * tick_size, 60});
    }
    
    // Storage for results
    std::vector<double> times;
    std::vector<int> event_types;
    std::vector<int> sides;
    std::vector<int> quantities;
    std::vector<double> prices;
    std::vector<double> best_bids;
    std::vector<double> best_asks;
    std::vector<double> mids;
    std::vector<double> spreads;
    std::vector<int> regime_ids;  // NEW: track which regime generated each event
    
    double t = 0.0;
    
    // Weight computation helper
    auto compute_weights = [&book, tick_size]() {
        std::vector<double> w(6, 1.0);
        const TopOfBook tob = book.top();
        
        if (!tob.best_bid_price || !tob.best_ask_price) {
            return w;
        }
        
        const double spread = *tob.best_ask_price - *tob.best_bid_price;
        const double spread_ticks = spread / tick_size;
        
        const double wide = 1.0 + 0.8 * spread_ticks;
        const double tight = 1.0 + 2.5 / (1.0 + spread_ticks);
        
        w[0] = wide;   w[1] = wide;
        w[4] = tight;  w[5] = tight;
        
        return w;
    };
    
    // Process each regime
    for (std::size_t regime_idx = 0; regime_idx < regimes.size(); ++regime_idx) {
        const py::dict& regime = regimes[regime_idx];
        
        // Extract regime parameters
        auto mu = regime["mu"].cast<std::vector<double>>();
        auto alpha = regime["alpha"].cast<std::vector<std::vector<double>>>();
        auto beta = regime["beta"].cast<std::vector<std::vector<double>>>();
        int num_events = regime["num_events"].cast<int>();
        unsigned seed = regime["seed"].cast<unsigned>();
        
        // Create Hawkes process for this regime
        HawkesMultivariateProcess process(mu, alpha, beta, qty_min, qty_max, seed);
        
        // Run this regime
        for (int n = 0; n < num_events; ++n) {
            process.set_weights(compute_weights());
            Event e = process.next(t);
            t = e.t;
            
            // Safety: keep book alive
            TopOfBook tob = book.top();
            if (!tob.best_bid_price) {
                book.apply({t, EventType::Add, Side::Bid, price_center - tick_size, 50});
            }
            if (!tob.best_ask_price) {
                book.apply({t, EventType::Add, Side::Ask, price_center + tick_size, 50});
            }
            
            tob = book.top();
            const double best_bid = *tob.best_bid_price;
            const double best_ask = *tob.best_ask_price;
            
            // Simple placement logic
            // Realistic placement logic with price discovery
            std::mt19937 place_rng(static_cast<unsigned>(t * 1000) + n);
            std::uniform_int_distribution<int> place_dist(0, 99);
            std::uniform_int_distribution<int> depth_dist(1, 5);

            const double spread_ticks = (best_ask - best_bid) / tick_size;

            if (e.type == EventType::Add) {
                double improve_prob = (spread_ticks >= 3.0) ? 0.45 : 0.20;
                double join_prob = 0.50;
                
                int roll = place_dist(place_rng);
                
                if (e.side == Side::Bid) {
                    // Try to improve the bid
                    if (roll < static_cast<int>(improve_prob * 100) && (best_bid + tick_size < best_ask)) {
                        e.price = best_bid + tick_size;
                    } 
                    // Join the best bid
                    else if (roll < static_cast<int>((improve_prob + join_prob) * 100)) {
                        e.price = best_bid;
                    } 
                    // Place behind the best bid
                    else {
                        int depth = depth_dist(place_rng);
                        e.price = best_bid - depth * tick_size;
                    }
                } else {  // Ask side
                    // Try to improve the ask
                    if (roll < static_cast<int>(improve_prob * 100) && (best_ask - tick_size > best_bid)) {
                        e.price = best_ask - tick_size;
                    } 
                    // Join the best ask
                    else if (roll < static_cast<int>((improve_prob + join_prob) * 100)) {
                        e.price = best_ask;
                    } 
                    // Place behind the best ask
                    else {
                        int depth = depth_dist(place_rng);
                        e.price = best_ask + depth * tick_size;
                    }
                }
            } else if (e.type == EventType::Cancel) {
                e.price = (e.side == Side::Bid) ? best_bid : best_ask;
            }
            
            // Apply event
            book.apply(e);
            
            // Record results
            const TopOfBook tob_after = book.top();
            const Metrics m = book.metrics();
            
            times.push_back(t);
            event_types.push_back(static_cast<int>(e.type));
            sides.push_back(static_cast<int>(e.side));
            quantities.push_back(e.quantity);
            prices.push_back(e.price);
            regime_ids.push_back(static_cast<int>(regime_idx));  // Track regime
            
            if (tob_after.best_bid_price) best_bids.push_back(*tob_after.best_bid_price);
            else best_bids.push_back(std::nan(""));
            
            if (tob_after.best_ask_price) best_asks.push_back(*tob_after.best_ask_price);
            else best_asks.push_back(std::nan(""));
            
            if (m.mid) mids.push_back(*m.mid);
            else mids.push_back(std::nan(""));
            
            if (m.spread) spreads.push_back(*m.spread);
            else spreads.push_back(std::nan(""));
        }
    }
    
    // Return results
    py::dict results;
    results["t"] = times;
    results["evt"] = event_types;
    results["side"] = sides;
    results["qty"] = quantities;
    results["price"] = prices;
    results["best_bid"] = best_bids;
    results["best_ask"] = best_asks;
    results["mid"] = mids;
    results["spread"] = spreads;
    results["regime"] = regime_ids;  // NEW field
    
    return results;
}


PYBIND11_MODULE(lob_core, m) {
    m.doc() = "LOB Simulation with Hawkes Process";
    
    // Original single-regime simulation
    m.def("run_simulation", &run_simulation,
          py::arg("mu"),
          py::arg("alpha"),
          py::arg("beta"),
          py::arg("num_events") = 1000,
          py::arg("price_center") = 100.0,
          py::arg("tick_size") = 0.1,
          py::arg("qty_min") = 5,
          py::arg("qty_max") = 50,
          py::arg("seed") = 42,
          "Run LOB simulation with Hawkes process");
    
    // NEW: Regime-switching simulation
    m.def("run_regime_simulation", &run_regime_simulation,
          py::arg("regimes"),
          py::arg("price_center") = 100.0,
          py::arg("tick_size") = 0.1,
          py::arg("qty_min") = 5,
          py::arg("qty_max") = 50,
          "Run LOB simulation with regime-switching Hawkes process");
}