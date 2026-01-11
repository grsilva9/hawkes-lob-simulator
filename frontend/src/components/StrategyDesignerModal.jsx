import React, { useState, useEffect } from 'react';
import './StrategyDesignerModal.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';


// Available functions from the expression evaluator
const AVAILABLE_FUNCTIONS = [
  { name: 'SMA', syntax: 'SMA(var, window)', description: 'Simple Moving Average', example: 'SMA(mid, 50)' },
  { name: 'EMA', syntax: 'EMA(var, window)', description: 'Exponential Moving Average', example: 'EMA(mid, 12)' },
  { name: 'STD', syntax: 'STD(var, window)', description: 'Standard Deviation', example: 'STD(mid, 20)' },
  { name: 'MIN', syntax: 'MIN(var, window)', description: 'Minimum over window', example: 'MIN(mid, 50)' },
  { name: 'MAX', syntax: 'MAX(var, window)', description: 'Maximum over window', example: 'MAX(mid, 50)' },
  { name: 'MOMENTUM', syntax: 'MOMENTUM(var, window)', description: 'Price change %', example: 'MOMENTUM(mid, 10)' },
  { name: 'RSI', syntax: 'RSI(var, window)', description: 'Relative Strength (0-100)', example: 'RSI(mid, 14)' },
  { name: 'BBWIDTH', syntax: 'BBWIDTH(var, window)', description: 'Bollinger Band Width', example: 'BBWIDTH(mid, 20)' },
  { name: 'ABS', syntax: 'ABS(value)', description: 'Absolute value', example: 'ABS(mid - 100)' },
  { name: 'SQRT', syntax: 'SQRT(value)', description: 'Square root', example: 'SQRT(spread)' },
  { name: 'LOG', syntax: 'LOG(value)', description: 'Natural logarithm', example: 'LOG(mid)' },
  { name: 'EXP', syntax: 'EXP(value)', description: 'Exponential (e^x)', example: 'EXP(returns)' },
];

const AVAILABLE_VARIABLES = [
  { name: 'mid', description: 'Current mid price (average of bid/ask)' },
  { name: 'spread', description: 'Current bid-ask spread' },
  { name: 'best_bid', description: 'Best bid price' },
  { name: 'best_ask', description: 'Best ask price' },
  { name: 'volume', description: 'Recent trading volume' },
  { name: 'returns', description: 'Recent price returns' },
];

const OPERATORS = [
  { value: '>', label: '>', description: 'greater than' },
  { value: '<', label: '<', description: 'less than' },
  { value: '>=', label: '≥', description: 'greater or equal' },
  { value: '<=', label: '≤', description: 'less or equal' },
  { value: '==', label: '=', description: 'equal to' },
  { value: '!=', label: '≠', description: 'not equal to' },
];

const EXAMPLE_EXPRESSIONS = [
  { expression: 'mid / SMA(mid, 50)', description: 'Price relative to 50-period average (ratio ~1.0)' },
  { expression: 'EMA(mid, 12) / EMA(mid, 26)', description: 'Fast/Slow EMA ratio for crossover' },
  { expression: '(mid - SMA(mid, 20)) / STD(mid, 20)', description: 'Z-score: how many std devs from mean' },
  { expression: 'MOMENTUM(mid, 10)', description: '10-period momentum (% change)' },
  { expression: 'spread / SMA(spread, 20)', description: 'Spread relative to average (liquidity)' },
];

