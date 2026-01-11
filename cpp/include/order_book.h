#pragma once

#include "event.h"
#include <map>
#include <optional>
#include <cstddef>
#include <limits>  // for NaN

struct TopOfBook {
    std::optional<double> best_bid_price;
    std::optional<int>    best_bid_qty;
    std::optional<double> best_ask_price;
    std::optional<int>    best_ask_qty;
};

struct Metrics {
    std::optional<double> mid;
    std::optional<double> spread;
    std::optional<double> imbalance_top1;
};

class OrderBook {
public:
    // tick_size is required so we can round prices consistently
    explicit OrderBook(double tick_size = 0.1);

    bool apply(const Event& e);

    TopOfBook top() const;
    Metrics metrics() const;

    std::size_t bid_levels() const { return bids_.size(); }
    std::size_t ask_levels() const { return asks_.size(); }

    double tick_size() const { return tick_size_; }

private:
    double tick_size_;
    std::map<double, int> bids_;
    std::map<double, int> asks_;

    double round_to_tick(double price) const;

    void add_level(std::map<double, int>& side_map, double price, int qty);
    void remove_level_qty(std::map<double, int>& side_map, double price, int qty);

    void consume_best_ask(std::map<double, int>& asks, int qty);
    void consume_best_bid(std::map<double, int>& bids, int qty);
};