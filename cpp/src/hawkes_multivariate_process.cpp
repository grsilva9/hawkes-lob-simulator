#include "hawkes_multivariate_process.h"

#include <cmath>
#include <numeric>
#include <stdexcept>
#include <algorithm>

HawkesMultivariateProcess::HawkesMultivariateProcess(
    const std::vector<double>& mu,
    const std::vector<std::vector<double>>& alpha,
    const std::vector<std::vector<double>>& beta,
    int qty_min,
    int qty_max,
    unsigned seed
)
    : dim_(mu.size()),
      mu_(mu),
      alpha_(alpha),
      beta_(beta),
      s_(dim_, 0.0),
      lambda_(dim_, 0.0),
      w_(dim_, 1.0),
      last_time_(0.0),
      rng_(seed),
      uni01_(0.0, 1.0),
      qty_dist_(qty_min, qty_max)
{
    if (dim_ != 6)
        throw std::invalid_argument("Hawkes process must be 6-dimensional");

    if (alpha_.size() != dim_ || beta_.size() != dim_)
        throw std::invalid_argument("alpha/beta matrices must be 6x6");

    for (std::size_t i = 0; i < dim_; ++i) {
        if (alpha_[i].size() != dim_ || beta_[i].size() != dim_)
            throw std::invalid_argument("alpha/beta rows must have size 6");
    }

    for (std::size_t i = 0; i < dim_; ++i) {
        if (!std::isfinite(mu_[i]) || mu_[i] <= 0.0)
            throw std::invalid_argument("All baseline intensities mu must be finite and positive");
        lambda_[i] = mu_[i];
    }
}

void HawkesMultivariateProcess::set_weights(const std::vector<double>& w)
{
    if (w.size() != dim_)
        throw std::invalid_argument("weights vector must have size 6");

    w_ = w;

    // Enforce strict positivity for thinning stability
    for (auto& x : w_) {
        if (!std::isfinite(x) || x <= 0.0)
            x = 1.0;
    }
}

void HawkesMultivariateProcess::decay_to(double t)
{
    if (t <= last_time_) return;

    const double dt = t - last_time_;

    for (std::size_t i = 0; i < dim_; ++i) {
        const double b = beta_[i][i];  // Use only diagonal decay — standard & efficient
        s_[i] *= std::exp(-b * dt);
        lambda_[i] = mu_[i] + s_[i];
        if (lambda_[i] < 0.0) lambda_[i] = 0.0;  // numerical safety
    }

    last_time_ = t;
}

double HawkesMultivariateProcess::total_weighted_intensity() const
{
    double sum = 0.0;
    for (std::size_t i = 0; i < dim_; ++i) {
        if (lambda_[i] > 0.0) {
            sum += w_[i] * lambda_[i];
        }
    }
    return sum;
}

std::size_t HawkesMultivariateProcess::sample_dimension_weighted()
{
    const double total = total_weighted_intensity();

    if (!(total > 0.0)) {
        return 0;  // fallback — should rarely happen due to mu > 0
    }

    double u = uni01_(rng_) * total;
    double acc = 0.0;

    for (std::size_t i = 0; i < dim_; ++i) {
        if (lambda_[i] <= 0.0) continue;
        acc += w_[i] * lambda_[i];
        if (u <= acc) return i;
    }

    return dim_ - 1;  // final fallback
}

Event HawkesMultivariateProcess::next(double t)
{
    decay_to(t);
    double current_time = t;

    while (true) {
        const double lambda_bar = total_weighted_intensity();

        if (!(lambda_bar > 0.0)) {
            // Emergency fallback: reset weights to neutral and try again
            std::fill(w_.begin(), w_.end(), 1.0);
            continue;
        }

        // Propose candidate time
        const double u1 = uni01_(rng_);
        const double wait = -std::log(u1) / lambda_bar;
        const double cand_time = current_time + wait;

        // Decay state to candidate time
        decay_to(cand_time);

        const double lambda_cand = total_weighted_intensity();
        const double u2 = uni01_(rng_);

        // Thinning acceptance
        if (u2 <= lambda_cand / lambda_bar) {
            // Accept: sample which dimension triggered the event
            const std::size_t k = sample_dimension_weighted();

            // Apply excitation from this event to all dimensions
            for (std::size_t i = 0; i < dim_; ++i) {
                s_[i] += alpha_[i][k];
                lambda_[i] = mu_[i] + s_[i];
                if (lambda_[i] < 0.0) lambda_[i] = 0.0;
            }

            Event e{};
            e.t = cand_time;
            e.quantity = qty_dist_(rng_);
            e.price = 0.0;  // Will be set by simulator for Add/Cancel

            // CORRECT EVENT MAPPING (preserved)
            // 0: Bid Add
            // 1: Ask Add
            // 2: Bid Cancel
            // 3: Ask Cancel
            // 4: Market Buy  (aggressor is buyer → consumes asks)
            // 5: Market Sell (aggressor is seller → consumes bids)
            switch (k) {
                case 0: e.type = EventType::Add;     e.side = Side::Bid;  break;
                case 1: e.type = EventType::Add;     e.side = Side::Ask; break;
                case 2: e.type = EventType::Cancel;  e.side = Side::Bid;  break;
                case 3: e.type = EventType::Cancel;  e.side = Side::Ask; break;
                case 4: e.type = EventType::Market;  e.side = Side::Bid;  break;  // Buy
                case 5: e.type = EventType::Market;  e.side = Side::Ask; break;  // Sell
            }

            return e;
        }

        // Rejection: advance time but no excitation
        current_time = cand_time;
    }
}