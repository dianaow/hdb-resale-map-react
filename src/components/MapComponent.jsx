import React, { useLayoutEffect, useEffect, useRef, forwardRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { TAG_COLORS, PROPERTY_TAGS } from '../constants';

const MapComponent = forwardRef(({
  properties,
  onMapLoaded,
  onMarkerClick
}, ref) => {
  const mapContainer = useRef(null);
  const mapInstance = useRef(null);
  const prevPropertiesRef = useRef(null);
  const layersInitializedRef = useRef(false);

  const createGeoJSON = (data) => {
    return {
      type: "FeatureCollection",
      features: data.map(d => ({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [d.lon, d.lat]
        },
        properties: {
          ...d
        }
      }))
    };
  };

  const updateDataSource = (map, data) => {
    if (!map) return;
    
    const dotsGeoJSON = createGeoJSON(data);
    
    // Check if the source exists
    if (map.getSource('markers')) {
      map.getSource('markers').setData(dotsGeoJSON);
    } else {
      // Add new source if it doesn't exist
      try {
        map.addSource('markers', {
          type: 'geojson',
          data: dotsGeoJSON,
          cluster: false,
          clusterMaxZoom: 13
        });
      } catch (error) {
        console.error('Error adding markers source:', error);
      }
    }
  };

  const initMapLayers = (map) => {
    // Check if all required layers exist
    if (map.getLayer('circle')) {
      layersInitializedRef.current = true;
      return; // Layers already exist
    }
    
    // First ensure the source exists
    if (!map.getSource('markers')) {
      try {
        map.addSource('markers', {
          type: 'geojson',
          data: createGeoJSON(properties),
          cluster: false,
          clusterMaxZoom: 13
        });
      } catch (error) {
        console.error('Error adding markers source:', error);
        return;
      }
    }

    // Try to add layers in a try-catch to handle any potential errors
    try {
      // Add cluster layer
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

      // Add cluster count layer
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

      // Add circle layer
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

      PROPERTY_TAGS.forEach(tag => {
        addSvgMarkerToMap(map, tag);
      });
      
      // Set the flag indicating layers are initialized
      layersInitializedRef.current = true;
    } catch (error) {
      console.error('Error adding map layers:', error);
    }
  }

  const initEventListeners = (map) => {
    // Avoid adding duplicate event listeners
    if (map.listeners && map.listeners.circle) {
      console.log('Skipping event listeners - already initialized');
      return;
    }
    console.log('initEventListeners', map);
    
    // Add popup
    const popup = new mapboxgl.Popup({
      closeButton: false,
      closeOnClick: false,
      anchor: 'top'
    });

    // Add event listeners with current state
    map.on('mouseenter', 'circle', function(e) {
      map.getCanvas().style.cursor = 'pointer';
      const coordinates = e.features[0].geometry.coordinates.slice();
      const properties = e.features[0].properties;

      const description = `
        <div>
          <p style="font-weight: bold; font-size: 13px; color: black">${properties.address}</p>
          <h4>${properties.street}</h4>
          <h4>Completed in: ${new Date(properties.date).getFullYear()}</h4>
          <h4>Total units: ${properties.total_units}</h4>
          <h4>Max floor level: ${properties.max_floor_lvl}</h4>
        </div>
      `;

      while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
        coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
      }

      popup
        .setLngLat(coordinates)
        .setHTML(description)
        .addTo(map);
    });

    // Add mouseleave event
    map.on('mouseleave', 'circle', function() {
      map.getCanvas().style.cursor = '';
      popup.remove();
    });

    // Add click event
    map.on('click', 'circle', function(e) {
      const street = e.features[0].properties.street;
      const town = e.features[0].properties.town;
      // Always use 'street' as the type for map marker clicks
      onMarkerClick(street, town, 'street');
    });
    
    // Track that we've added listeners to avoid duplicates
    // Fix: use the same property name as in the check above
    map.listeners = map.listeners || {};
    map.listeners.circle = true;
  }

  // Handle data updates when properties change
  useEffect(() => {
    const map = mapInstance.current;

    if (!map || !properties || properties.length === 0) {
      return;
    }
    
    // Store the current properties to reference later
    prevPropertiesRef.current = properties;

    const updateMapData = () => {
      // Update the data source
      updateDataSource(map, properties);
      
      // Initialize layers and event listeners if they don't exist yet
      if (!layersInitializedRef.current) {
        initMapLayers(map);
        initEventListeners(map);
      }
    };
    
    // Check if map is already loaded
    try {
      if (map.loaded()) {
        updateMapData();

        // Let parent know map is ready
        onMapLoaded(map);
        
      } else {
        // Set up map load event handler if not yet loaded
        map.on('load', updateMapData);
      }
    } catch (error) {
      console.error('Error updating map data:', error);
    }
  }, [properties]); // Only depends on properties changes

  // Initialize map
  useLayoutEffect(() => {
    if (!mapContainer.current || mapInstance.current) {
      return;
    }

    const accessToken = import.meta.env.VITE_ACCESS_TOKEN;
    const style = import.meta.env.VITE_MAPBOX_STYLE;

    // Create a map instance
    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style,
      accessToken,
      center: [103.9, 1.35],
      zoom: 12.2,
      antialias: true,
      maxZoom: 18,
      minZoom: 10
    });

    map.on('error', (error) => {
      console.error('Map error:', error);
    });

    // Store map instance
    mapInstance.current = map;
    
    // Assign to the external ref if it exists
    if (ref) {
      ref.current = map;
    }

    // Cleanup
    return () => {
      layersInitializedRef.current = false;
      if (map) {
        map.remove();
        mapInstance.current = null;
        if (ref) {
          ref.current = null;
        }
      }
    };
  }, []); // Only run once on mount

  return <div ref={mapContainer} id="map" />;
});

