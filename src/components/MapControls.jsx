import React, { useState, useEffect } from 'react';
import { PROPERTY_TAGS } from '../constants';

const MapControls = ({ 
  mapRef, 
  selectedTowns, 
  selectedLegendStatus,
  mapLoaded
}) => {
  const [pitchButtonText, setPitchButtonText] = useState('Display in 3D');
  const [clusterButtonText, setClusterButtonText] = useState('Enable Clustering');

  // Calculate if clustering is possible based on current state
  const canCluster = mapLoaded && 
                    (selectedTowns.length === 0 || selectedTowns[0] === "All Towns") && 
                    selectedLegendStatus === 'tag' && 
                    mapRef.current?.getPitch() === 0;

  // Effect to update button text when map pitch changes
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    
    const updatePitchButton = () => {
      const pitch = mapRef.current.getPitch();
      setPitchButtonText(pitch > 0 ? 'Display in 2D' : 'Display in 3D');
    };
    
    // Set initial state
    updatePitchButton();
    
    // Listen for pitch changes
    mapRef.current.on('pitch', updatePitchButton);
    
    return () => {
      if (mapRef.current) {
        mapRef.current.off('pitch', updatePitchButton);
      }
    };
  }, [mapLoaded]);

  const handlePitchToggle = () => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    if (map.getPitch() === 0) {
      // Change to 3D view
      map.easeTo({ pitch: 60, duration: 1000, zoom: 14.6 });
      
      // Show 3D buildings if available
      PROPERTY_TAGS.forEach(tag => {
        try {
          if (map.getLayer(tag + '-icon')) {
            map.setLayoutProperty(tag + '-icon', 'visibility', 'visible');
          }
        } catch (e) {
          console.warn(`Layer ${tag}-icon not found`);
        }
      });
      
      try {
        if (map.getLayer('circle')) {
          map.setLayoutProperty('circle', 'visibility', 'none');
        }
      } catch (e) {
        console.warn('Layer circle not found');
      }
    } else {
      // Change to 2D view
      map.easeTo({ pitch: 0, duration: 1000, zoom: 12.2 });
      
      // Hide 3D buildings
      PROPERTY_TAGS.forEach(tag => {
        try {
          if (map.getLayer(tag + '-icon')) {
            map.setLayoutProperty(tag + '-icon', 'visibility', 'none');
          }
        } catch (e) {
          console.warn(`Layer ${tag}-icon not found`);
        }
      });
      
      try {
        if (map.getLayer('circle')) {
          map.setLayoutProperty('circle', 'visibility', 'visible');
        }
      } catch (e) {
        console.warn('Layer circle not found');
      }
    }
  };

  const handleClusterToggle = () => {
    const map = mapRef.current;
    if (!map || !mapLoaded || !canCluster) return;

    try {
      const newClusterState = toggleClustering(map);
      setClusterButtonText(newClusterState ? 'Disable Clustering' : 'Enable Clustering');
    } catch (error) {
      console.error("Error toggling clustering:", error);
    }
  };

  return (
    <div style={{ display: 'flex' }}>
      <div
        className={`button ${!mapLoaded ? 'button-disabled' : ''}`}
        id="pitch-button"
        onClick={mapLoaded ? handlePitchToggle : undefined}
        style={{
          cursor: mapLoaded ? 'pointer' : 'not-allowed',
          opacity: mapLoaded ? '1' : '0.5'
        }}
      >
        {pitchButtonText}
      </div>
      <div
        className={`button ${!canCluster ? 'button-disabled' : ''}`}
        id="cluster-button"
        onClick={canCluster ? handleClusterToggle : undefined}
        style={{
          cursor: canCluster ? 'pointer' : 'not-allowed',
          opacity: canCluster ? '1' : '0.5'
        }}
      >
        {clusterButtonText}
      </div>
      <p style={{ fontSize: '10px', paddingTop: '10px' }}>
        Click on marker to show resale prices of properties within the same street
      </p>
    </div>
  );
};

// Helper function for toggling clustering
function toggleClustering(map) {
  if (!map || !map.getSource) return false;
  
  let isCurrentlyClustered = false;
  const source = map.getSource('markers');
  
  if (source) {
    try {
      // Get current data and cluster state
      const currentData = source._data || {
        type: "FeatureCollection",
        features: []
      };
      isCurrentlyClustered = source._options.cluster === true;
      
      // Find all layers that use this source
      const dependentLayers = [];
      map.getStyle().layers.forEach(layer => {
        if (layer.source === 'markers') {
          dependentLayers.push(layer.id);
        }
      });
      
      // Remove dependent layers
      dependentLayers.forEach(layerId => {
        map.removeLayer(layerId);
      });
      
      // Remove and recreate source with opposite cluster setting
      map.removeSource('markers');
      
      map.addSource('markers', {
        type: 'geojson',
        data: currentData,
        cluster: !isCurrentlyClustered,
        clusterMaxZoom: 13,
        clusterRadius: 50
      });
      
      // Add cluster-specific layers if newly clustered
      if (!isCurrentlyClustered) {
        map.addLayer({
          id: 'clusters',
          type: 'circle',
          source: 'markers',
          filter: ['has', 'point_count'],
          paint: {
            'circle-color': "#FF00FF",
            'circle-radius': [
              'step',
              ['get', 'point_count'],
              8, 50,
              16, 100,
              24, 300,
              36, 800,
              48
            ]
          }
        });
        
        map.addLayer({
          id: 'cluster-count',
          type: 'symbol',
          source: 'markers',
          filter: ['has', 'point_count'],
          layout: {
            'text-field': ['get', 'point_count_abbreviated'],
            'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
            'text-size': 12
          }
        });
      }
      
      // Re-add the circle layer
      map.addLayer({
        'id': 'circle',
        'type': 'circle',
        'source': 'markers',
        filter: ['!', ['has', 'point_count']],
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
          'circle-color': ['get', 'color']
        }
      });
      
      return !isCurrentlyClustered;
    } catch (error) {
      console.error("Error in toggleClustering:", error);
      return isCurrentlyClustered;
    }
  }
  
  return false;
}

export default MapControls;