const StrategyDesignerModal = ({ isOpen, onClose, onSave, templates = [] }) => {
  // Strategy metadata
  const [strategyName, setStrategyName] = useState('');
  
  // Functions (indicators)
  const [functions, setFunctions] = useState([]);
  
  // Rules
  const [entryRules, setEntryRules] = useState([]);
  const [exitRules, setExitRules] = useState([]);
  
  // UI state
  const [activeTab, setActiveTab] = useState('functions');
  const [validationErrors, setValidationErrors] = useState({});
  const [validationSuccess, setValidationSuccess] = useState({});
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [showHelp, setShowHelp] = useState(true);

  // Load template
  const handleLoadTemplate = async () => {
    if (!selectedTemplate) return;
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/strategy_templates/${selectedTemplate}`);
      const data = await response.json();
      
      if (data.success) {
        const template = data.template;
        setStrategyName(template.name + ' (Copy)');
        setFunctions(template.functions.map((f, i) => ({ ...f, id: f.id || `func_${i}` })));
        setEntryRules(template.entry_rules.map((r, i) => ({
          ...r,
          id: `rule_${Date.now()}_${i}`,
          conditions: r.conditions.map((c, j) => ({ ...c, id: `cond_${Date.now()}_${j}` }))
        })));
        setExitRules((template.exit_rules || []).map((r, i) => ({
          ...r,
          id: `rule_${Date.now()}_exit_${i}`,
          conditions: r.conditions.map((c, j) => ({ ...c, id: `cond_${Date.now()}_exit_${j}` }))
        })));
        setActiveTab('functions');
        setShowHelp(false);
      }
    } catch (error) {
      console.error('Failed to load template:', error);
      alert('Failed to load template. Make sure the backend is running.');
    }
  };

  // Function management
  const addFunction = () => {
    const newFunc = {
      id: `func_${Date.now()}`,
      name: '',
      expression: '',
      description: ''
    };
    setFunctions([...functions, newFunc]);
  };

  const updateFunction = (id, field, value) => {
    setFunctions(functions.map(f => 
      f.id === id ? { ...f, [field]: value } : f
    ));
    
    // Clear validation when editing
    if (validationErrors[id]) {
      const newErrors = { ...validationErrors };
      delete newErrors[id];
      setValidationErrors(newErrors);
    }
    if (validationSuccess[id]) {
      const newSuccess = { ...validationSuccess };
      delete newSuccess[id];
      setValidationSuccess(newSuccess);
    }
  };

  const removeFunction = (id) => {
    setFunctions(functions.filter(f => f.id !== id));
    
    // Also remove any rules that reference this function
    setEntryRules(entryRules.map(rule => ({
      ...rule,
      conditions: rule.conditions.filter(c => c.function_id !== id)
    })).filter(rule => rule.conditions.length > 0));
    
    setExitRules(exitRules.map(rule => ({
      ...rule,
      conditions: rule.conditions.filter(c => c.function_id !== id)
    })).filter(rule => rule.conditions.length > 0));
  };

  const validateExpression = async (id, expression) => {
    if (!expression.trim()) {
      setValidationErrors({ ...validationErrors, [id]: 'Expression required' });
      return;
    }
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/validate_expression`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expression })
      });
      
      const data = await response.json();
      
      if (data.valid) {
        const newErrors = { ...validationErrors };
        delete newErrors[id];
        setValidationErrors(newErrors);
        setValidationSuccess({ ...validationSuccess, [id]: true });
      } else {
        setValidationErrors({ 
          ...validationErrors, 
          [id]: data.error || 'Invalid expression'
        });
        const newSuccess = { ...validationSuccess };
        delete newSuccess[id];
        setValidationSuccess(newSuccess);
      }
    } catch (error) {
      // If server not available, just accept it
      console.warn('Could not validate expression (server unavailable)');
      setValidationSuccess({ ...validationSuccess, [id]: true });
    }
  };

  const insertExample = (id, example) => {
    updateFunction(id, 'expression', example);
    validateExpression(id, example);
  };

  // Rule management
  const addRule = (type) => {
    const newRule = {
      id: `rule_${Date.now()}`,
      conditions: [{
        id: `cond_${Date.now()}`,
        function_id: functions[0]?.id || '',
        operator: '>',
        threshold: 1
      }],
      logic: 'AND',
      action: type === 'entry' ? 'BUY' : 'FLAT'
    };
    
    if (type === 'entry') {
      setEntryRules([...entryRules, newRule]);
    } else {
      setExitRules([...exitRules, newRule]);
    }
  };

  const updateRule = (type, ruleId, field, value) => {
    const rules = type === 'entry' ? entryRules : exitRules;
    const setRules = type === 'entry' ? setEntryRules : setExitRules;
    
    setRules(rules.map(rule => 
      rule.id === ruleId ? { ...rule, [field]: value } : rule
    ));
  };

  const removeRule = (type, ruleId) => {
    if (type === 'entry') {
      setEntryRules(entryRules.filter(r => r.id !== ruleId));
    } else {
      setExitRules(exitRules.filter(r => r.id !== ruleId));
    }
  };

  // Condition management
  const addCondition = (type, ruleId) => {
    const rules = type === 'entry' ? entryRules : exitRules;
    const setRules = type === 'entry' ? setEntryRules : setExitRules;
    
    setRules(rules.map(rule => {
      if (rule.id !== ruleId) return rule;
      return {
        ...rule,
        conditions: [...rule.conditions, {
          id: `cond_${Date.now()}`,
          function_id: functions[0]?.id || '',
          operator: '>',
          threshold: 1
        }]
      };
    }));
  };

  const updateCondition = (type, ruleId, conditionId, field, value) => {
    const rules = type === 'entry' ? entryRules : exitRules;
    const setRules = type === 'entry' ? setEntryRules : setExitRules;
    
    setRules(rules.map(rule => {
      if (rule.id !== ruleId) return rule;
      return {
        ...rule,
        conditions: rule.conditions.map(cond =>
          cond.id === conditionId ? { ...cond, [field]: value } : cond
        )
      };
    }));
  };

  const removeCondition = (type, ruleId, conditionId) => {
    const rules = type === 'entry' ? entryRules : exitRules;
    const setRules = type === 'entry' ? setEntryRules : setExitRules;
    
    setRules(rules.map(rule => {
      if (rule.id !== ruleId) return rule;
      return {
        ...rule,
        conditions: rule.conditions.filter(c => c.id !== conditionId)
      };
    }).filter(rule => rule.conditions.length > 0));
  };

  // Save strategy
  const handleSave = () => {
    if (!strategyName.trim()) {
      alert('Please enter a strategy name');
      return;
    }
    
    if (functions.length === 0) {
      alert('Please define at least one function/indicator');
      return;
    }
    
    if (entryRules.length === 0) {
      alert('Please define at least one entry rule');
      return;
    }

    // Check for validation errors
    if (Object.keys(validationErrors).length > 0) {
      alert('Please fix expression errors before saving');
      return;
    }

    const strategy = {
      name: strategyName,
      functions: functions.map(f => ({
        id: f.id,
        name: f.name || f.id,
        expression: f.expression,
        description: f.description
      })),
      entry_rules: entryRules.map(rule => ({
        conditions: rule.conditions.map(c => ({
          function_id: c.function_id,
          operator: c.operator,
          threshold: parseFloat(c.threshold) || 0
        })),
        logic: rule.logic,
        action: rule.action
      })),
      exit_rules: exitRules.map(rule => ({
        conditions: rule.conditions.map(c => ({
          function_id: c.function_id,
          operator: c.operator,
          threshold: parseFloat(c.threshold) || 0
        })),
        logic: rule.logic,
        action: rule.action
      }))
    };

    onSave(strategyName, strategy);
    handleReset();
    onClose();
  };

  const handleReset = () => {
    setStrategyName('');
    setFunctions([]);
    setEntryRules([]);
    setExitRules([]);
    setValidationErrors({});
    setValidationSuccess({});
    setSelectedTemplate('');
    setActiveTab('functions');
    setShowHelp(true);
  };

  // Get function name for display
  const getFunctionDisplayName = (funcId) => {
    const func = functions.find(f => f.id === funcId);
    return func?.name || funcId || 'Select...';
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="strategy-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Design Custom Strategy</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {/* Getting Started Guide */}
          {showHelp && (
            <div className="getting-started">
              <div className="getting-started-header">
                <h4>🚀 Getting Started</h4>
                <button className="dismiss-btn" onClick={() => setShowHelp(false)}>Dismiss</button>
              </div>
              <div className="getting-started-content">
                <div className="step">
                  <span className="step-num">1</span>
                  <div className="step-text">
                    <strong>Define Functions</strong> — Create indicators using math expressions (e.g., <code>mid / SMA(mid, 50)</code>)
                  </div>
                </div>
                <div className="step">
                  <span className="step-num">2</span>
                  <div className="step-text">
                    <strong>Set Entry Rules</strong> — When should the strategy BUY or SELL? (e.g., "BUY when ratio &lt; 0.998")
                  </div>
                </div>
                <div className="step">
                  <span className="step-num">3</span>
                  <div className="step-text">
                    <strong>Set Exit Rules</strong> — When should it close the position? (e.g., "FLAT when ratio near 1.0")
                  </div>
                </div>
              </div>
              <div className="getting-started-tip">
                <strong>💡 Tip:</strong> Load a template below to see a working example, then customize it!
              </div>
            </div>
          )}

          {/* Template Loader */}
          <div className="template-section">
            <label className="template-label">Start from a template (recommended for beginners):</label>
            <div className="template-loader">
              <select 
                value={selectedTemplate}
                onChange={(e) => setSelectedTemplate(e.target.value)}
                className="template-select"
              >
                <option value="">— Select a template to load —</option>
                {templates.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.category}) — {t.difficulty}
                  </option>
                ))}
              </select>
              <button 
                className="btn btn-template"
                onClick={handleLoadTemplate}
                disabled={!selectedTemplate}
              >
                Load &amp; Edit
              </button>
            </div>
            {selectedTemplate && templates.find(t => t.id === selectedTemplate) && (
              <div className="template-description">
                {templates.find(t => t.id === selectedTemplate)?.description}
              </div>
            )}
          </div>

          {/* Strategy Name */}
          <div className="form-group">
            <label className="form-label">Strategy Name *</label>
            <input
              type="text"
              value={strategyName}
              onChange={(e) => setStrategyName(e.target.value)}
              placeholder="e.g., My Mean Reversion Strategy"
              className="form-input"
            />
          </div>

          {/* Tabs */}
          <div className="strategy-tabs">
            <button 
              className={`tab-btn ${activeTab === 'functions' ? 'active' : ''}`}
              onClick={() => setActiveTab('functions')}
            >
              <span className="tab-number">1</span>
              Functions
              {functions.length > 0 && <span className="tab-badge">{functions.length}</span>}
              {functions.length === 0 && <span className="tab-required">required</span>}
            </button>
            <button 
              className={`tab-btn ${activeTab === 'entry' ? 'active' : ''}`}
              onClick={() => setActiveTab('entry')}
              disabled={functions.length === 0}
            >
              <span className="tab-number">2</span>
              Entry Rules
              {entryRules.length > 0 && <span className="tab-badge">{entryRules.length}</span>}
              {entryRules.length === 0 && functions.length > 0 && <span className="tab-required">required</span>}
            </button>
            <button 
              className={`tab-btn ${activeTab === 'exit' ? 'active' : ''}`}
              onClick={() => setActiveTab('exit')}
              disabled={functions.length === 0}
            >
              <span className="tab-number">3</span>
              Exit Rules
              {exitRules.length > 0 && <span className="tab-badge">{exitRules.length}</span>}
              {exitRules.length === 0 && functions.length > 0 && <span className="tab-optional">optional</span>}
            </button>
          </div>

          {/* Tab Content */}
          <div className="tab-content">
            {/* Functions Tab */}
            {activeTab === 'functions' && (
              <div className="functions-tab">
                <div className="tab-explanation">
                  <h4>What are Functions?</h4>
                  <p>
                    Functions are <strong>custom indicators</strong> calculated from market data. 
                    You define them using mathematical expressions, then use them in your trading rules.
                  </p>
                  <div className="example-box">
                    <strong>Example:</strong> To create a mean reversion indicator, define: 
                    <code>mid / SMA(mid, 50)</code>
                    <br />
                    This gives you a ratio around 1.0 — below 1 means price is under the average, above 1 means over.
                  </div>
                </div>
                
                {functions.map((func, index) => (
                  <div key={func.id} className={`function-card ${validationSuccess[func.id] ? 'valid' : ''} ${validationErrors[func.id] ? 'invalid' : ''}`}>
                    <div className="function-header">
                      <span className="function-index">{index + 1}</span>
                      <input
                        type="text"
                        value={func.name}
                        onChange={(e) => updateFunction(func.id, 'name', e.target.value)}
                        placeholder="Give it a name (e.g., sma_ratio)"
                        className="function-name-input"
                      />
                      <button 
                        className="remove-btn"
                        onClick={() => removeFunction(func.id)}
                        title="Remove function"
                      >
                        ×
                      </button>
                    </div>
                    
                    <div className="function-body">
                      <div className="expression-row">
                        <label className="expression-label">Expression:</label>
                        <input
                          type="text"
                          value={func.expression}
                          onChange={(e) => updateFunction(func.id, 'expression', e.target.value)}
                          onBlur={(e) => validateExpression(func.id, e.target.value)}
                          placeholder="e.g., mid / SMA(mid, 50)"
                          className={`expression-input ${validationErrors[func.id] ? 'error' : ''} ${validationSuccess[func.id] ? 'success' : ''}`}
                        />
                        {validationSuccess[func.id] && <span className="validation-icon success">✓</span>}
                        {validationErrors[func.id] && <span className="validation-icon error">✗</span>}
                      </div>
                      {validationErrors[func.id] && (
                        <div className="validation-error">{validationErrors[func.id]}</div>
                      )}
                      
                      {/* Quick insert examples */}
                      <div className="quick-examples">
                        <span className="quick-label">Quick insert:</span>
                        {EXAMPLE_EXPRESSIONS.slice(0, 3).map((ex, i) => (
                          <button 
                            key={i}
                            className="quick-btn"
                            onClick={() => insertExample(func.id, ex.expression)}
                            title={ex.description}
                          >
                            {ex.expression.substring(0, 20)}{ex.expression.length > 20 ? '...' : ''}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
                
                <button className="add-btn" onClick={addFunction}>
                  + Add Function
                </button>
                
                {/* Reference Sections */}
                <div className="reference-sections">
                  <div className="reference-block">
                    <h4>📊 Available Variables</h4>
                    <div className="reference-list">
                      {AVAILABLE_VARIABLES.map(v => (
                        <div key={v.name} className="reference-item">
                          <code>{v.name}</code>
                          <span>{v.description}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="reference-block">
                    <h4>🔧 Available Functions</h4>
                    <div className="reference-list">
                      {AVAILABLE_FUNCTIONS.map(f => (
                        <div key={f.name} className="reference-item">
                          <code>{f.syntax}</code>
                          <span>{f.description}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="reference-block">
                    <h4>💡 Example Expressions</h4>
                    <div className="reference-list">
                      {EXAMPLE_EXPRESSIONS.map((ex, i) => (
                        <div key={i} className="reference-item example">
                          <code>{ex.expression}</code>
                          <span>{ex.description}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Entry Rules Tab */}
            {activeTab === 'entry' && (
              <div className="rules-tab">
                <div className="tab-explanation">
                  <h4>What are Entry Rules?</h4>
                  <p>
                    Entry rules define <strong>when to open a position</strong>. 
                    Each rule checks if your function meets a condition, then executes BUY (go long) or SELL (go short).
                  </p>
                  <div className="example-box">
                    <strong>Example:</strong> If you defined <code>sma_ratio = mid / SMA(mid, 50)</code>, you might create:
                    <br />
                    • <span className="rule-example buy">BUY</span> when <code>sma_ratio</code> &lt; <code>0.998</code> (price below average → expect rise)
                    <br />
                    • <span className="rule-example sell">SELL</span> when <code>sma_ratio</code> &gt; <code>1.002</code> (price above average → expect fall)
                  </div>
                </div>
                
                {functions.length === 0 ? (
                  <div className="no-functions-warning">
                    ⚠️ Go back to Step 1 and define at least one function first
                  </div>
                ) : (
                  <>
                    {entryRules.map((rule, ruleIndex) => (
                      <div key={rule.id} className={`rule-card ${rule.action === 'BUY' ? 'buy-rule' : 'sell-rule'}`}>
                        <div className="rule-header">
                          <span className="rule-title">Entry Rule {ruleIndex + 1}</span>
                          <div className="rule-action-group">
                            <span className="rule-action-label">Action:</span>
                            <select
                              value={rule.action}
                              onChange={(e) => updateRule('entry', rule.id, 'action', e.target.value)}
                              className={`action-select ${rule.action.toLowerCase()}`}
                            >
                              <option value="BUY">BUY (Go Long)</option>
                              <option value="SELL">SELL (Go Short)</option>
                            </select>
                          </div>
                          <button 
                            className="remove-btn"
                            onClick={() => removeRule('entry', rule.id)}
                          >
                            ×
                          </button>
                        </div>
                        
                        <div className="conditions-section">
                          <div className="conditions-label">When:</div>
                          {rule.conditions.map((condition, condIndex) => (
                            <div key={condition.id} className="condition-row">
                              {condIndex > 0 && (
                                <select
                                  value={rule.logic}
                                  onChange={(e) => updateRule('entry', rule.id, 'logic', e.target.value)}
                                  className="logic-select"
                                >
                                  <option value="AND">AND</option>
                                  <option value="OR">OR</option>
                                </select>
                              )}
                              
                              <select
                                value={condition.function_id}
                                onChange={(e) => updateCondition('entry', rule.id, condition.id, 'function_id', e.target.value)}
                                className="condition-function"
                              >
                                <option value="">Select function...</option>
                                {functions.map(f => (
                                  <option key={f.id} value={f.id}>
                                    {f.name || f.expression.substring(0, 25)}
                                  </option>
                                ))}
                              </select>
                              
                              <select
                                value={condition.operator}
                                onChange={(e) => updateCondition('entry', rule.id, condition.id, 'operator', e.target.value)}
                                className="condition-operator"
                              >
                                {OPERATORS.map(op => (
                                  <option key={op.value} value={op.value}>{op.label}</option>
                                ))}
                              </select>
                              
                              <input
                                type="number"
                                value={condition.threshold}
                                onChange={(e) => updateCondition('entry', rule.id, condition.id, 'threshold', e.target.value)}
                                className="condition-threshold"
                                step="0.001"
                                placeholder="threshold"
                              />
                              
                              {rule.conditions.length > 1 && (
                                <button 
                                  className="remove-condition-btn"
                                  onClick={() => removeCondition('entry', rule.id, condition.id)}
                                >
                                  ×
                                </button>
                              )}
                            </div>
                          ))}
                          
                          <button 
                            className="add-condition-btn"
                            onClick={() => addCondition('entry', rule.id)}
                          >
                            + Add another condition
                          </button>
                        </div>
                        
                        {/* Rule summary */}
                        <div className="rule-summary">
                          <strong>{rule.action}</strong> when {rule.conditions.map((c, i) => (
                            <span key={c.id}>
                              {i > 0 && <em> {rule.logic} </em>}
                              <code>{getFunctionDisplayName(c.function_id)}</code> {c.operator} <code>{c.threshold}</code>
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                    
                    <button className="add-btn" onClick={() => addRule('entry')}>
                      + Add Entry Rule
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Exit Rules Tab */}
            {activeTab === 'exit' && (
              <div className="rules-tab">
                <div className="tab-explanation">
                  <h4>What are Exit Rules?</h4>
                  <p>
                    Exit rules define <strong>when to close an open position</strong>. 
                    They only trigger when you're already in a trade (long or short).
                  </p>
                  <div className="example-box">
                    <strong>Example:</strong> Close the position when price returns to the average:
                    <br />
                    • <span className="rule-example flat">FLAT</span> when <code>sma_ratio</code> ≥ <code>0.999</code> AND <code>sma_ratio</code> ≤ <code>1.001</code>
                  </div>
                  <div className="tip-box">
                    <strong>💡 Tip:</strong> Exit rules are optional. Without them, positions stay open until an opposite entry signal.
                  </div>
                </div>
                
                {functions.length === 0 ? (
                  <div className="no-functions-warning">
                    ⚠️ Go back to Step 1 and define at least one function first
                  </div>
                ) : (
                  <>
                    {exitRules.map((rule, ruleIndex) => (
                      <div key={rule.id} className="rule-card exit-rule">
                        <div className="rule-header">
                          <span className="rule-title">Exit Rule {ruleIndex + 1}</span>
                          <div className="rule-action-group">
                            <span className="action-label-flat">FLAT (Close Position)</span>
                          </div>
                          <button 
                            className="remove-btn"
                            onClick={() => removeRule('exit', rule.id)}
                          >
                            ×
                          </button>
                        </div>
                        
                        <div className="conditions-section">
                          <div className="conditions-label">When:</div>
                          {rule.conditions.map((condition, condIndex) => (
                            <div key={condition.id} className="condition-row">
                              {condIndex > 0 && (
                                <select
                                  value={rule.logic}
                                  onChange={(e) => updateRule('exit', rule.id, 'logic', e.target.value)}
                                  className="logic-select"
                                >
                                  <option value="AND">AND</option>
                                  <option value="OR">OR</option>
                                </select>
                              )}
                              
                              <select
                                value={condition.function_id}
                                onChange={(e) => updateCondition('exit', rule.id, condition.id, 'function_id', e.target.value)}
                                className="condition-function"
                              >
                                <option value="">Select function...</option>
                                {functions.map(f => (
                                  <option key={f.id} value={f.id}>
                                    {f.name || f.expression.substring(0, 25)}
                                  </option>
                                ))}
                              </select>
                              
                              <select
                                value={condition.operator}
                                onChange={(e) => updateCondition('exit', rule.id, condition.id, 'operator', e.target.value)}
                                className="condition-operator"
                              >
                                {OPERATORS.map(op => (
                                  <option key={op.value} value={op.value}>{op.label}</option>
                                ))}
                              </select>
                              
                              <input
                                type="number"
                                value={condition.threshold}
                                onChange={(e) => updateCondition('exit', rule.id, condition.id, 'threshold', e.target.value)}
                                className="condition-threshold"
                                step="0.001"
                                placeholder="threshold"
                              />
                              
                              {rule.conditions.length > 1 && (
                                <button 
                                  className="remove-condition-btn"
                                  onClick={() => removeCondition('exit', rule.id, condition.id)}
                                >
                                  ×
                                </button>
                              )}
                            </div>
                          ))}
                          
                          <button 
                            className="add-condition-btn"
                            onClick={() => addCondition('exit', rule.id)}
                          >
                            + Add another condition
                          </button>
                        </div>
                        
                        {/* Rule summary */}
                        <div className="rule-summary">
                          <strong>FLAT</strong> when {rule.conditions.map((c, i) => (
                            <span key={c.id}>
                              {i > 0 && <em> {rule.logic} </em>}
                              <code>{getFunctionDisplayName(c.function_id)}</code> {c.operator} <code>{c.threshold}</code>
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                    
                    <button className="add-btn" onClick={() => addRule('exit')}>
                      + Add Exit Rule
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <div className="footer-status">
            {functions.length > 0 && entryRules.length > 0 ? (
              <span className="status-ready">✓ Ready to save</span>
            ) : (
              <span className="status-incomplete">
                Need: {functions.length === 0 ? 'functions' : ''}{functions.length === 0 && entryRules.length === 0 ? ' + ' : ''}{entryRules.length === 0 ? 'entry rules' : ''}
              </span>
            )}
          </div>
          <button className="btn btn-secondary" onClick={handleReset}>
            Reset
          </button>
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button 
            className="btn btn-primary" 
            onClick={handleSave}
            disabled={!strategyName || functions.length === 0 || entryRules.length === 0}
          >
            Save Strategy
          </button>
        </div>
      </div>
    </div>
  );
};

export default StrategyDesignerModal;