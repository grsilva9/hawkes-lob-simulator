import React, { useState } from 'react';
import { REGIME_PRESETS, getPresetNames } from '../utils/regimePresets';
import RegimeDesignerModal from './RegimeDesignerModal';
import './RegimeBuilder.css';

const RegimeBuilder = ({ 
  onRunSimulation, 
  isSimulating, 
  onTogglePanel,
  onExportCSV,
  onClear
}) => {
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Section 1: Design (now uses modal)
  const [customScenarios, setCustomScenarios] = useState(() => {
    const saved = localStorage.getItem('customScenarios');
    return saved ? JSON.parse(saved) : {};
  });

  // Section 2: Selection
  const [selectedPreset, setSelectedPreset] = useState('calm_market');
  const [scenarioQueue, setScenarioQueue] = useState([]);
  const [seedMode, setSeedMode] = useState('random'); // 'random' or 'fixed'

  // Section 3: Global settings
  const [timeUnit, setTimeUnit] = useState('seconds');

  // Get all available scenarios (presets + custom)
  const allScenarios = {
    ...REGIME_PRESETS,
    ...customScenarios
  };

  // Handle saving custom regime from modal
  const handleSaveCustomRegime = (name, regime) => {
    const updated = {
      ...customScenarios,
      [name]: regime
    };

    setCustomScenarios(updated);
    localStorage.setItem('customScenarios', JSON.stringify(updated));
  };

  const handleDeleteCustom = (name) => {
    const updated = { ...customScenarios };
    delete updated[name];
    setCustomScenarios(updated);
    localStorage.setItem('customScenarios', JSON.stringify(updated));
  };

  // Section 2: Add to Queue
  const handleAddToQueue = () => {
    const scenario = allScenarios[selectedPreset];
    if (!scenario) return;

    const newItem = {
      id: Date.now(),
      preset: selectedPreset,
      name: scenario.name,
      events: 500,
      seed: Math.floor(Math.random() * 10000),
      mu: scenario.mu,
      alpha: scenario.alpha,
      beta: scenario.beta
    };

    setScenarioQueue([...scenarioQueue, newItem]);
  };

  const handleRemoveFromQueue = (id) => {
    setScenarioQueue(scenarioQueue.filter(s => s.id !== id));
  };

  const handleUpdateQueueItem = (id, field, value) => {
    setScenarioQueue(scenarioQueue.map(s => 
      s.id === id ? { ...s, [field]: value } : s
    ));
  };

  // Section 3: Simulate
  const handleSimulate = () => {
    if (scenarioQueue.length === 0) {
      alert('Add at least one scenario');
      return;
    }

    const regimeConfigs = scenarioQueue.map(s => ({
      num_events: s.events,
      seed: seedMode === 'random' ? Math.floor(Math.random() * 10000) : s.seed,
      time_unit: timeUnit,
      mu: s.mu,
      alpha: s.alpha,
      beta: s.beta
    }));

    onRunSimulation(regimeConfigs);
  };

  const totalEvents = scenarioQueue.reduce((sum, s) => sum + s.events, 0);

  return (
    <div className="regime-builder-content">
      {/* Header with Title and Action Buttons */}
      <div className="builder-header">
        <h3 className="builder-title">Market Scenario</h3>
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
          {onExportCSV && (
            <button 
              className="header-action-btn"
              onClick={onExportCSV}
              title="Export CSV"
            >
              📁
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

      {/* SECTION 1: DESIGN - Now Opens Modal */}
      <div className="section-card section-card-compact">
        <button 
          className="section-toggle"
          onClick={() => setIsModalOpen(true)}
        >
          <span className="section-number">1</span>
          <span className="section-title">Design Custom</span>
          <span className="section-toggle-icon">+</span>
        </button>

        {/* Show saved custom scenarios */}
        {Object.keys(customScenarios).length > 0 && (
          <div className="section-body section-body-compact">
            <div className="saved-custom-list-compact">
              {Object.entries(customScenarios).map(([key, scenario]) => (
                <div key={key} className="saved-custom-item-compact">
                  <span className="saved-custom-name-compact">{scenario.name}</span>
                  <button
                    className="saved-delete-btn-compact"
                    onClick={() => handleDeleteCustom(key)}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* SECTION 2: SELECT */}
      <div className="section-card section-card-compact">
        <div className="section-header-compact">
          <span className="section-number">2</span>
          <span className="section-title">Select & Queue</span>
        </div>

        <div className="section-body section-body-compact">
          <div className="select-row">
            <select
              value={selectedPreset}
              onChange={(e) => setSelectedPreset(e.target.value)}
              className="input-field input-field-compact select-flex"
            >
              <optgroup label="Presets">
                {getPresetNames().map(key => (
                  <option key={key} value={key}>
                    {REGIME_PRESETS[key].name}
                  </option>
                ))}
              </optgroup>
              {Object.keys(customScenarios).length > 0 && (
                <optgroup label="Custom">
                  {Object.keys(customScenarios).map(key => (
                    <option key={key} value={key}>
                      {customScenarios[key].name}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
            <button
              className="btn btn-secondary btn-compact"
              onClick={handleAddToQueue}
            >
              + Add
            </button>
          </div>

          {scenarioQueue.length > 0 && (
            <div className="queue-section-compact">
              {scenarioQueue.map((item, idx) => (
                <div key={item.id} className="queue-item-compact">
                  <span className="queue-number-compact">{idx + 1}</span>
                  <span className="queue-name-compact">{item.name}</span>
                  <input
                    type="number"
                    value={item.events}
                    onChange={(e) => handleUpdateQueueItem(item.id, 'events', parseInt(e.target.value) || 0)}
                    className="input-field input-field-compact queue-input"
                    placeholder="Events"
                    min="10"
                    max="10000"
                  />
                  <button
                    className="queue-remove-compact"
                    onClick={() => handleRemoveFromQueue(item.id)}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* SECTION 3: SIMULATE */}
      <div className="section-card section-card-compact">
        <div className="section-header-compact">
          <span className="section-number">3</span>
          <span className="section-title">Simulate</span>
        </div>

        <div className="section-body section-body-compact">
          <div className="sim-control-row">
            <label className="sim-label">Time Unit</label>
            <select
              value={timeUnit}
              onChange={(e) => setTimeUnit(e.target.value)}
              className="input-field input-field-compact"
            >
              <option value="microseconds">μs</option>
              <option value="milliseconds">ms</option>
              <option value="seconds">s</option>
              <option value="minutes">min</option>
              <option value="hours">h</option>
            </select>
          </div>

          <div className="sim-control-row">
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

          {seedMode === 'fixed' && scenarioQueue.length > 0 && (
            <div className="seed-inputs-compact">
              {scenarioQueue.map((item, idx) => (
                <div key={item.id} className="seed-row-compact">
                  <span className="seed-label-compact">#{idx + 1}</span>
                  <input
                    type="number"
                    value={item.seed}
                    onChange={(e) => handleUpdateQueueItem(item.id, 'seed', parseInt(e.target.value) || 0)}
                    className="input-field input-field-compact seed-input"
                    min="0"
                    max="99999"
                  />
                </div>
              ))}
            </div>
          )}

          {scenarioQueue.length > 0 && (
            <div className="sim-summary-compact">
              <span>{scenarioQueue.length} scenario{scenarioQueue.length > 1 ? 's' : ''}</span>
              <span>·</span>
              <span>{totalEvents.toLocaleString()} events</span>
            </div>
          )}

          <button
            className="btn btn-primary btn-block btn-compact"
            onClick={handleSimulate}
            disabled={isSimulating || scenarioQueue.length === 0}
          >
            {isSimulating ? '⏳ Running...' : '▶ Simulate'}
          </button>
        </div>
      </div>

      {/* Modal */}
      <RegimeDesignerModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveCustomRegime}
      />
    </div>
  );
};

export default RegimeBuilder;