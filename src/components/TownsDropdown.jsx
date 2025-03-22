import React, { useState, useEffect } from 'react';

const TownsDropdown = ({
  selectedTowns,
  properties,
  yearRange,
  disabled,
  onTownSelect
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownLabel, setDropdownLabel] = useState('All Towns');

  useEffect(() => {
    if (selectedTowns.length === 0) {
      setDropdownLabel('All Towns');
    } else if (selectedTowns.length === 1) {
      setDropdownLabel(selectedTowns[0]);
    } else {
      setDropdownLabel(`${selectedTowns.length} towns selected`);
    }
  }, [selectedTowns]);

  const towns = ["All Towns", ...new Set(properties.map(item => item.town).sort())];

  const handleTownClick = (town) => {
    if (disabled) return;
    onTownSelect(town);
  };

  const filteredProperties = properties.filter(d => 
    (d.date >= new Date(yearRange[0], 1, 1)) && 
    (d.date <= new Date(yearRange[1], 11, 31))
  );

  const propertiesCount = selectedTowns.length === 0 || selectedTowns[0] === 'All Towns'
    ? filteredProperties.length
    : filteredProperties.filter(d => selectedTowns.includes(d.town)).length;

  return (
    <div className="towns-dropdown">
      <span style={{ fontWeight: 'bold' }}>{propertiesCount}</span>
      {' properties in'}
      <div className={`dropdown-container ${isOpen ? 'dropdown-open' : ''}`}>
        <button
          className={`dropdown-button ${isOpen ? 'active' : ''}`}
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
        >
          <span>{dropdownLabel}</span>
          <span className="chevron">▼</span>
        </button>
        <div className={`dropdown-menu ${isOpen ? 'show' : ''}`}>
          {towns.map(town => (
            <div
              key={town}
              className={`dropdown-item ${selectedTowns.includes(town) ? 'selected' : ''}`}
              onClick={() => handleTownClick(town)}
            >
              <input
                type="checkbox"
                checked={town === 'All Towns' ? selectedTowns.length === 0 : selectedTowns.includes(town)}
                onChange={() => {}}
                disabled={disabled}
              />
              <span>{town}</span>
            </div>
          ))}
        </div>
      </div>
      {'completed between '}
      <span style={{ fontWeight: 'bold' }}>
        {yearRange[0]} and {yearRange[1]}
      </span>
    </div>
  );
};

export default TownsDropdown; 