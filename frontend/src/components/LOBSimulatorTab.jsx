import React, { useState } from 'react';
import RegimeBuilder from './RegimeBuilder';
import CandlestickChart from './CandlestickChart';
import OrderBookDisplay from './OrderBookDisplay';
import './LOBSimulatorTab.css';

const LOBSimulatorTab = ({ simulationData, setSimulationData, onClear }) => {
  const [regimeBuilderOpen, setRegimeBuilderOpen] = useState(true);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationCounter, setSimulationCounter] = useState(0);

  const handleRunSimulation = async (regimeConfigs) => {
    setIsSimulating(true);

    try {
      const response = await fetch('http://localhost:5000/simulate_regimes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ regimes: regimeConfigs })
      });

      const data = await response.json();
      
      if (data.success) {
        setSimulationData(data.simulation);
        setSimulationCounter(prev => prev + 1);
      }
    } catch (err) {
      console.error('Simulation failed:', err);
    } finally {
      setIsSimulating(false);
    }
  };

  const handleExportCSV = () => {
    if (!simulationData) return;

    const csv = [
      ['time', 'mid', 'spread', 'best_bid', 'best_ask'].join(','),
      ...simulationData.t.map((t, i) => 
        [t, simulationData.mid[i], simulationData.spread[i], 
         simulationData.best_bid[i], simulationData.best_ask[i]].join(',')
      )
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lob_simulation_${Date.now()}.csv`;
    a.click();
  };

  const handleClear = () => {
    if (onClear) {
      onClear();
      setSimulationCounter(prev => prev + 1);
    }
  };

  return (
    <div className="lob-simulator-tab">
      {/* Main Layout */}
      <div className={`lob-layout ${regimeBuilderOpen ? 'with-builder' : 'full-width'}`}>
        
        {/* Left: Regime Builder */}
        {regimeBuilderOpen && (
          <aside className="regime-builder-panel">
            <RegimeBuilder
              onRunSimulation={handleRunSimulation}
              isSimulating={isSimulating}
              onTogglePanel={() => setRegimeBuilderOpen(false)}
              onExportCSV={simulationData ? handleExportCSV : null}
              onClear={simulationData ? handleClear : null}
            />
          </aside>
        )}

        {/* Right: Visualization Area */}
        <main className="visualization-area">
          {/* Show Panel Button (when hidden) */}
          {!regimeBuilderOpen && (
            <button 
              className="show-panel-btn"
              onClick={() => setRegimeBuilderOpen(true)}
              title="Show panel"
            >
              →
            </button>
          )}

          {/* Charts Grid */}
          <div className="charts-grid">
            {/* Candlestick Chart */}
            <div className="chart-container candlestick-container">
              {isSimulating && (
                <div className="loading-state">
                  <div className="spinner"></div>
                  <p>Generating market data...</p>
                </div>
              )}
              <CandlestickChart 
                data={simulationData}
                key={simulationCounter}
              />
            </div>

            {/* Order Book */}
            <div className="chart-container orderbook-container">
              <OrderBookDisplay data={simulationData} />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default LOBSimulatorTab;