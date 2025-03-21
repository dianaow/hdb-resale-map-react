import { useMemo, useState, useEffect, useRef } from 'react';

export function useChartState() {
  const [selectedFlatType, setSelectedFlatType] = useState('4 ROOM');
  const [selectedTowns, setSelectedTowns] = useState([]);
  const [selectedStreets, setSelectedStreets] = useState([]);
  const [yearRange, setYearRange] = useState([1960, new Date().getFullYear()]);
  const [chartType, setChartType] = useState('town');

  useEffect(() => {
    const newChartType = (selectedTowns.length === 0 || selectedTowns[0] === 'All Towns') 
      ? 'town' 
      : 'street';
    
    if (newChartType !== chartType) {
      setChartType(newChartType);
    }
  }, [selectedTowns, chartType]);


  return {
    selectedTowns,
    setSelectedTowns,
    selectedStreets,
    setSelectedStreets,
    selectedFlatType,
    setSelectedFlatType,
    chartType,
    yearRange,
    setYearRange,
    setChartType
  };
} 