import React, { useState, useEffect } from 'react';
import { TAG_COLORS, PROPERTY_TAGS, PRICE_THRESHOLDS, AGE_THRESHOLDS } from '../constants';
import { useData } from '../hooks/useData';

const Legend = ({ selectedLegendStatus, onLegendPillClick }) => {
  const [selectedPills, setSelectedPills] = useState([]);
  const { getAgeColor, getPriceColor } = useData();

  // Reset selected pills when legend status changes
  useEffect(() => {
    setSelectedPills([]);
  }, [selectedLegendStatus]);
  
  const handlePillClick = (status, pill) => {
    // Toggle selection
    const newSelectedPills = [...selectedPills];
    const pillIndex = newSelectedPills.indexOf(pill);
    
    if (pillIndex >= 0) {
      // Remove if already selected
      newSelectedPills.splice(pillIndex, 1);
    } else {
      // Add if not selected
      newSelectedPills.push(pill);
    }
    
    setSelectedPills(newSelectedPills);
    
    // Pass the entire selection state to the parent component
    onLegendPillClick(status, newSelectedPills);
  };
  
  const getLegendContent = () => {
    const ageThresholds = AGE_THRESHOLDS;
    const priceThresholds = PRICE_THRESHOLDS;

    switch (selectedLegendStatus) {
      case 'age':
        return (
          <>
            <label>Legend: </label>
            {ageThresholds.map((age, i) => {
              const ranges = createAgeRangeLabels(ageThresholds);
              const isPillSelected = selectedPills.includes(age);
              return (
                <div
                  key={age}
                  className="legend-pill"
                  style={{
                    backgroundColor: getAgeColor(age),
                    color: age <= 20 ? 'black' : 'white',
                    cursor: 'pointer',
                    opacity: selectedPills.length === 0 || isPillSelected ? 1 : 0.5
                  }}
                  onClick={() => {
                    handlePillClick('age', age);
                  }}
                >
                  {ranges[i]}
                </div>
              );
            })}
          </>
        );

      case 'tag':
        return (
          <>
            <label>Legend: </label>
            {PROPERTY_TAGS.map(type => {
              const isPillSelected = selectedPills.includes(type);
              return (
                <div
                  key={type}
                  className="legend-pill"
                  style={{
                    backgroundColor: TAG_COLORS[type] || "#000000",
                    color: 'black',
                    cursor: 'pointer',
                    opacity: selectedPills.length === 0 || isPillSelected ? 1 : 0.5
                  }}
                  onClick={() => {
                    handlePillClick('tag', type);
                  }}
                >
                  {type}
                </div>
              );
            })}
          </>
        );

      case 'price':
        return (
          <>
            <label>Legend: </label>
            <div className="legend-pill" style={{ backgroundColor: 'gray', color: 'white', opacity: 1 }}>No resale data</div>
            {priceThresholds.map((price, i) => {
              const ranges = createPriceRangeLabels(priceThresholds);
              const isPillSelected = selectedPills.includes(price);
              return (
                <div
                  key={price}
                  className="legend-pill"
                  style={{
                    backgroundColor: getPriceColor(price),
                    color: 'black',
                    cursor: 'pointer',
                    opacity: selectedPills.length === 0 || isPillSelected ? 1 : 0.5
                  }}
                  onClick={() => {
                    handlePillClick('price', price);
                  }}
                >
                  {ranges[i]}
                </div>
              );
            })}
          </>
        );

      default:
        return null;
    }
  };

  return (
    <div id="color-legend">
      {getLegendContent()}
    </div>
  );
};

// Helper function
function createPriceRangeLabels(thresholds) {
  function formatNumber(num) {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(0) + 'K';
    }
    return num.toString();
  }
  
  const labels = [];
  for (let i = 0; i < thresholds.length - 1; i++) {
    labels.push(`${formatNumber(thresholds[i])} - ${formatNumber(thresholds[i+1])}`);
  }
  labels.push(`Above ${formatNumber(thresholds[thresholds.length - 1])}`);
  return labels;
}

function createAgeRangeLabels(thresholds) {  
  const labels = [];
  for (let i = 0; i < thresholds.length - 1; i++) {
    labels.push(`${thresholds[i]} - ${thresholds[i+1]-1}`);
  }
  labels.push(`Above ${thresholds[thresholds.length - 1]}`);
  return labels;
}


export default Legend; 