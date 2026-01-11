import React from 'react';

const ConfigPanel = ({ onRunBacktest, isLoading, apiConnected }) => {
  return (
    <div>
      <h2>Config Panel (TODO)</h2>
      <button 
        onClick={() => onRunBacktest([], {})}
        disabled={isLoading || !apiConnected}
      >
        Run Backtest
      </button>
    </div>
  );
};

export default ConfigPanel;