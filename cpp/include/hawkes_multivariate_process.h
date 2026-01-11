#pragma once

#include "process.h"
#include "event.h"

#include <vector>
#include <random>

class HawkesMultivariateProcess : public EventProcess {
public:
    HawkesMultivariateProcess(
        const std::vector<double>& mu,                     // size = 6
        const std::vector<std::vector<double>>& alpha,     // 6 x 6
        const std::vector<std::vector<double>>& beta,      // 6 x 6
        int qty_min,
        int qty_max,
        unsigned seed = 42
    );

    // Hybrid hook: state-dependent multiplicative weights w_i(X(t))
    // Must be size 6, values > 0 recommended.
    void set_weights(const std::vector<double>& w);

    Event next(double t) override;

private:
    std::size_t dim_;

    std::vector<double> mu_;
    std::vector<std::vector<double>> alpha_;
    std::vector<std::vector<double>> beta_;

    std::vector<double> s_;
    std::vector<double> lambda_;
    std::vector<double> w_;       // <--- NEW: state weights

    double last_time_;

    std::mt19937 rng_;
    std::uniform_real_distribution<double> uni01_;
    std::uniform_int_distribution<int> qty_dist_;

    void decay_to(double t);

    double total_weighted_intensity() const;
    std::size_t sample_dimension_weighted();
};
