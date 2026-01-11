import React, { useState, useEffect } from 'react';
import { getAvailableStrategies, getDefaultRegimes } from '../services/api';
import './ConfigureTab.css';

const ConfigureTab = ({ onRunBacktest, isLoading, apiConnected }) => {
  const [regimePreset, setRegimePreset] = useState('single_calm');
  const [availableStrategies, setAvailableStrategies] = useState([]);
  const [selectedStrategies, setSelectedStrategies] = useState({
    sma: true,
    momentum: true,
  });
  const [strategyParams, setStrategyParams] = useState({
    sma: {
      window: 50,
      entry_threshold: 0.0003,
      exit_threshold: 0.00015,
    },
    momentum: {
      lookback: 30,
      entry_threshold: 0.0002,
      exit_threshold: 0.0001,
    },
  });
  const [transactionCost, setTransactionCost] = useState(0.0001);

  useEffect(() => {
    loadStrategies();
  }, []);

  const loadStrategies = async () => {
    try {
      const response = await getAvailableStrategies();
      setAvailableStrategies(response.strategies || []);
    } catch (err) {
      console.error('Failed to load strategies:', err);
    }
  };

  const handleStrategyToggle = (stratName) => {
    setSelectedStrategies(prev => ({
      ...prev,
      [stratName]: !prev[stratName]
    }));
  };

  const handleParamChange = (stratName, paramName, value) => {
    setStrategyParams(prev => ({
      ...prev,
      [stratName]: {
        ...prev[stratName],
        [paramName]: parseFloat(value)
      }
    }));
  };

  const handleRunBacktest = async () => {
    const presets = await getDefaultRegimes();
    const regimes = presets[regimePreset];

    const strategies = {};
    Object.keys(selectedStrategies).forEach(stratName => {
      if (selectedStrategies[stratName] && strategyParams[stratName]) {
        strategies[stratName] = strategyParams[stratName];
      }
    });

    onRunBacktest(regimes, strategies);
  };

  const getSelectedCount = () => {
    return Object.values(selectedStrategies).filter(Boolean).length;
  };

  return (
    <div className="configure-tab">
      <div className="tab-header">
        <h2>Configure Your Backtest</h2>
        <p>Set up market regimes and select trading strategies to analyze</p>
      </div>

      {/* Market Regimes Section */}
      <section className="config-section">
        <div className="section-header">
          <h3>Market Regimes</h3>
          <p className="section-description">
            Choose the market conditions for your simulation
          </p>
        </div>

        <div className="regime-cards">
          <div 
            className={`regime-card ${regimePreset === 'single_calm' ? 'active' : ''}`}
            onClick={() => setRegimePreset('single_calm')}
          >
            <div className="regime-icon">📊</div>
            <h4>Single Calm Market</h4>
            <p>Stable market with moderate volatility</p>
            <div className="regime-meta">
              <span className="meta-badge">500 events</span>
            </div>
          </div>

          <div 
            className={`regime-card ${regimePreset === 'calm_to_volatile' ? 'active' : ''}`}
            onClick={() => setRegimePreset('calm_to_volatile')}
          >
            <div className="regime-icon">⚡</div>
            <h4>Calm → Volatile Transition</h4>
            <p>Market shifting from calm to high volatility</p>
            <div className="regime-meta">
              <span className="meta-badge">1000 events</span>
              <span className="meta-badge">2 regimes</span>
            </div>
          </div>
        </div>
      </section>

      {/* Trading Strategies Section */}
      <section className="config-section">
        <div className="section-header">
          <h3>Trading Strategies</h3>
          <p className="section-description">
            Select strategies to backtest ({getSelectedCount()} selected)
          </p>
        </div>

        <div className="strategies-grid">
          {availableStrategies.map(stratName => (
            <div 
              key={stratName}
              className={`strategy-card ${selectedStrategies[stratName] ? 'selected' : ''}`}
            >
              <div className="strategy-header">
                <label className="checkbox-wrapper">
                  <input
                    type="checkbox"
                    checked={selectedStrategies[stratName] || false}
                    onChange={() => handleStrategyToggle(stratName)}
                  />
                  <span className="checkbox-custom"></span>
                  <span className="strategy-name">{stratName.toUpperCase()}</span>
                </label>
              </div>

              {selectedStrategies[stratName] && strategyParams[stratName] && (
                <div className="strategy-params">
                  {Object.keys(strategyParams[stratName]).map(paramName => (
                    <div key={paramName} className="param-group">
                      <label className="param-label">
                        {paramName.replace(/_/g, ' ')}
                      </label>
                      <input
                        type="number"
                        step="0.0001"
                        className="param-input"
                        value={strategyParams[stratName][paramName]}
                        onChange={(e) => handleParamChange(stratName, paramName, e.target.value)}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Settings Section */}
      <section className="config-section">
        <div className="section-header">
          <h3>Simulation Settings</h3>
        </div>

        <div className="settings-row">
          <div className="param-group">
            <label className="param-label">Transaction Cost</label>
            <input
              type="number"
              step="0.0001"
              className="param-input"
              value={transactionCost}
              onChange={(e) => setTransactionCost(parseFloat(e.target.value))}
            />
            <small className="param-hint">Cost per trade (as decimal)</small>
          </div>
        </div>
      </section>

      {/* Run Button */}
      <div className="action-bar">
        <button
          className="btn btn-primary btn-large"
          onClick={handleRunBacktest}
          disabled={isLoading || !apiConnected || getSelectedCount() === 0}
        >
          {isLoading ? (
            <>
              <span className="spinner-small"></span>
              Running Backtest...
            </>
          ) : (
            <>
              <span>🚀</span>
              Run Backtest
            </>
          )}
        </button>

        {!apiConnected && (
          <p className="warning-text">⚠️ API not connected. Start Flask server.</p>
        )}
        {getSelectedCount() === 0 && apiConnected && (
          <p className="warning-text">⚠️ Select at least one strategy.</p>
        )}
      </div>
    </div>
  );
};

export default ConfigureTab;