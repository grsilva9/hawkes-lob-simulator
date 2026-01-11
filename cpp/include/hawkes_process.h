#pragma once

#include "process.h"
#include <vector>
#include <random>

//Implements a mulvariate Hawkes process.
class HawkesProcess : public EventProcess {
public:
    HawkesProcess(
        std::size_t num_event_types,
        const std::vector<double>& baseline,
        const std::vector<std::vector<double>>& alpha,
        const std::vector<std::vector<double>>& beta,
        unsigned seed = 42
    );

    Event next(double t) override;
private:
    // Random number generator
    std::mt19937 rng_;

    //Number of event dimensions.
    std::size_t dim_;

    //Baseline intensities µ_i
    std::vector<double> mu_;

    //Excitation matrix a_ij
    std::vector<std::vector<double>> alpha_;

    //Decay matrix beta_ij
    std::vector<std::vector<double>> beta_;

    // Current intensities lambda_i(t)
    std::vector<double> lambda_;

    //Last event time
    double last_time_;

    //History of event times by type
    std::vector<std::vector<double>> history_;
};