import React, { useState } from 'react';

const ColorDropdown = ({
  selectedLegendStatus,
  setSelectedLegendStatus
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const colorOptions = [
    { value: 'type', text: 'Property Type' },
    { value: 'age', text: 'Age' },
    { value: 'price', text: 'Average Resale Price (past 6 months)' }
  ];

  const handleColorClick = (value) => {
    setSelectedLegendStatus(value);
    setIsOpen(false);
  };

  return (
    <div className="color-dropdown">
      <label>Color by: </label>
      <div className={`dropdown-container ${isOpen ? 'dropdown-open' : ''}`} style={{ width: '160px' }}>
        <button
          className={`dropdown-button ${isOpen ? 'active' : ''}`}
          onClick={() => setIsOpen(!isOpen)}
        >
          <span>{colorOptions.find(d => d.value === selectedLegendStatus).text}</span>
          <span className="chevron">▼</span>
        </button>
        <div className="dropdown-menu">
          {colorOptions.map(option => (
            <div
              key={option.value}
              className="dropdown-item"
              onClick={() => handleColorClick(option.value)}
            >
              {option.text}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ColorDropdown; 