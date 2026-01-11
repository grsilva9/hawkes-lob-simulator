import React, { useState } from 'react';
import MatrixInput from './MatrixInput';
import './RegimeDesignerModal.css';

const EVENT_LABELS = ['MB', 'MS', 'LB', 'LS', 'CB', 'CS'];

const EVENT_DESCRIPTIONS = {
  'MB': 'Market Buy',
  'MS': 'Market Sell',
  'LB': 'Limit Buy',
  'LS': 'Limit Sell',
  'CB': 'Cancel Buy',
  'CS': 'Cancel Sell'
};

const DEFAULT_MU = [2.0, 2.0, 1.0, 1.0, 1.5, 1.5];

const DEFAULT_ALPHA = [
  [0.6, 0.1, 0.1, 0.0, 0.2, 0.0],
  [0.1, 0.6, 0.0, 0.1, 0.0, 0.2],
  [0.1, 0.0, 0.4, 0.1, 0.1, 0.0],
  [0.0, 0.1, 0.1, 0.4, 0.0, 0.1],
  [0.2, 0.0, 0.1, 0.0, 0.5, 0.1],
  [0.0, 0.2, 0.0, 0.1, 0.1, 0.5]
];

const DEFAULT_BETA = [
  [1.5, 1.5, 1.5, 1.5, 1.5, 1.5],
  [1.5, 1.5, 1.5, 1.5, 1.5, 1.5],
  [1.5, 1.5, 1.5, 1.5, 1.5, 1.5],
  [1.5, 1.5, 1.5, 1.5, 1.5, 1.5],
  [1.5, 1.5, 1.5, 1.5, 1.5, 1.5],
  [1.5, 1.5, 1.5, 1.5, 1.5, 1.5]
];

const RegimeDesignerModal = ({ isOpen, onClose, onSave }) => {
  const [scenarioName, setScenarioName] = useState('');
  const [mu, setMu] = useState([...DEFAULT_MU]);
  const [alpha, setAlpha] = useState(DEFAULT_ALPHA.map(row => [...row]));
  const [beta, setBeta] = useState(DEFAULT_BETA.map(row => [...row]));
  const [alphaExpanded, setAlphaExpanded] = useState(true);
  const [betaExpanded, setBetaExpanded] = useState(true);

  const handleMuChange = (index, value) => {
    const newMu = [...mu];
    newMu[index] = value;
    setMu(newMu);
  };

  const handleAlphaChange = (i, j, value) => {
    const newAlpha = alpha.map(row => [...row]);
    newAlpha[i][j] = value;
    setAlpha(newAlpha);
  };

  const handleBetaChange = (i, j, value) => {
    const newBeta = beta.map(row => [...row]);
    newBeta[i][j] = value;
    setBeta(newBeta);
  };

  const handleSave = () => {
    if (!scenarioName.trim()) {
      alert('Please enter a scenario name');
      return;
    }

    const regime = {
      name: scenarioName,
      description: 'Custom regime',
      mu: mu,
      alpha: alpha,
      beta: beta
    };

    onSave(scenarioName, regime);
    handleReset();
    onClose();
  };

  const handleReset = () => {
    setScenarioName('');
    setMu([...DEFAULT_MU]);
    setAlpha(DEFAULT_ALPHA.map(row => [...row]));
    setBeta(DEFAULT_BETA.map(row => [...row]));
    setAlphaExpanded(true);
    setBetaExpanded(true);
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Design Custom Regime</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {/* Event Type Legend */}
          <div className="event-legend">
            <span className="legend-title">Event Types:</span>
            {EVENT_LABELS.map(label => (
              <span key={label} className="legend-item">
                <strong>{label}</strong> = {EVENT_DESCRIPTIONS[label]}
              </span>
            ))}
          </div>

          {/* Scenario Name */}
          <div className="form-group">
            <label className="form-label">Scenario Name</label>
            <input
              type="text"
              value={scenarioName}
              onChange={(e) => setScenarioName(e.target.value)}
              placeholder="e.g., High Volatility Market"
              className="form-input"
            />
          </div>

          {/* Mu Vector */}
          <div className="param-section param-mu">
            <h4 className="param-title">Base Intensities (μ)</h4>
            <p className="param-description">
              Baseline arrival rates for each event type
            </p>
            <div className="mu-grid-full">
              {EVENT_LABELS.map((label, i) => (
                <div key={i} className="mu-input-group-full">
                  <label className="mu-label-full">
                    {label}
                    <span className="mu-sublabel">{EVENT_DESCRIPTIONS[label]}</span>
                  </label>
                  <input
                    type="number"
                    value={mu[i]}
                    onChange={(e) => handleMuChange(i, parseFloat(e.target.value) || 0)}
                    step="0.1"
                    min="0"
                    className="mu-input-full"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Alpha Matrix */}
          <div className="param-section param-alpha">
            <div 
              className="param-header-collapsible"
              onClick={() => setAlphaExpanded(!alphaExpanded)}
            >
              <h4 className="param-title">Excitation Matrix (α)</h4>
              <span className="collapse-icon">{alphaExpanded ? '▼' : '▶'}</span>
            </div>
            <p className="param-description">
              How much each event type excites others (α<sub>ij</sub>: event j → event i)
            </p>
            {alphaExpanded && (
              <MatrixInput
                data={alpha}
                onChange={handleAlphaChange}
                rowLabels={EVENT_LABELS}
                colLabels={EVENT_LABELS}
                highlightDiagonal={true}
                colorScheme="alpha"
              />
            )}
          </div>

          {/* Beta Matrix */}
          <div className="param-section param-beta">
            <div 
              className="param-header-collapsible"
              onClick={() => setBetaExpanded(!betaExpanded)}
            >
              <h4 className="param-title">Decay Rates (β)</h4>
              <span className="collapse-icon">{betaExpanded ? '▼' : '▶'}</span>
            </div>
            <p className="param-description">
              How fast excitation effects decay (higher = faster decay)
            </p>
            {betaExpanded && (
              <MatrixInput
                data={beta}
                onChange={handleBetaChange}
                rowLabels={EVENT_LABELS}
                colLabels={EVENT_LABELS}
                highlightDiagonal={true}
                colorScheme="beta"
              />
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleSave}>
            Save Regime
          </button>
        </div>
      </div>
    </div>
  );
};

export default RegimeDesignerModal;