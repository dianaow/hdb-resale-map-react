import { useState, useEffect, useCallback, useRef } from 'react';
import * as d3 from 'd3';
import { TAG_COLORS, PRICE_THRESHOLDS, AGE_THRESHOLDS, PRICE_COLORS } from '../constants';

export function useData(selectedTowns) {
  const API_ENDPOINT = import.meta.env.VITE_API_ENDPOINT;

  const [properties, setProperties] = useState([]);
  const [geojson, setGeojson] = useState(null);
  const [aggTownPrices, setAggTownPrices] = useState([]);
  const [aggStreetPrices, setAggStreetPrices] = useState([]);
  const [streetPrices, setStreetPrices] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDynamicDataLoading, setIsDynamicDataLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Use ref to properly track previous values
  const prevSelectedTownsRef = useRef([]);
  
  // Memoize functions that don't depend on state
  const isValidNumber = useCallback((value) => {
    return value !== null && 
            value !== undefined && 
            value !== "NaN" &&
            !isNaN(value);
  }, []);

  const getPriceColor = useCallback((price) => {
    const colorPrice = d3.scaleThreshold()
      .domain(PRICE_THRESHOLDS.slice(1))
      .range(PRICE_COLORS);
    return colorPrice(price);
  }, []);
  
  const getAgeColor = useCallback((age) => {
    const colorAge = d3.scaleSequential()
      .domain([AGE_THRESHOLDS[0], AGE_THRESHOLDS[AGE_THRESHOLDS.length - 1]])
      .interpolator(d3.interpolateBuPu);
    return colorAge(age);  
  }, []);

  // Memoize helper functions
  const parseQuarter = useCallback((quarterString) => {
    if (!quarterString) return null;
    
    const year = +quarterString.slice(0, 4);
    const quarter = +quarterString.slice(6, 7);
    const month = ((quarter - 1) * 3) + 2;
    
    return new Date(year, month, 1);
  }, []);
  
  const processPrice = useCallback((price) => {
    return {
      ...price,
      date: parseQuarter(price.quarter) || new Date(price.date),
      price: isValidNumber(price.price) ? +price.price : null
    };
  }, [parseQuarter, isValidNumber]);
  
  // Fetch initial data only once
  useEffect(() => {
    let isMounted = true;
    
    async function fetchData() {
      try {
        setIsLoading(true);
        //console.log("Fetching initial data...");
        
        const endpoints = [
          `${API_ENDPOINT}/api/properties`,
          `${API_ENDPOINT}/api/agg_prices`,
          `${API_ENDPOINT}/api/geojson`,
          `${API_ENDPOINT}/api/agg_address_prices`
        ];
        
        const fetchPromises = endpoints.map(endpoint => 
          fetch(endpoint)
            .then(response => {
              if (!response.ok) {
                throw new Error(`HTTP error ${response.status} for ${endpoint}`);
              }
              return response.json();
            })
        );

        const results = await Promise.all(fetchPromises);
        
        if (!isMounted) return;

        // Process properties data efficiently
        const processedProperties = results[0].properties.map(d => ({
          ...d,
          age: new Date().getFullYear() - (+d['year']),
          date: d3.timeParse("%Y")(d['year']),
          block: extractFirstNumber(d['address']),
          color: TAG_COLORS[d.tag] || "#000000",
          ageColor: getAgeColor(new Date().getFullYear() - (+d['year']))
        }));

        // Process price data with the memoized function
        const prices = JSON.parse(results[1].prices)
          .map(processPrice)
          .filter(d => d.date !== null); // Filter out invalid dates

        setProperties(processedProperties);
        setGeojson(results[2].geojson);
        setAggTownPrices(prices);
        setStreetPrices(JSON.parse(results[3].prices));
        
        //console.log("Initial data fetched successfully", prices);
      } catch (err) {
        if (isMounted) {
          console.error("Error fetching initial data:", err);
          setError(err.message || 'Error loading data');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
          console.log("Data loading complete");
        }
      }
    }

    fetchData();
    
    return () => {
      isMounted = false;
    };
  }, [processPrice]);

  // Fetch dynamic data when selectedTowns changes
  useEffect(() => {
    // Cancel active requests
    const controller = new AbortController();
    const signal = controller.signal;
    let isMounted = true;
    
    async function fetchDynamicData() {
      try {
        // Check if selectedTowns has actually changed (deep comparison)
        const currentTowns = JSON.stringify(selectedTowns || []);
        const prevTowns = JSON.stringify(prevSelectedTownsRef.current || []);
        
        // Update reference for next comparison
        prevSelectedTownsRef.current = selectedTowns ? [...selectedTowns] : [];
        
        if (currentTowns === prevTowns) {
          //console.log("Town selection unchanged, skipping fetch");
          return; // Skip fetch if selection hasn't changed
        }
        
        if (!selectedTowns || selectedTowns.length === 0) {
          //console.log("No towns selected, clearing street prices");
          setAggStreetPrices([]);
          return;
        }
        
        // Set loading state before fetch
        setIsDynamicDataLoading(true);

        // Prepare date parameters
        const currentDate = new Date();
        const currentYearMonth = currentDate.getFullYear() + '-' + String(currentDate.getMonth() + 1).padStart(2, '0');
        const threeYearsAgo = new Date();
        threeYearsAgo.setFullYear(currentDate.getFullYear() - 3);
        const threeYearsAgoYearMonth = threeYearsAgo.getFullYear() + '-' + String(threeYearsAgo.getMonth() + 1).padStart(2, '0');

        // Build endpoint URL
        let endpoint;
        if (selectedTowns[0] === 'All Towns') {
          endpoint = `${API_ENDPOINT}/api/prices?start_date=${threeYearsAgoYearMonth}&end_date=${currentYearMonth}`;
        } else {
          endpoint = `${API_ENDPOINT}/api/prices?towns=${encodeURIComponent(selectedTowns.join(','))}&start_date=${threeYearsAgoYearMonth}&end_date=${currentYearMonth}`;
        }

        console.log("Fetching from endpoint:", endpoint);
        
        // Fetch data
        const response = await fetch(endpoint, { signal });
        
        if (!response.ok) {
          throw new Error(`HTTP error ${response.status} for ${endpoint}`);
        }
        
        const result = await response.json();

        // Check if component is still mounted
        if (!isMounted) return;

        //console.log("Dynamic data fetched, processing...");
        
        // Process price data
        const prices = JSON.parse(result.prices)
          .map(processPrice)
          .filter(d => d.date !== null);

        //console.log(`Processed ${prices.length} street prices`);
        
        // Update state with new data
        setAggStreetPrices(prices);
      } catch (err) {
        // Only set error if it's not an abort error
        if (isMounted && err.name !== 'AbortError') {
          //console.error("Error fetching dynamic data:", err);
          setError(err.message || 'Error loading dynamic data');
          setAggStreetPrices([]);
        }
      } finally {
        // Reset loading state
        if (isMounted) {
          setIsDynamicDataLoading(false);
          console.log("Dynamic data loading complete");
        }
      }
    }

    // Execute fetch with a small delay to allow UI to update first
    // This helps prevent the UI from feeling sluggish
    const timer = setTimeout(fetchDynamicData, 200);
    
    return () => {
      // Clean up
      clearTimeout(timer);
      controller.abort();
      isMounted = false;
    };
  }, [selectedTowns, processPrice]);
  
  return {
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
    getPriceColor,
    getAgeColor
  };
}

// Helper functions kept outside the component for better performance
function extractFirstNumber(str) {
  if (!str) return null;
  const match = str.match(/\d+[A-Za-z]*/);
  return match ? match[0] : null;
}