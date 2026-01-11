#pragma once

#include <cstdint>

// Which side of the book the event originates from
enum class Side : std::uint8_t {
    Bid,
    Ask
};

// What kind of event it is
enum class EventType : std::uint8_t {
    Add,        // limit order add (passive liquidity)
    Cancel,     // cancel own-side liquidity
    Market      // aggressive order consuming opposite best
};

// A single order-book event
struct Event {
    double t = 0.0;          // event time
    EventType type{};        // Add / Cancel / Market
    Side side{};             // Bid or Ask (aggressor side for Market)
    double price = 0.0;      // price level (used for Add/Cancel)
    int quantity = 0;        // order size
};
