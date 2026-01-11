import React, { useState, useEffect } from 'react';
import './StrategyBuilder.css';
import StrategyDesignerModal from './StrategyDesignerModal';

const StrategyBuilder = ({ onRunBacktest, isSimulating, onTogglePanel, onClear }) => {
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // State
  const [regimes, setRegimes] = useState([]);
  const [selectedRegime, setSelectedRegime] = useState('calm_market');
  const [seedMode, setSeedMode] = useState('random'); // 'random' or 'fixed'
  
  const [strategies, setStrategies] = useState([]);
  const [selectedStrategy, setSelectedStrategy] = useState('sma');
  
  const [templates, setTemplates] = useState([]);
  const [transactionCost, setTransactionCost] = useState(0.0001);
  
  // Custom strategies saved by user
  const [customStrategies, setCustomStrategies] = useState(() => {
    const saved = localStorage.getItem('customStrategies');
    return saved ? JSON.parse(saved) : {};
  });
  
  // NEW: Load saved regimes from localStorage
  const [savedRegimes, setSavedRegimes] = useState(() => {
    const saved = localStorage.getItem('customScenarios');
    return saved ? JSON.parse(saved) : {};
  });

  // Preset regimes
  const PRESET_REGIMES = {
    'calm_market': {
      name: 'Calm Market',
      mu: [2.0, 2.0, 1.0, 1.0, 1.5, 1.5],
      alpha: [[0.6, 0.1, 0.1, 0.0, 0.2, 0.0],
              [0.1, 0.6, 0.0, 0.1, 0.0, 0.2],
              [0.1, 0.0, 0.4, 0.1, 0.1, 0.0],
              [0.0, 0.1, 0.1, 0.4, 0.0, 0.1],
              [0.2, 0.0, 0.1, 0.0, 0.5, 0.1],
              [0.0, 0.2, 0.0, 0.1, 0.1, 0.5]],
      beta: [[1.5, 1.5, 1.5, 1.5, 1.5, 1.5],
             [1.5, 1.5, 1.5, 1.5, 1.5, 1.5],
             [1.5, 1.5, 1.5, 1.5, 1.5, 1.5],
             [1.5, 1.5, 1.5, 1.5, 1.5, 1.5],
             [1.5, 1.5, 1.5, 1.5, 1.5, 1.5],
             [1.5, 1.5, 1.5, 1.5, 1.5, 1.5]]
    },
    'volatile_market': {
      name: 'Volatile Market',
      mu: [3.5, 3.5, 1.8, 1.8, 2.5, 2.5],
      alpha: [[0.7, 0.15, 0.15, 0.05, 0.25, 0.05],
              [0.15, 0.7, 0.05, 0.15, 0.05, 0.25],
              [0.15, 0.05, 0.5, 0.15, 0.15, 0.05],
              [0.05, 0.15, 0.15, 0.5, 0.05, 0.15],
              [0.25, 0.05, 0.15, 0.05, 0.6, 0.15],
              [0.05, 0.25, 0.05, 0.15, 0.15, 0.6]],
      beta: [[2.0, 2.0, 2.0, 2.0, 2.0, 2.0],
             [2.0, 2.0, 2.0, 2.0, 2.0, 2.0],
             [2.0, 2.0, 2.0, 2.0, 2.0, 2.0],
             [2.0, 2.0, 2.0, 2.0, 2.0, 2.0],
             [2.0, 2.0, 2.0, 2.0, 2.0, 2.0],
             [2.0, 2.0, 2.0, 2.0, 2.0, 2.0]]
    }
  };

  // Combine presets and custom regimes
  const allRegimeOptions = {
    ...PRESET_REGIMES,
    ...savedRegimes
  };

  // Load templates on mount and listen for regime changes
  useEffect(() => {
    loadTemplates();
    
    // Listen for changes to saved regimes
    const handleStorageChange = () => {
      const saved = localStorage.getItem('customScenarios');
      setSavedRegimes(saved ? JSON.parse(saved) : {});
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    // Also check periodically (in case storage event doesn't fire)
    const interval = setInterval(() => {
      const saved = localStorage.getItem('customScenarios');
      const current = JSON.stringify(savedRegimes);
      const updated = saved || '{}';
      if (current !== updated) {
        setSavedRegimes(JSON.parse(updated));
      }
    }, 1000);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, [savedRegimes]);

  const loadTemplates = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/strategy_templates?summary=true');
      const data = await response.json();
      if (data.success) {
        setTemplates(data.templates);
      }
    } catch (error) {
      console.error('Failed to load templates:', error);
    }
  };

  // Handle saving custom strategy from modal
  const handleSaveCustomStrategy = (name, strategy) => {
    const key = name.toLowerCase().replace(/\s+/g, '_');
    const updated = {
      ...customStrategies,
      [key]: strategy
    };
    setCustomStrategies(updated);
    localStorage.setItem('customStrategies', JSON.stringify(updated));
  };

  const handleDeleteCustomStrategy = (key) => {
    const updated = { ...customStrategies };
    delete updated[key];
    setCustomStrategies(updated);
    localStorage.setItem('customStrategies', JSON.stringify(updated));
  };

  // Add regime to queue
  const handleAddRegime = () => {
    const regimeConfig = allRegimeOptions[selectedRegime];
    
    if (!regimeConfig) {
      alert('Regime not found');
      return;
    }

    const newRegime = {
      id: Date.now(),
      name: regimeConfig.name,
      num_events: 500,
      seed: Math.floor(Math.random() * 10000),
      mu: regimeConfig.mu,
      alpha: regimeConfig.alpha,
      beta: regimeConfig.beta
    };
    
    setRegimes([...regimes, newRegime]);
  };

  const handleRemoveRegime = (id) => {
    setRegimes(regimes.filter(r => r.id !== id));
  };

  // Add strategy to queue
  const handleAddStrategy = () => {
    let params = {};
    let type = selectedStrategy;
    let name = '';

    if (selectedStrategy === 'sma') {
      name = 'SMA Mean Reversion';
      params = { window: 50, entry_threshold: 0.0003, exit_threshold: 0.00015 };
    } else if (selectedStrategy === 'momentum') {
      name = 'Momentum';
      params = { lookback: 30, entry_threshold: 0.0002, exit_threshold: 0.0001 };
    } else if (selectedStrategy === 'trend_following') {
      name = 'Trend Following';
      params = { short_window: 20, long_window: 50 };
    } else if (selectedStrategy.startsWith('custom_')) {
      // User-created custom strategy
      const customKey = selectedStrategy.replace('custom_', '');
      const customStrategy = customStrategies[customKey];
      if (customStrategy) {
        const newStrategy = {
          id: Date.now(),
          name: customStrategy.name,
          type: 'custom',
          params: customStrategy
        };
        setStrategies([...strategies, newStrategy]);
        return;
      }
    } else if (selectedStrategy.startsWith('template_')) {
      // Template strategy
      const templateId = selectedStrategy.replace('template_', '');
      const template = templates.find(t => t.id === templateId);
      if (template) {
        type = 'custom';
        name = template.name;
        // Need to fetch full template
        fetchAndAddTemplate(templateId);
        return;
      }
    }

    const newStrategy = {
      id: Date.now(),
      name: name,
      type: type,
      params: params
    };

    setStrategies([...strategies, newStrategy]);
  };

  const fetchAndAddTemplate = async (templateId) => {
    try {
      const response = await fetch(`http://localhost:5000/api/strategy_templates/${templateId}`);
      const data = await response.json();
      
      if (data.success) {
        const template = data.template;
        const newStrategy = {
          id: Date.now(),
          name: template.name,
          type: 'custom',
          params: template
        };
        setStrategies([...strategies, newStrategy]);
      }
    } catch (error) {
      console.error('Failed to fetch template:', error);
      alert('Failed to load template');
    }
  };

  const handleRemoveStrategy = (id) => {
    setStrategies(strategies.filter(s => s.id !== id));
  };

  // Run backtest
  const handleRunBacktest = () => {
    if (regimes.length === 0) {
      alert('Please add at least one market regime');
      return;
    }

    if (strategies.length === 0) {
      alert('Please add at least one strategy');
      return;
    }

    // Convert regimes to API format
    const apiRegimes = regimes.map(r => ({
      num_events: r.num_events,
      seed: seedMode === 'random' ? Math.floor(Math.random() * 10000) : r.seed,
      mu: r.mu,
      alpha: r.alpha,
      beta: r.beta
    }));

    // Convert strategies to API format
    const apiStrategies = strategies.map(s => ({
      name: s.name,
      type: s.type,
      params: s.params
    }));

    onRunBacktest(apiRegimes, apiStrategies, {
      transactionCost: transactionCost
    });
  };

  const totalEvents = regimes.reduce((sum, r) => sum + r.num_events, 0);

  return (
    <div className="strategy-builder-content">
      {/* Header */}
      <div className="builder-header">
        <h3 className="builder-title">Backtest Setup</h3>
        <div className="builder-header-actions">
          {onClear && (
            <button 
              className="header-action-btn"
              onClick={onClear}
              title="Clear results"
            >
              🗑
            </button>
          )}
          <button 
            className="header-action-btn"
            onClick={onTogglePanel}
            title="Hide panel"
          >
            ←
          </button>
        </div>
      </div>

      {/* SECTION 1: Market Regime - UPDATED */}
      <div className="section-card section-card-compact">
        <div className="section-header-compact">
          <span className="section-number">1</span>
          <span className="section-title">Market Regime</span>
        </div>

        <div className="section-body section-body-compact">
          <div className="select-row">
            <select
              value={selectedRegime}
              onChange={(e) => setSelectedRegime(e.target.value)}
              className="input-field input-field-compact select-flex"
            >
              <optgroup label="Presets">
                {Object.keys(PRESET_REGIMES).map(key => (
                  <option key={key} value={key}>
                    {PRESET_REGIMES[key].name}
                  </option>
                ))}
              </optgroup>
              {Object.keys(savedRegimes).length > 0 && (
                <optgroup label="Custom">
                  {Object.keys(savedRegimes).map(key => (
                    <option key={key} value={key}>
                      {savedRegimes[key].name}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
            <button
              className="btn btn-secondary btn-compact"
              onClick={handleAddRegime}
            >
              + Add
            </button>
          </div>

          {regimes.length > 0 && (
            <div className="queue-section-compact">
              {regimes.map((regime, idx) => (
                <div key={regime.id} className="queue-item-compact">
                  <span className="queue-number-compact">{idx + 1}</span>
                  <span className="queue-name-compact">{regime.name}</span>
                  <input
                    type="number"
                    value={regime.num_events}
                    onChange={(e) => {
                      const updated = regimes.map(r =>
                        r.id === regime.id ? { ...r, num_events: parseInt(e.target.value) || 100 } : r
                      );
                      setRegimes(updated);
                    }}
                    className="input-field input-field-compact queue-input"
                    min="10"
                    max="10000"
                  />
                  <button
                    className="queue-remove-compact"
                    onClick={() => handleRemoveRegime(regime.id)}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {regimes.length > 0 && (
            <div className="sim-control-row" style={{marginTop: '0.5rem'}}>
              <label className="sim-label">Seed</label>
              <select
                value={seedMode}
                onChange={(e) => setSeedMode(e.target.value)}
                className="input-field input-field-compact"
              >
                <option value="random">Random</option>
                <option value="fixed">Fixed</option>
              </select>
            </div>
          )}

          {seedMode === 'fixed' && regimes.length > 0 && (
            <div className="seed-inputs-compact">
              {regimes.map((regime, idx) => (
                <div key={regime.id} className="seed-row-compact">
                  <span className="seed-label-compact">#{idx + 1}</span>
                  <input
                    type="number"
                    value={regime.seed}
                    onChange={(e) => {
                      const updated = regimes.map(r =>
                        r.id === regime.id ? { ...r, seed: parseInt(e.target.value) || 0 } : r
                      );
                      setRegimes(updated);
                    }}
                    className="input-field input-field-compact seed-input"
                    min="0"
                    max="99999"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* SECTION 2: Design Custom Strategy */}
      <div className="section-card section-card-compact">
        <button 
          className="section-toggle"
          onClick={() => setIsModalOpen(true)}
        >
          <span className="section-number">2</span>
          <span className="section-title">Design Custom</span>
          <span className="section-toggle-icon">+</span>
        </button>

        {/* Show saved custom strategies */}
        {Object.keys(customStrategies).length > 0 && (
          <div className="section-body section-body-compact">
            <div className="saved-custom-list-compact">
              {Object.entries(customStrategies).map(([key, strategy]) => (
                <div key={key} className="saved-custom-item-compact">
                  <span className="saved-custom-name-compact">{strategy.name}</span>
                  <button
                    className="saved-delete-btn-compact"
                    onClick={() => handleDeleteCustomStrategy(key)}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* SECTION 3: Strategies */}
      <div className="section-card section-card-compact">
        <div className="section-header-compact">
          <span className="section-number">3</span>
          <span className="section-title">Strategies</span>
        </div>

        <div className="section-body section-body-compact">
          <div className="select-row">
            <select
              value={selectedStrategy}
              onChange={(e) => setSelectedStrategy(e.target.value)}
              className="input-field input-field-compact select-flex"
            >
              <optgroup label="Built-in">
                <option value="sma">SMA Mean Reversion</option>
                <option value="momentum">Momentum</option>
                <option value="trend_following">Trend Following</option>
              </optgroup>
              {Object.keys(customStrategies).length > 0 && (
                <optgroup label="Custom">
                  {Object.entries(customStrategies).map(([key, strategy]) => (
                    <option key={key} value={`custom_${key}`}>
                      {strategy.name}
                    </option>
                  ))}
                </optgroup>
              )}
              {templates.length > 0 && (
                <optgroup label="Templates">
                  {templates.map(t => (
                    <option key={t.id} value={`template_${t.id}`}>
                      {t.name}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
            <button
              className="btn btn-secondary btn-compact"
              onClick={handleAddStrategy}
            >
              + Add
            </button>
          </div>

          {strategies.length > 0 && (
            <div className="queue-section-compact">
              {strategies.map((strategy, idx) => (
                <div key={strategy.id} className="queue-item-compact">
                  <span className="queue-number-compact">{idx + 1}</span>
                  <span className="queue-name-compact">{strategy.name}</span>
                  <button
                    className="queue-remove-compact"
                    onClick={() => handleRemoveStrategy(strategy.id)}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* SECTION 4: Run Backtest */}
      <div className="section-card section-card-compact">
        <div className="section-header-compact">
          <span className="section-number">4</span>
          <span className="section-title">Run Backtest</span>
        </div>

        <div className="section-body section-body-compact">
          <div className="sim-control-row">
            <label className="sim-label">TX Cost</label>
            <input
              type="number"
              value={transactionCost}
              onChange={(e) => setTransactionCost(parseFloat(e.target.value) || 0)}
              className="input-field input-field-compact"
              step="0.0001"
              min="0"
            />
          </div>

          {regimes.length > 0 && strategies.length > 0 && (
            <div className="sim-summary-compact">
              <span>{regimes.length} regime(s)</span>
              <span>·</span>
              <span>{strategies.length} strateg{strategies.length > 1 ? 'ies' : 'y'}</span>
              <span>·</span>
              <span>{totalEvents.toLocaleString()} events</span>
            </div>
          )}

          <button
            className="btn btn-primary btn-block btn-compact"
            onClick={handleRunBacktest}
            disabled={isSimulating || regimes.length === 0 || strategies.length === 0}
          >
            {isSimulating ? '⏳ Running...' : '▶ Run Backtest'}
          </button>
        </div>
      </div>

      {/* Strategy Designer Modal */}
      <StrategyDesignerModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveCustomStrategy}
        templates={templates}
      />
    </div>
  );
};

export default StrategyBuilder;