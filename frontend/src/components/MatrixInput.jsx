import React from 'react';
import './MatrixInput.css';

const MatrixInput = ({ 
  data, 
  onChange, 
  rowLabels, 
  colLabels, 
  title,
  highlightDiagonal = false,
  colorScheme = 'default'
}) => {
  const handleChange = (i, j, value) => {
    const numValue = parseFloat(value);
    if (!isNaN(numValue)) {
      onChange(i, j, numValue);
    }
  };

  return (
    <div className="matrix-input-wrapper" data-scheme={colorScheme}>
      {title && <h4 className="matrix-title">{title}</h4>}
      
      <div className="matrix-grid">
        {/* Column Headers */}
        <div className="matrix-cell matrix-header"></div>
        {colLabels.map((label, j) => (
          <div key={`col-${j}`} className="matrix-cell matrix-header">
            {label}
          </div>
        ))}
        
        {/* Matrix Rows */}
        {data.map((row, i) => (
          <React.Fragment key={`row-${i}`}>
            {/* Row Header */}
            <div className="matrix-cell matrix-header">{rowLabels[i]}</div>
            
            {/* Row Data */}
            {row.map((value, j) => (
              <div 
                key={`cell-${i}-${j}`} 
                className={`matrix-cell ${highlightDiagonal && i === j ? 'diagonal' : ''}`}
              >
                <input
                  type="number"
                  value={value}
                  onChange={(e) => handleChange(i, j, e.target.value)}
                  step="0.1"
                  className="matrix-input"
                />
              </div>
            ))}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

export default MatrixInput;