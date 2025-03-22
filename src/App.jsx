import React, { useMemo, useEffect, useCallback, useState, useRef } from 'react';
import MapComponent from './components/MapComponent';
import TimelineChart from './components/TimelineChart';
import ResalePricesChart from './components/ResalePricesChart';
import TownsDropdown from './components/TownsDropdown';
import FlatTypeDropdown from './components/FlatTypeDropdown';
import ColorDropdown from './components/ColorDropdown';
import Legend from './components/Legend';
import MapControls from './components/MapControls';
import InfoModal from './components/InfoModal';
import { useData } from './hooks/useData';
import { useMapState } from './hooks/useMapState';
import { useChartState } from './hooks/useChartState';
import './App.css';

function App() {
  const chartRef = useRef(null);  // Add ref for ResalePricesChart
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);

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

  const filteredProperties = useMemo(() => {
    if (!properties?.length) return [];
    if(selectedTowns.length === 0 || selectedTowns[0] === 'All Towns') {
      return properties;
    } else {
      return properties.filter(d => selectedTowns.includes(d.town));
    }
  }, [properties, selectedTowns]);

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
      
      setSelectedTowns(newSelectedTowns);

      handleAreaClick(town, 'town');
    }
  }, [selectedTowns, setSelectedTowns, handleAreaClick]);

  const handleDotClick = useCallback((clickedName, type) => {
    handleAreaClick(clickedName, type);

    if(type === 'town') {
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
  
    // // Update chart type if needed
    // setChartType(currentChartType => {
    //   if (currentChartType === 'town') {
    //     return 'street';
    //   }
    //   return currentChartType;
    // });
  }, [chartRef, selectedTowns, handleAreaClick, setIsDynamicDataLoading, setSelectedTowns, setChartType]);

  const handleLegendPillClick = useCallback((status, selectedPills) => {
    if (mapLoaded) {
      updateMarkerLayer(status, selectedPills);
    }
  }, [mapLoaded, updateMarkerLayer]);

  const handleColorChange = useCallback((newColorStatus) => {
    // Reset any active filters when color option changes
    if (mapLoaded) {
      updateMarkerLayer(newColorStatus);
    }
  }, [mapLoaded, updateMarkerLayer]);

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
          <div className="title-container">
            <h2>Singapore's HDB Properties</h2>
            <div 
              className="info-icon" 
              onClick={() => setIsInfoModalOpen(true)} 
              title="About this visualization"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
              </svg>
            </div>
          </div>
          <h3>Completion Timeline and Resale Market</h3>
        </div>
        <InfoModal isOpen={isInfoModalOpen} onClose={() => setIsInfoModalOpen(false)}>
          <h2>About this Visualization</h2>
          <p>This interactive visualization shows Singapore's HDB (Housing & Development Board) properties across the city-state.</p>
          <br></br>
          <h3>Features:</h3>
          <ul>
            <li>View properties by completion year on the timeline</li>
            <li>Filter by towns, flat type, and year range in combination</li>
            <li>Color coding by property type, age, or resale price</li>
            <li>Compare resale prices across different towns and streets</li>
          </ul>
          <h3>Data Sources:</h3>
          <p>The data is sourced from <a href="https://data.gov.sg">data.gov.sg</a> including 
          <a href="https://data.gov.sg/datasets/d_17f5382f26140b1fdae0ba2ef6239d2f/view"> property information</a>, 
          <a href="https://data.gov.sg/datasets/d_8b84c4ee58e3cfc0ece0d773c8ca6abc/view"> historical resale transactions</a>, 
          and <a href="https://data.gov.sg/datasets/d_cc2f9c99c2a7cb55a54ad0f522016011/view"> geographical boundary data</a>.</p>
          <br></br>
          <h3>How to Use:</h3>
          <ul>
            <li>Drag the timeline to see how resale prices have changed over time</li>
            <li>When chart is in towns view, either click on a map marker or a circle to switch to chart street view of the selected town.</li>
            <li>When chart is in street view, click on a map marker to highlight the corresponding street on the chart</li>
            <li>When chart is in street view, click on a circle on chart to highlight all properties within the selectedstreet.</li>
            <li>Hover over a circle on the chart to see the median resale price for the month of resale.</li>
            <li>Click on a legend pill to filter by that property type, age, or resale price</li>
          </ul>

          <h3>Acknowledgements:</h3>
          <p>This visualization was created by <a href="https://dianaow.com">Diana Ow</a>, as a tool to aid public house buying for people. If you found this useful, please share it with others! You may also consider sponsoring my coding endeavours through these channels:</p>
          <ul>
            <li><a href="https://revolut.me/diana25gx">Revolut</a></li>
            <li><a href="https://www.paypal.com/paypalme/owdiana">PayPal</a></li>
          </ul>
          <p>This project is open source and available on <a href="https://github.com/dianaow/hdb-resale-map-react">GitHub</a>. If you have any feedback or suggestions, please <a href="https://github.com/dianaow/hdb-resale-map-react/issues">open an issue</a>.</p>
        </InfoModal>
        <TownsDropdown
          selectedTowns={selectedTowns}
          properties={updatedProperties}
          geojson={geojson}
          yearRange={yearRange}
          disabled={isDynamicDataLoading}
          onTownSelect={handleTownSelection}
        />
        <TimelineChart
          properties={filteredProperties}
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
          ref={mapRef}
          properties={updatedProperties}
          onMapLoaded={handleMapLoaded}
          onMarkerClick={handleMapMarkerClick}
        />
        <div id="map-panel">
          <ColorDropdown
            selectedLegendStatus={selectedLegendStatus}
            setSelectedLegendStatus={setSelectedLegendStatus}
            onColorChange={handleColorChange}
          />
          <Legend 
            selectedLegendStatus={selectedLegendStatus}
            onLegendPillClick={handleLegendPillClick}
          />
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