import React from 'react';

const VisualizationPanel = ({ results }) => {
  return (
    <div>
      <h2>Results (TODO)</h2>
      <pre>{JSON.stringify(results, null, 2)}</pre>
    </div>
  );
};

export default VisualizationPanel;