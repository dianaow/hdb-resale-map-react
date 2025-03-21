import React, { useMemo, useEffect, useCallback, useState, useRef } from 'react';
import MapComponent from './components/MapComponent';
import TimelineChart from './components/TimelineChart';
import ResalePricesChart from './components/ResalePricesChart';
import TownsDropdown from './components/TownsDropdown';
import FlatTypeDropdown from './components/FlatTypeDropdown';
import ColorDropdown from './components/ColorDropdown';
import Legend from './components/Legend';
import MapControls from './components/MapControls';
import { useData } from './hooks/useData';
import { useMapState } from './hooks/useMapState';
import { useChartState } from './hooks/useChartState';
import './App.css';

function App() {
  const chartRef = useRef(null);  // Add ref for ResalePricesChart

  const {
    selectedTowns,
    setSelectedTowns,
    selectedFlatType,
    setSelectedFlatType,
    chartType,
    yearRange,
    setYearRange,
    setChartType
  } = useChartState();

  const {
    properties,
    geojson,
    aggTownPrices,
    aggStreetPrices,
    streetPrices,
    isLoading,
    isDynamicDataLoading,
    setIsDynamicDataLoading,
    error,
    isValidNumber,
    getPriceColor
  } = useData(selectedTowns);

  // Memoize updated properties
  const updatedProperties = useMemo(() => {
    if (!properties?.length) return [];

    // If we don't have street prices yet, return properties with default values
    if (!streetPrices?.length) {
      return properties.map(d => ({
        ...d,
        price: "NA",
        priceColor: 'gray'
      }));
    }

    // Create a lookup map for faster property retrieval
    const streetPriceMap = new Map();
    
    // Only filter once outside the loop
    const filteredStreetPrices = streetPrices.filter(el => el.flat_type === selectedFlatType);
    
    // Build lookup map
    filteredStreetPrices.forEach(price => {
      streetPriceMap.set(price['block_street'], price);
    });

    // Process all properties at once
    return properties.map(d => {
      const blockStreet = d['block'] && d['street'] ? (d['block'] + ' ' + d['street']) : '';
      
      if (!blockStreet) {
        return {
          ...d,
          price: "NA",
          priceColor: 'gray'
        };
      }
      
      const point = streetPriceMap.get(blockStreet);
      
      if (point && isValidNumber(point.price)) {
        return {
          ...d,
          price: point.price,
          priceColor: getPriceColor(point.price)
        };
      } else {
        return {
          ...d,
          price: "NA",
          priceColor: 'gray'
        };
      }
    });
  }, [properties, streetPrices, selectedFlatType, isValidNumber, getPriceColor]);
  
  const {
    mapRef,
    mapLoaded,
    selectedLegendStatus,
    setSelectedLegendStatus,
    setMapInstance,
    updateMapColors,
    updateMapBounds,
    updateMarkerLayer,
    handleAreaClick
  } = useMapState(
    updatedProperties, 
    geojson, 
    selectedTowns, 
    yearRange
  );

  // Memoize filtered data with precise dependencies
  const filteredData = useMemo(() => {
    console.log('filteredData', isLoading,
      isDynamicDataLoading,
      chartType,
      aggTownPrices.length,
      aggStreetPrices.length,
      selectedTowns,
      selectedFlatType
    );
    // Skip calculation if loading initial data or dynamic data
    if (isLoading || isDynamicDataLoading) {
      //console.log('Still loading data, skipping filteredData calculation');
      return [];
    }
    
    if (chartType === 'town') {
      if (!aggTownPrices?.length) {
        console.log('No town prices data available');
        return [];
      }
      
      const filtered = aggTownPrices.filter(item => {
        const matchesTown = selectedTowns.length === 0 || 
                          selectedTowns[0] === 'All Towns' || 
                          selectedTowns.includes(item.town);
        
        const matchesFlatType = !selectedFlatType || 
                              item.flat_type === selectedFlatType;

        return matchesTown && matchesFlatType;
      });
      console.log(`Filtered ${aggTownPrices.length} town prices to ${filtered.length} items`);
      return filtered;
    } else {
      // For street view
      // Only filter by flat type if we have street prices and dynamic data is not loading
      if (!aggStreetPrices?.length) {       
        return [];
      }
            
      const filtered = aggStreetPrices.filter(item => {
        const matchesFlatType = !selectedFlatType || 
                              item.flat_type === selectedFlatType;

        return matchesFlatType;
      });

      console.log(`Filtered ${aggStreetPrices.length} street prices to ${filtered.length} items for ${selectedTowns} and ${selectedFlatType}`);
      return filtered;
    }
  }, [
      isLoading,
      isDynamicDataLoading,
      chartType,
      aggTownPrices,
      aggStreetPrices,
      selectedTowns,
      selectedFlatType
  ]);

  const chartOptions = useMemo(() => {
    return {
      groupBy: chartType
    };
  }, [chartType]);

  const handleMapLoaded = useCallback((mapInstance) => {
    setMapInstance(mapInstance);
  }, [setMapInstance]);

  const handleTownSelection = useCallback((town) => {
    if (town === 'All Towns') {
      setSelectedTowns([]);
      handleAreaClick(null, 'town');
    } else {
      // Toggle the selected town
      const newSelectedTowns = selectedTowns.includes(town)
        ? selectedTowns.filter(t => t !== town)
        : [...selectedTowns, town];
      
      setIsDynamicDataLoading(true);
      setSelectedTowns(newSelectedTowns);

      handleAreaClick(town, 'town');
    }
  }, [selectedTowns, setSelectedTowns, handleAreaClick, setIsDynamicDataLoading]);

  const handleDotClick = useCallback((clickedName, type) => {
    handleAreaClick(clickedName, type);

    if(type === 'town') {
      setIsDynamicDataLoading(true);
      setSelectedTowns([clickedName]);
    }
  }, [handleAreaClick, setSelectedTowns, setChartType]);

  const handleMapMarkerClick = useCallback((street, town) => {
    // Update highlight state on chart
    if (chartRef?.current) {
      chartRef.current.highlightDots(street);
    }
  
    // Use state updater functions to access latest state values
    setSelectedTowns(currentSelectedTowns => {
      // Check if we need to add this town to selectedTowns
      const needToAddTown = !currentSelectedTowns.includes(town);
      
      if (needToAddTown) {
        setIsDynamicDataLoading(true);
        
        handleAreaClick(town, 'town');
        
        // Return updated towns array
        return [...currentSelectedTowns, town];
      }
      
      return currentSelectedTowns;
    });
  
    // Always add/toggle street highlight (black layer) after town processing
    setTimeout(() => {
      handleAreaClick(street, 'street');
    }, 10);
  
    // Update chart type if needed
    setChartType(currentChartType => {
      if (currentChartType === 'town') {
        return 'street';
      }
      return currentChartType;
    });
  }, [chartRef, handleAreaClick, setIsDynamicDataLoading, setSelectedTowns, setChartType]);

  useEffect(() => {
    if (mapLoaded) {
      updateMapColors();
    }
  }, [selectedLegendStatus, mapLoaded, updateMapColors]);

  useEffect(() => {
    if (mapLoaded) {
      updateMapBounds();
    }
  }, [selectedTowns, mapLoaded, updateMapBounds]);

  useEffect(() => {
    if (mapLoaded) {
      updateMarkerLayer();
    }
  }, [yearRange, mapLoaded, updateMarkerLayer]);

  return (
    <div className="container">
      {isLoading && (
        <div className="loading-container overlay">Loading initial data...</div>
      )}
      {error && (
        <div className="error-container overlay">Error: {error.message || 'Unknown error occurred'}</div>
      )}
      <div id="main">
        <div id='title'>
          <h2>Singapore's HDB Properties</h2>
          <h3>Completion Timeline and Resale Market</h3>
        </div>
        <TownsDropdown
          selectedTowns={selectedTowns}
          setSelectedTowns={setSelectedTowns}
          properties={updatedProperties}
          geojson={geojson}
          yearRange={yearRange}
          disabled={isDynamicDataLoading}
          onTownSelect={handleTownSelection}
        />
        <TimelineChart
          properties={updatedProperties}
          yearRange={yearRange}
          setYearRange={setYearRange}
        />
        <FlatTypeDropdown
          selectedFlatType={selectedFlatType}
          setSelectedFlatType={setSelectedFlatType}
          data={aggTownPrices}
          chartType={chartType}
          disabled={isDynamicDataLoading}
        />
        <ResalePricesChart
          ref={chartRef}
          data={filteredData}
          onDotClick={handleDotClick}
          userOptions={chartOptions}
          key={`prices-chart-${isLoading ? 'ready' : 'loading'}`}
        />
      </div>

      <div id="map-container">
        <MapComponent
          properties={updatedProperties}
          onMapLoaded={handleMapLoaded}
          ref={mapRef}
          onMarkerClick={handleMapMarkerClick}
        />
        <div id="map-panel">
          <ColorDropdown
            selectedLegendStatus={selectedLegendStatus}
            setSelectedLegendStatus={setSelectedLegendStatus}
          />
          <Legend selectedLegendStatus={selectedLegendStatus} />
          <MapControls 
            mapRef={mapRef} 
            selectedTowns={selectedTowns}
            selectedLegendStatus={selectedLegendStatus}
            mapLoaded={mapLoaded}
          />
        </div>
      </div>
    </div>
  );
}

export default React.memo(App);