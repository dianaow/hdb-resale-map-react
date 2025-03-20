import { useState, useRef, useCallback, useEffect } from 'react';
import mapboxgl from 'mapbox-gl';

export function useMapState(
  properties,
  geojson, 
  selectedTowns,
  yearRange
) {
  const [selectedLegendStatus, setSelectedLegendStatus] = useState('type');
  const [mapLoaded, setMapLoaded] = useState(false);
  const highlightedAreasRef = useRef(new Set());
  const mapRef = useRef(null);
  
  // Keep track of the last valid properties
  const lastValidPropertiesRef = useRef(properties);
  useEffect(() => {
    if (properties?.length > 0) {
      lastValidPropertiesRef.current = properties;
    }
  }, [properties]);

  const calculateBounds = useCallback((towns) => {
    if (!geojson || !towns.length) return null;

    let combinedBounds = null;
    for (const townName of towns) {
      const townFeature = geojson.features.find(d => d.properties.PLN_AREA_N === townName);
      
      if (townFeature?.geometry?.coordinates?.[0]) {
        const coordinates = townFeature.geometry.coordinates;
        
        if (!combinedBounds) {
          combinedBounds = new mapboxgl.LngLatBounds(coordinates[0][0], coordinates[0][0]);
        }
        
        coordinates[0].forEach(coord => {
          combinedBounds.extend(coord);
        });
      }
    }
    return combinedBounds;
  }, [geojson]);

  const updateMapColors = useCallback(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    if(selectedLegendStatus === 'age') {
      map.setPaintProperty('circle', 'circle-color', ['get', 'ageColor']);
    } else if(selectedLegendStatus === 'type') {
      map.setPaintProperty('circle', 'circle-color', ['get', 'color']);
    } else if(selectedLegendStatus === 'price') {
      map.setPaintProperty('circle', 'circle-color', ['get', 'priceColor']);
    }
  }, [selectedLegendStatus, mapLoaded]);

  const updateMapBounds = useCallback(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    
    if (selectedTowns.length > 0 && selectedTowns[0] !== 'All Towns') {
      const bounds = calculateBounds(selectedTowns);
      if (bounds) {
        map.fitBounds(bounds, {
          padding: 20,
          zoom: selectedTowns.length > 1 ? 12.5 : 14
        });
      }
    } else {
      map.flyTo({
        center: [103.9, 1.35],
        zoom: 12.2
      });
    }
  }, [selectedTowns, mapLoaded, calculateBounds]);

  const addHighlightLayer = useCallback((points, layerId, color) => {
    const map = mapRef.current;
    if (!map) return;

    // Check if layer already exists - if it does, just return
    if (map.getLayer(layerId)) {
      return;
    }

    let totalLat = 0;
    let totalLon = 0;
    let dotsGeoJSON = { "type": "FeatureCollection", "features": [] };
    
    points.forEach(point => {
      totalLat += point.lat;
      totalLon += point.lon;
      dotsGeoJSON.features.push({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [point.lon, point.lat]
        },
        properties: {
          ...point
        }
      });        
    });
    
    const centroid = {
      lat: totalLat / points.length,
      lon: totalLon / points.length
    };
    
    if (centroid.lat && centroid.lon) {
      map.flyTo({
        center: [centroid.lon, centroid.lat],
        zoom: 15
      });
      
      if (!map.getSource(layerId)) {
        map.addSource(layerId, {
          type: 'geojson',
          data: dotsGeoJSON
        });
      } else {
        map.getSource(layerId).setData(dotsGeoJSON);
      }
      
      map.addLayer({
        'id': layerId,
        'type': 'circle',
        'source': layerId,
        'paint': {
          'circle-radius': [
            'interpolate', 
            ['linear'], 
            ['zoom'], 
            12, [
              'interpolate', 
              ['linear'], 
              ['get', 'total_units'],
              0, 1.5,
              50, 1.5,
              100, 2,
              200, 3,
              300, 5
            ],
            18, [
              'interpolate', 
              ['linear'], 
              ['get', 'total_units'],
              0, 3,
              50, 5,
              100, 7,
              200, 11,
              300, 15
            ]
          ],
          'circle-color': 'rgba(0, 0, 0, 0)',
          'circle-opacity': 1,
          'circle-stroke-width': 1.5,
          'circle-stroke-color': color
        }
      });
    }
  }, []);

  const removeHighlightLayer = useCallback((layerId) => {
    const map = mapRef.current;
    if (!map) return;

    if (map.getLayer(layerId)) {
      map.removeLayer(layerId);
    }
    if (map.getSource(layerId)) {
      map.removeSource(layerId);
    }
  }, []);

  const updateMarkerLayer = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;

    // Create filter conditions
    const filterConditions = [];

    // Add year range filter if yearRange is set
    if (yearRange && yearRange.length === 2) {
      const startYear = yearRange[0];
      const endYear = yearRange[1];
      
      // Add filter for unclustered points
      filterConditions.push([
        'all',
        ['>=', ['to-number', ['get', 'year']], startYear],
        ['<=', ['to-number', ['get', 'year']], endYear]
      ]);

      // Apply filter to circle layer
      map.setFilter('circle', ['all', ...filterConditions]);
      
      // Apply same filter to clusters
      if (map.getLayer('clusters')) {
        map.setFilter('clusters', ['all', ['has', 'point_count'], ...filterConditions]);
        map.setFilter('cluster-count', ['all', ['has', 'point_count'], ...filterConditions]);
      }
    } else {
      // Reset filters if no year range
      map.setFilter('circle', ['!', ['has', 'point_count']]);
      if (map.getLayer('clusters')) {
        map.setFilter('clusters', ['has', 'point_count']);
        map.setFilter('cluster-count', ['has', 'point_count']);
      }
    }

  }, [yearRange]);

  const handleAreaClick = useCallback((area, chartType) => {
    const map = mapRef.current;
    // Use lastValidPropertiesRef.current instead of properties directly
    const currentProperties = lastValidPropertiesRef.current;

    if (!map || !currentProperties?.length) {
      console.log('Early return: no map or no properties');
      return;
    }

    if (area === null) {
      // Remove all highlights when selecting 'All Towns'
      highlightedAreasRef.current.forEach(highlightedArea => {
        removeHighlightLayer(highlightedArea);
      });
      highlightedAreasRef.current = new Set();
      return;
    } 

    if (highlightedAreasRef.current.has(area)) {

      // Remove highlight if clicking the same area
      removeHighlightLayer(area);
      highlightedAreasRef.current.delete(area);

      if(chartType === 'town') {
        // Find all streets in this town that are currently highlighted
        const streetsInTown = currentProperties
        .filter(p => p.town?.toLowerCase() === area?.toLowerCase())
        .map(p => p.street)
        .filter(Boolean);
      
        // Get unique streets
        const uniqueStreets = [...new Set(streetsInTown)];
        
        // Check which streets are currently highlighted and remove them
        uniqueStreets.forEach(street => {
          // Remove street highlight
          removeHighlightLayer(street);
        });
      }

    } else {
      // Add new highlight layer
      const points = chartType === 'town' 
        ? currentProperties.filter(p => p.town?.toLowerCase() === area?.toLowerCase())
        : currentProperties.filter(p => p.street?.toLowerCase() === area?.toLowerCase());

      if (points.length > 0) {
        addHighlightLayer(points, area, chartType === 'town' ? 'white' : 'black');
        highlightedAreasRef.current.add(area);
      }
    }
  }, [addHighlightLayer, removeHighlightLayer]);

  const setMapInstance = useCallback((mapInstance) => {
    mapRef.current = mapInstance;
    // Ensure the map is fully loaded before setting mapLoaded to true
    if (mapInstance) {
      setMapLoaded(true);
    } else if (mapInstance) {
      mapInstance.once('load', () => setMapLoaded(true));
    }
  }, []);

  return {
    mapRef,
    mapLoaded,
    selectedLegendStatus, 
    setSelectedLegendStatus,
    setMapInstance,
    updateMapColors,
    updateMapBounds,
    updateMarkerLayer,
    handleAreaClick
  };
}
