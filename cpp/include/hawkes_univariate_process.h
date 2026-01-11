#pragma once

#include "process.h"
#include <random>

// Univariate Hawkes process with exponential kernel.
// Intensity: lambda(t) = mu + alpha * sum_{ti < t} exp(-beta * (t - ti))
//
// We simulate event times using Ogata's thinning method, exploiting the fact that
// for exponential kernel (alpha > 0), intensity decays between events, so the current
// intensity is an upper bound until the next jump.
//
// This class generates full LOB Events by:
//  - Hawkes for event times
//  - simple distributions for side/type/qty/price (like PoissonProcess)
class HawkesUnivariateProcess : public EventProcess {
public:
    HawkesUnivariateProcess(
        double mu,             // baseline intensity (>0)
        double alpha,          // excitation strength (>=0)
        double beta,           // decay rate (>0)
        double price_center,
        double tick_size,
        int qty_min,
        int qty_max,
        unsigned seed = 42
    );

    Event next(double t) override;

    // Optional: expose intensity at current internal state (useful for debugging)
    double intensity() const;

private:
    // Hawkes params
    double mu_;
    double alpha_;
    double beta_;

    // Hawkes state (for efficient exponential-kernel updates)
    double last_time_;  // last time we updated the state
    double s_;          // s(t) = sum exp(-beta*(t-ti)) at last_time_

    // RNG and helper dists
    std::mt19937 rng_;
    std::uniform_real_distribution<double> uni01_;
    std::uniform_int_distribution<int> qty_dist_;
    std::bernoulli_distribution side_dist_;
    std::bernoulli_distribution type_dist_;

    double price_center_;
    double tick_size_;

private:
    // Updates the internal state s_ from last_time_ to new_time assuming no event in-between
    void decay_to(double new_time);
};
