#include "csv_logger.h"

#include <iomanip>

CsvLogger::CsvLogger(const std::string& path)
    : out_(path)
{
    out_ << std::setprecision(10);
}

bool CsvLogger::is_open() const
{
    return out_.is_open();
}

void CsvLogger::write_header()
{
    out_ << "t,evt,side,qty,price,"
            "best_bid,best_bid_qty,best_ask,best_ask_qty,"
            "mid,spread,imbalance_top1\n";
}

void CsvLogger::log(double t,
                    const Event& e,
                    const TopOfBook& tob,
                    const Metrics& m)
{
    out_ << t << ","
         << static_cast<int>(e.type) << ","
         << static_cast<int>(e.side) << ","
         << e.quantity << ","
         << e.price << ","
         << opt_num(tob.best_bid_price) << ","
         << opt_int(tob.best_bid_qty) << ","
         << opt_num(tob.best_ask_price) << ","
         << opt_int(tob.best_ask_qty) << ","
         << opt_num(m.mid) << ","
         << opt_num(m.spread) << ","
         << opt_num(m.imbalance_top1)
         << "\n";
}

std::string CsvLogger::opt_num(const std::optional<double>& x)
{
    return x ? std::to_string(*x) : "";
}

std::string CsvLogger::opt_int(const std::optional<int>& x)
{
    return x ? std::to_string(*x) : "";
}
