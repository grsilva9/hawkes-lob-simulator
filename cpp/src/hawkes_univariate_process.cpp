#include "hawkes_univariate_process.h"

#include <cmath>
#include <stdexcept>

HawkesUnivariateProcess::HawkesUnivariateProcess(
    double mu,
    double alpha,
    double beta,
    double price_center,
    double tick_size,
    int qty_min,
    int qty_max,
    unsigned seed
)
    : mu_(mu),
      alpha_(alpha),
      beta_(beta),
      last_time_(0.0),
      s_(0.0),
      rng_(seed),
      uni01_(0.0, 1.0),
      qty_dist_(qty_min, qty_max),
      side_dist_(0.5),
      type_dist_(0.8),
      price_center_(price_center),
      tick_size_(tick_size)
{
    if (!(mu_ > 0.0))  throw std::invalid_argument("mu must be > 0");
    if (alpha_ < 0.0)  throw std::invalid_argument("alpha must be >= 0");
    if (!(beta_ > 0.0)) throw std::invalid_argument("beta must be > 0");
}

void HawkesUnivariateProcess::decay_to(double new_time)
{
    if (new_time < last_time_) {
        // We expect monotone time in event simulation usage
        last_time_ = new_time;
        s_ = 0.0;
        return;
    }
    const double dt = new_time - last_time_;
    if (dt > 0.0) {
        s_ *= std::exp(-beta_ * dt);
        last_time_ = new_time;
    }
}

double HawkesUnivariateProcess::intensity() const
{
    // Intensity at the internal "last_time_" state
    return mu_ + alpha_ * s_;
}

Event HawkesUnivariateProcess::next(double t)
{
    // Ensure internal state is aligned to input time t
    decay_to(t);

    double current_time = t;

    // Ogata thinning loop
    while (true) {
        const double lambda_bar = intensity(); // upper bound until next event

        // Safety: lambda_bar should be positive
        if (!(lambda_bar > 0.0) || !std::isfinite(lambda_bar)) {
            // reset to baseline if something goes numerically wrong
            s_ = 0.0;
            last_time_ = current_time;
        }

        // Propose next candidate time from Exp(lambda_bar)
        const double u1 = uni01_(rng_);
        const double w = -std::log(u1) / lambda_bar;
        const double cand_time = current_time + w;

        // Compute intensity at candidate time (decayed since current_time)
        // Note: between events, s decays; no jump unless event accepted.
        const double dt = cand_time - last_time_;
        const double s_cand = s_ * std::exp(-beta_ * dt);
        const double lambda_cand = mu_ + alpha_ * s_cand;

        // Accept with probability lambda_cand / lambda_bar
        const double u2 = uni01_(rng_);
        if (u2 <= (lambda_cand / lambda_bar)) {
            // Accept event at cand_time:
            // First, decay state to cand_time, then add the jump contribution.
            decay_to(cand_time);
            s_ += 1.0; // event at cand_time contributes exp(0)=1 to s(t)

            // Now build a full Event (time from Hawkes; the rest simple like Poisson)
            Event e{};
            e.t = cand_time;

            e.side = side_dist_(rng_) ? Side::Bid : Side::Ask;
            e.type = type_dist_(rng_) ? EventType::Add : EventType::Cancel;
            e.quantity = qty_dist_(rng_);

            // Minimal price model (we can improve later)
            int tick_offset = 1 + (qty_dist_(rng_) % 5); // avoid 0 spread artifact
            if (e.side == Side::Bid) {
                e.price = price_center_ - tick_offset * tick_size_;
            } else {
                e.price = price_center_ + tick_offset * tick_size_;
            }

            return e;
        } else {
            // Reject: advance time to candidate, but no jump (no event)
            decay_to(cand_time);
            current_time = cand_time;
        }
    }
}