function addSvgMarkerToMap(map, markerId, color) {
  // Skip if the image or layer already exists
  if (map.hasImage(markerId) || map.getLayer(`${markerId}-icon`)) {
    return;
  }

  // Create the SVG with the specified circle color but with smaller initial dimensions
  const circleSVG = `
    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
      <circle cx="20" cy="20" r="16" fill="${TAG_COLORS[markerId] || color}" />
    </svg>`;

  const svgUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(circleSVG)}`;

  // Create an image element with smaller initial size
  const img = new Image(20, 20); // Reduced from 40,40 for better initial scale
  
  img.onload = () => {
    try {
      if (!map.hasImage(markerId)) {
        map.addImage(markerId, img);
      }

      if (!map.getLayer(`${markerId}-icon`)) {
        map.addLayer({
          id: `${markerId}-icon`,
          type: 'symbol',
          source: 'markers',
          filter: [
            'all',
            ['!', ['has', 'point_count']],
            ['==', ['get', 'tag'], markerId]
          ],
          layout: {
            visibility: 'none',
            'icon-image': markerId,
            'icon-size': [
              'interpolate',
              ['linear'],
              ['zoom'],
              // Start scaling earlier and use more intermediate zoom levels
              10, [ // Start at zoom 10 instead of 12
                'interpolate',
                ['linear'],
                ['get', 'total_units'],
                0, 0.3,    // Smaller initial size
                50, 0.4,
                100, 0.5,
                200, 0.6,
                300, 0.7
              ],
              12, [ // Add intermediate zoom level
                'interpolate',
                ['linear'],
                ['get', 'total_units'],
                0, 0.5,
                50, 0.6,
                100, 0.7,
                200, 0.8,
                300, 0.9
              ],
              15, [ // Add intermediate zoom level
                'interpolate',
                ['linear'],
                ['get', 'total_units'],
                0, 0.7,
                50, 0.8,
                100, 0.9,
                200, 1.0,
                300, 1.1
              ],
              18, [
                'interpolate',
                ['linear'],
                ['get', 'total_units'],
                0, 0.9,
                50, 1.0,
                100, 1.1,
                200, 1.2,
                300, 1.3
              ]
            ],
            'icon-pitch-alignment': 'map',
            'icon-rotation-alignment': 'map',
            'symbol-spacing': 1,
            'icon-allow-overlap': true,
            'text-allow-overlap': true
          },
        });
      }
    } catch (error) {
      console.error(`Error adding marker for ${markerId}:`, error);
    }
  };

  img.src = svgUrl;
}

export default MapComponent;