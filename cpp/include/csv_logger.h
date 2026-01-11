#pragma once

#include "event.h"
#include "order_book.h"

#include <fstream>
#include <string>
#include <optional>

class CsvLogger {
public:
    explicit CsvLogger(const std::string& path);

    bool is_open() const;
    void write_header();
    void log(double t, const Event& e, const TopOfBook& tob, const Metrics& m);

private:
    std::ofstream out_;

    static std::string opt_num(const std::optional<double>& x);
    static std::string opt_int(const std::optional<int>& x);
};
