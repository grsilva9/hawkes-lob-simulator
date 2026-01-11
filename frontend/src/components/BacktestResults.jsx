import React from 'react';
import BacktestCharts from './BacktestCharts';
import './BacktestResults.css';

const BacktestResults = ({ results, marketData, isSimulating }) => {
  if (isSimulating) {
    return (
      <div className="backtest-results-empty">
        <div className="loading-spinner"></div>
        <p>Running backtest...</p>
      </div>
    );
  }

  if (!results) {
    return (
      <div className="backtest-results-empty">
        <div className="empty-icon">📊</div>
        <h3>No Results Yet</h3>
        <p>Configure your market regime and strategies, then run a backtest to see results.</p>
      </div>
    );
  }

  // Get strategy names
  const strategyNames = Object.keys(results);
  
  // Check if advanced metrics are available
  const hasAdvancedMetrics = Object.values(results)[0]?.metrics?.sortino_ratio !== undefined;

  // Helper to format numbers safely
  const fmt = (val, decimals = 2) => {
    if (val === null || val === undefined || isNaN(val)) return '—';
    return val.toFixed(decimals);
  };

  return (
    <div className="backtest-results-content">
      <div className="results-header">
        <h2>Backtest Results</h2>
        <p>{strategyNames.length} strateg{strategyNames.length > 1 ? 'ies' : 'y'} tested</p>
      </div>

      {/* 2x2 Grid: 3 Charts + 1 Performance Table */}
      <div className="backtest-charts-grid">
        {/* Charts from BacktestCharts component */}
        <BacktestCharts results={results} marketData={marketData} />

        {/* Performance Metrics Table - All metrics in one scrollable table */}
        <div className="chart-section chart-large">
          <div className="chart-header">
            <h3>Performance Metrics</h3>
          </div>
          <div className="performance-table-wrapper">
            <table className="performance-table-compact">
              <thead>
                <tr>
                  <th className="sticky-col">Strategy</th>
                  <th>Ret%</th>
                  <th>Sharpe</th>
                  <th>Sortino</th>
                  <th>DD%</th>
                  <th>Calmar</th>
                  <th>Trades</th>
                  <th>Win%</th>
                  <th>PF</th>
                  <th>Avg W</th>
                  <th>Avg L</th>
                </tr>
              </thead>
              <tbody>
                {strategyNames.map(name => {
                  const strat = results[name];
                  if (strat.error) {
                    return (
                      <tr key={name}>
                        <td className="sticky-col strategy-name-compact">{name}</td>
                        <td colSpan="10" className="error-cell">Error</td>
                      </tr>
                    );
                  }

                  const m = strat.metrics;
                  const retClass = m.total_return_pct >= 0 ? 'positive' : 'negative';

                  return (
                    <tr key={name}>
                      <td className="sticky-col strategy-name-compact" title={name}>{name}</td>
                      <td className={retClass}>{fmt(m.total_return_pct)}</td>
                      <td>{fmt(m.sharpe_ratio)}</td>
                      <td>{fmt(m.sortino_ratio)}</td>
                      <td className="negative">{fmt(m.max_drawdown)}</td>
                      <td>{fmt(m.calmar_ratio)}</td>
                      <td>{m.num_trades}</td>
                      <td>{fmt(m.win_rate, 0)}</td>
                      <td>{fmt(m.profit_factor)}</td>
                      <td className="positive">{fmt(m.avg_win, 3)}</td>
                      <td className="negative">{fmt(m.avg_loss, 3)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BacktestResults;