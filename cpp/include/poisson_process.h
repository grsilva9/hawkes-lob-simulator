#pragma once

#include "process.h"
#include <random>

class PoissonProcess : public EventProcess {
public:
    PoissonProcess(
        double lambda,
        double price_center,
        double tick_size,
        int qty_min,
        int qty_max,
        unsigned seed = 42
    );

    Event next(double t) override;

private:
    std::mt19937 rng_;
    std::exponential_distribution<double> inter_arrival_;
    std::uniform_int_distribution<int> qty_dist_;
    std::bernoulli_distribution side_dist_;
    std::bernoulli_distribution type_dist_;

    double price_center_;
    double tick_size_;

};