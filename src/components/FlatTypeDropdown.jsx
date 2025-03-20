import React, { useState } from 'react';

const FlatTypeDropdown = ({
  selectedFlatType,
  setSelectedFlatType,
  data,
  chartType,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const flatTypes = [...new Set(data.map(item => item.flat_type))]
    .filter(d => d !== '1 ROOM')
    .sort();

  const handleFlatTypeClick = (flatType) => {
    setSelectedFlatType(flatType);
    setIsOpen(false);
  }

  return (
    <div className="flattype-dropdown">
      <span style={{ padding: '5px', fontSize: '12px' }}>
        Average Resale Prices of
        <div className={`dropdown-container ${isOpen ? 'dropdown-open' : ''}`}>
          <button
            className={`dropdown-button ${isOpen ? 'active' : ''}`}
            onClick={() => setIsOpen(!isOpen)}
          >
            <span>{selectedFlatType}</span>
            <span className="chevron">▼</span>
          </button>
          <div className="dropdown-menu">
            {flatTypes.map(flatType => (
              <div
                key={flatType}
                className="dropdown-item"
                onClick={() => handleFlatTypeClick(flatType)}
              >
                {flatType}
              </div>
            ))}
          </div>
        </div>
        {'HDB Residential Properties by ' + (chartType === 'town' ? 'Town' : 'Street')}
      </span>
    </div>
  );
};

export default FlatTypeDropdown; 