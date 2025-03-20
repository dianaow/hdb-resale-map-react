import React from 'react';
import * as d3 from 'd3';
import { TAG_COLORS, PROPERTY_TAGS } from '../constants';

const Legend = ({ selectedLegendStatus }) => {
  const getLegendContent = () => {
    switch (selectedLegendStatus) {
      case 'age':
        return (
          <>
            <label>Legend: </label>
            {[0, 10, 20, 30, 40, 50].map(age => {
              const colorAge = d3.scaleSequential()
                .domain([0, 50])
                .interpolator(d3.interpolateBuPu);
              return (
                <div
                  key={age}
                  className="legend-pill"
                  style={{
                    backgroundColor: colorAge(age),
                    color: age <= 20 ? 'black' : 'white'
                  }}
                >
                  {age}
                </div>
              );
            })}
          </>
        );

      case 'type':
        return (
          <>
            <label>Legend: </label>
            {PROPERTY_TAGS.map(type => {
              return (
                <div
                  key={type}
                  className="legend-pill"
                  style={{
                    backgroundColor: TAG_COLORS[type],
                    color: 'black'
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
            {[0, 300000, 600000, 800000, 1000000].map((threshold, i) => {
              const thresholds = [0, 300000, 600000, 800000, 1000000];
              const colors = ["white", "#99f6e4", "#2dd4bf", "#FF7F50", "#FFD700"];
              const colorScale = d3.scaleThreshold()
                .domain(thresholds.slice(1))
                .range(colors);
              const ranges = createRangeLabels(thresholds);
              return (
                <div
                  key={threshold}
                  className="legend-pill"
                  style={{
                    backgroundColor: colorScale(threshold),
                    color: 'black'
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
function createRangeLabels(thresholds) {
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

export default Legend; 