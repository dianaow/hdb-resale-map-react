import { useMemo, useState } from 'react';

export function useChartState() {
  const [selectedFlatType, setSelectedFlatType] = useState('4 ROOM');
  const [selectedTowns, setSelectedTowns] = useState([]);
  const [selectedStreets, setSelectedStreets] = useState([]);
  const [yearRange, setYearRange] = useState([1960, new Date().getFullYear()]);

  const chartType = useMemo(() => {
    if(selectedTowns.length === 0 || selectedTowns[0] === 'All Towns') {
      return 'town'
    } else {
      return 'street' 
    }
  }, [selectedTowns])

  return {
    selectedTowns,
    setSelectedTowns,
    selectedStreets,
    setSelectedStreets,
    selectedFlatType,
    setSelectedFlatType,
    chartType,
    yearRange,
    setYearRange
  };
} 