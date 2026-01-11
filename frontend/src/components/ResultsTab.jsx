import React from 'react';

const ResultsTab = ({ results }) => {
  return (
    <div>
      <h2>Results Tab - TODO</h2>
      <pre>{JSON.stringify(results, null, 2)}</pre>
    </div>
  );
};

export default ResultsTab;