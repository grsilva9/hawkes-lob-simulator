import React, { useState } from 'react';
import StrategyBuilder from './StrategyBuilder';
import BacktestResults from './BacktestResults';
import './BacktestTab.css';

const BacktestTab = ({ backtestResults, setBacktestResults, marketData, setMarketData, onClear }) => {
  const [isBuilderVisible, setIsBuilderVisible] = useState(true);
  const [isSimulating, setIsSimulating] = useState(false);

  const handleRunBacktest = async (regimes, strategies, settings) => {
    setIsSimulating(true);
    
    try {
      const response = await fetch('http://localhost:5000/api/backtest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          regimes: regimes,
          strategies: strategies,
          transaction_cost: settings.transactionCost || 0.0001
        })
      });

      const data = await response.json();

      if (data.success) {
        setBacktestResults(data.results);
        setMarketData(data.market_data);
      } else {
        alert(`Backtest failed: ${data.error}`);
      }
    } catch (error) {
      console.error('Backtest error:', error);
      alert(`Error running backtest: ${error.message}`);
    } finally {
      setIsSimulating(false);
    }
  };

  const handleToggleBuilder = () => {
    setIsBuilderVisible(!isBuilderVisible);
  };

  return (
    <div className="backtest-tab">
      <div className={`backtest-layout ${isBuilderVisible ? 'builder-visible' : 'builder-hidden'}`}>
        {/* Strategy Builder Panel */}
        {isBuilderVisible && (
          <div className="backtest-builder-panel">
            <StrategyBuilder
              onRunBacktest={handleRunBacktest}
              isSimulating={isSimulating}
              onTogglePanel={handleToggleBuilder}
              onClear={backtestResults ? onClear : null}
            />
          </div>
        )}

        {/* Results Panel */}
        <div className="backtest-results-panel">
          {!isBuilderVisible && (
            <button 
              className="show-builder-btn"
              onClick={handleToggleBuilder}
              title="Show strategy builder"
            >
              →
            </button>
          )}
          
          <BacktestResults
            results={backtestResults}
            marketData={marketData}
            isSimulating={isSimulating}
          />
        </div>
      </div>
    </div>
  );
};

export default BacktestTab;