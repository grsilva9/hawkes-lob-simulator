import React, { useState } from 'react';
import './App.css';
import WelcomeTab from './components/WelcomeTab';
import LOBSimulatorTab from './components/LOBSimulatorTab';
import BacktestTab from './components/BacktestTab';

function App() {
  const [activeTab, setActiveTab] = useState('welcome');
  
  // Lifted state for Market Simulation tab
  const [simulationData, setSimulationData] = useState(null);
  
  // Lifted state for Backtesting tab
  const [backtestResults, setBacktestResults] = useState(null);
  const [backtestMarketData, setBacktestMarketData] = useState(null);

  // Clear handlers
  const handleClearSimulation = () => {
    setSimulationData(null);
  };

  const handleClearBacktest = () => {
    setBacktestResults(null);
    setBacktestMarketData(null);
  };

  return (
    <div className="App">
      {/* Updated Header */}
      <header className="app-header">
        <div className="header-content">
          <h1 className="app-title">Hawkes LOB - A Microstructure Model</h1>
          <div className="api-status">
            <span className="status-indicator"></span>
            <span className="status-text">API Connected</span>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="app-nav">
        <button 
          className={`nav-tab ${activeTab === 'welcome' ? 'active' : ''}`}
          onClick={() => setActiveTab('welcome')}
        >
          Introduction
        </button>
        <button 
          className={`nav-tab ${activeTab === 'simulator' ? 'active' : ''}`}
          onClick={() => setActiveTab('simulator')}
        >
          Market Simulation
          {simulationData && <span className="tab-dot" title="Has results"></span>}
        </button>
        <button 
          className={`nav-tab ${activeTab === 'backtesting' ? 'active' : ''}`}
          onClick={() => setActiveTab('backtesting')}
        >
          Backtesting
          {backtestResults && <span className="tab-dot" title="Has results"></span>}
        </button>
      </nav>

      {/* Tab Content - Keep both mounted, hide with CSS */}
      <main className="app-content">
        <div className={`tab-panel ${activeTab === 'welcome' ? 'active' : 'hidden'}`}>
          <WelcomeTab />
        </div>
        <div className={`tab-panel ${activeTab === 'simulator' ? 'active' : 'hidden'}`}>
          <LOBSimulatorTab 
            simulationData={simulationData}
            setSimulationData={setSimulationData}
            onClear={handleClearSimulation}
          />
        </div>
        <div className={`tab-panel ${activeTab === 'backtesting' ? 'active' : 'hidden'}`}>
          <BacktestTab 
            backtestResults={backtestResults}
            setBacktestResults={setBacktestResults}
            marketData={backtestMarketData}
            setMarketData={setBacktestMarketData}
            onClear={handleClearBacktest}
          />
        </div>
      </main>
    </div>
  );
}

export default App;