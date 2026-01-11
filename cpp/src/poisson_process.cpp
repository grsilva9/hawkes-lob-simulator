#include "poisson_process.h"

PoissonProcess::PoissonProcess(
    double lambda,
    double price_center,
    double tick_size,
    int qty_min,
    int qty_max,
    unsigned seed

)
  : rng_(seed),
    inter_arrival_(lambda),
    qty_dist_(qty_min, qty_max),
    side_dist_(0.5),
    type_dist_(0.8),
    price_center_(price_center),
    tick_size_(tick_size)
{
}

Event PoissonProcess::next(double t)
{
    Event e{};

    // 1) Advance time
    e.t = t + inter_arrival_(rng_);

    // 2) Choose side (bid/ask)
    e.side = side_dist_(rng_) ? Side::Bid : Side::Ask;

    // 3) Choose event type (Add / Cancel)
    e.type = type_dist_(rng_) ? EventType::Add : EventType::Cancel;

    // 4) Quantity
    e.quantity = qty_dist_(rng_);

    // 5) Price 
    int tick_offset = 1 + (qty_dist_(rng_) % 5);

    if (e.side == Side::Bid){
        e.price = price_center_ - tick_offset * tick_size_;
    } else {
        e.price = price_center_ + tick_offset * tick_size_;
    }
    return e;
}
