import React, { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import * as d3 from 'd3';

// Chart configuration
const CHART_CONFIG = {
  margin: { top: 30, right: 20, bottom: 30, left: 30 },
  axisColor: '#D4d4d4',
  tooltipBgColor: '#333',
  defaultOptions: {
    y: 'price',
    groupBy: 'town',
    title: null,
    subtitle: 'Click on a circle to locate on map. Click again to deselect.'
  }
};

// Utility functions
const makeSafeKey = (key) => key?.toString().replace(/[^a-zA-Z0-9]/g, '_') || '';

const formatDate = (date) => date.toLocaleDateString(undefined, {
  year: 'numeric',
  month: 'short',
});

const createScales = (data, width, height, y) => {
  const dateExtent = d3.extent(data, d => new Date(d.date));
  const xScale = d3.scaleTime()
    .domain([d3.timeYear.floor(dateExtent[0]), dateExtent[1]])
    .range([CHART_CONFIG.margin.left, width - CHART_CONFIG.margin.right]);

  const yExtent = d3.extent(data, d => d[y]);
  const yBuffer = (yExtent[1] - yExtent[0]) * 0.05;
  const yScale = d3.scaleLinear()
    .domain([yExtent[0] - yBuffer, yExtent[1] + yBuffer])
    .range([height - CHART_CONFIG.margin.bottom, CHART_CONFIG.margin.top]);

  return { xScale, yScale, dateExtent };
};

const createColorScale = (highlighted) => {
  return d3.scaleOrdinal()
    .domain(highlighted)
    .range(['#a21caf', '#d946ef', '#f0abfc', '#f0abfc', '#d946ef', '#a21caf']);
};

const ResalePricesChart = forwardRef(({
  data,
  userOptions,
  onDotClick
}, ref) => {
  const chartRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const selectedItemsRef = useRef([]);
  const chartStateRef = useRef({
    highlighted: new Set(),
    colorScale: null,
    tooltip: null,
    xScale: null,
    yScale: null
  });

  const options = { ...CHART_CONFIG.defaultOptions, ...userOptions };
  const { groupBy, title, subtitle, y } = options;

  // Update dots for each data point
  const updateDotsAppearance = useCallback((hoveredDotData = null, items = selectedItemsRef.current) => {
    const hoveredName = hoveredDotData && hoveredDotData[groupBy];

    const { svg, xScale, yScale, colorScale, highlighted, tooltip } = chartStateRef.current;
    
    // Update visual appearance of dots
    svg.selectAll('.dot').each(function(dotData) {
      if (!dotData) return;
      
      const element = d3.select(this);
      const dotName = dotData[groupBy];
      const isHovered = hoveredName && dotName === hoveredName;
      const isSelected = items.includes(dotName);
      
      // Update the data-selected attribute
      element.attr("data-selected", isSelected ? "true" : "false");

      const style = getPointStyle(dotName, isSelected, isHovered, items.length > 0, highlighted, colorScale);
      element
        .style('fill', style.fill)
        .style('opacity', style.opacity)
        .attr('r', style.radius);
    });

    // Handle tooltip positioning and content
    if (tooltip && hoveredDotData) {
      const hoveredPrice = hoveredDotData[y] || 0;
      const hoveredDate = new Date(hoveredDotData.date);
      
      tooltip.select(".tooltip-title").text(hoveredName);
      tooltip.select(".tooltip-price").text(`${y}: $${hoveredPrice.toLocaleString()}`);
      tooltip.select(".tooltip-date").text(`Date: ${formatDate(hoveredDate)}`);
      
      const tooltipWidth = Math.max(
        ...['title', 'price', 'date'].map(c => 
          tooltip.select(`.tooltip-${c}`).node().getComputedTextLength()
        )
      ) + 16;
      
      tooltip.select(".tooltip-bg").attr("width", tooltipWidth);
      
      const tooltipX = Math.min(
        xScale(hoveredDate) - tooltipWidth / 2,
        dimensions.width - CHART_CONFIG.margin.right - tooltipWidth
      );
      const tooltipY = Math.max(
        yScale(hoveredPrice) - 70,
        CHART_CONFIG.margin.top
      );
      
      tooltip
        .attr("transform", `translate(${tooltipX}, ${tooltipY})`)
        .transition()
        .duration(200)
        .style("opacity", 1);
    } else if (tooltip) {
      tooltip
        .transition()
        .duration(200)
        .style("opacity", 0);
    }

  }, [groupBy, y, dimensions]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (chartRef.current) {
        const parent = chartRef.current.parentElement;
        setDimensions({
          width: parent.clientWidth,
          height: parent.clientHeight
        });
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Expose highlight dots method
  useImperativeHandle(ref, () => ({
    highlightDots: (name) => {
      if (!chartRef.current) return;
      
      const svg = d3.select(chartRef.current).select('svg');
      if (!svg.empty()) {
        const isSelected = selectedItemsRef.current.includes(name);
        const newSelectedItems = isSelected 
          ? selectedItemsRef.current.filter(item => item !== name)
          : [...selectedItemsRef.current, name];
          
        // Update the ref directly
        selectedItemsRef.current = newSelectedItems;
        updateDotsAppearance(null, newSelectedItems);
      }
    }
  }), [updateDotsAppearance, groupBy]);

  // Main chart rendering effect
  useEffect(() => {
    if (!data?.length || !chartRef.current || !dimensions.width) return;

    if(groupBy === 'town') {
      // Filter selectedItemsRef to only keep items that exist in the current data
      const availableItemsInData = new Set(data.map(d => d[groupBy]));
      selectedItemsRef.current = selectedItemsRef.current.filter(item => 
        availableItemsInData.has(item)
      );
    }

    const { width, height } = dimensions;
    const svg = initializeSvg(chartRef.current, width, height);
    const { xScale, yScale, dateExtent } = createScales(data, width, height, y);
    
    const sixMonthsAgo = new Date(dateExtent[1]);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);

    const { highlighted, topThree, bottomThree } = processData(data, groupBy, y, sixMonthsAgo);
    const colorScale = createColorScale(highlighted);

    createAxes(svg, xScale, yScale, width, height);
    if (title) createTitle(svg, title, width);
    if (subtitle) createSubtitle(svg, subtitle, width);
    
    const tooltip = createTooltip(svg);
    createLegend(svg, topThree, bottomThree, colorScale, y, sixMonthsAgo, dateExtent[1]);

    // Update ref with current state:
    chartStateRef.current = {
      svg,
      highlighted,
      colorScale,
      tooltip,
      xScale,
      yScale
    };

    // Create dots for each data point
    // Group data by the groupBy field
    const grouped = Array.from(d3.group(data, d => d[groupBy]))
      .map(([key, values]) => ({
        key,
        values: values.sort((a, b) => new Date(a.date) - new Date(b.date))
      }));

    // Add dots for each group
    grouped.forEach(type => {
      const validDataPoints = type.values.filter(d => 
        d[y] !== null && d[y] !== undefined && !isNaN(d[y])
      );
      
      const safeKey = makeSafeKey(type.key);

      // Add dots
      svg.selectAll(`.dot-${safeKey}`)
        .data(validDataPoints)
        .enter()
        .append("circle")
        .attr("class", `dot dot-${safeKey}`)
        .attr("data-town", type.key)
        .attr("data-selected", selectedItemsRef.current.includes(type.key) ? "true" : "false")
        .attr("cx", d => xScale(new Date(d.date)))
        .attr("cy", d => yScale(d[y]))
        .attr("r", highlighted.has(type.key) ? 3 : 2)
        .style("fill", highlighted.has(type.key) ? colorScale(type.key) : CHART_CONFIG.axisColor)
        .style("opacity", highlighted.has(type.key) ? 0.8 : 0.3)
        .style("cursor", "pointer")
        .on("mouseover", function(event, d) {
          updateDotsAppearance(d, selectedItemsRef.current);
        })
        .on("mouseout", function(event, d) {
          // Check if this dot is selected using the data attribute
          const isSelected = d3.select(this).attr("data-selected") === "true";
          
          // Only update appearance if not selected
          if (!isSelected) {
            updateDotsAppearance(null, selectedItemsRef.current);
          }
        })
        .on("click", function(event, d) {
          const clickedName = d[groupBy];

          // Directly update the ref
          const isSelected = selectedItemsRef.current.includes(clickedName);
          const newSelectedItems = isSelected 
            ? selectedItemsRef.current.filter(item => item !== clickedName)
            : [...selectedItemsRef.current, clickedName];

          // Update all dots with the same town name
          svg.selectAll('.dot').each(function(dotData) {
            if (dotData && dotData[groupBy] === clickedName) {
              d3.select(this).attr("data-selected", !isSelected ? "true" : "false");
            }
          });
          
          selectedItemsRef.current = newSelectedItems;
          onDotClick(clickedName, groupBy);
          updateDotsAppearance(null, newSelectedItems);
        });
      });

      // Apply existing selections after all dots are created
      if (selectedItemsRef.current.length > 0) {
        // Use a slight delay to ensure all DOM elements are ready
        setTimeout(() => {
          updateDotsAppearance(null, selectedItemsRef.current);
        }, 0);
      }
  }, [data, dimensions, updateDotsAppearance, onDotClick, y, groupBy]);

  return (
    <div id='chart-resale-prices'>
        {data?.length === 0 ? (
          <div>No data available...</div>
        ) : (
          <div ref={chartRef} style={{ width: '100%', height: '100%' }} />
        )}
    </div>
  );
});

// Helper functions for chart creation
const initializeSvg = (container, width, height) => {
  d3.select(container).selectAll("*").remove();
  return d3.select(container)
    .append("svg")
    .attr("width", width)
    .attr("height", height)
    .append("g");
};

const getPointStyle = (dotName, isSelected, isHovered, hasSelections, highlighted, colorScale) => {
  if (isSelected || isHovered) {
    return {
      fill: highlighted.has(dotName) ? colorScale(dotName) : 'white',
      opacity: 0.8,
      radius: (highlighted.has(dotName) ? 2.5 : 2) * 1.35
    };
  }
  
  if (hasSelections) {
    return {
      fill: CHART_CONFIG.axisColor,
      opacity: 0.3,
      radius: 2
    };
  }

  if (highlighted.has(dotName)) {
    return {
      fill: colorScale(dotName),
      opacity: 0.8,
      radius: 2.5
    };
  }
  
  return {
    fill: CHART_CONFIG.axisColor,
    opacity: 0.3,
    radius: 2
  };
};

const processData = (data, groupBy, y, sixMonthsAgo) => {
  const groups = Array.from(d3.group(data, d => d[groupBy]));
  const averages = groups.map(([key, values]) => ({
    key,
    totalAveragePrice: d3.mean(
      values.filter(d => new Date(d.date) >= sixMonthsAgo),
      d => d[y]
    )
  }))
  .filter(d => d.totalAveragePrice)
  .sort((a, b) => b.totalAveragePrice - a.totalAveragePrice);

  const topThree = averages.slice(0, 3);
  const bottomThree = averages.slice(-2).reverse();
  const highlighted = new Set([...topThree, ...bottomThree].map(d => d.key));

  return { highlighted, topThree, bottomThree };
};

const createAxes = (svg, xScale, yScale, width, height) => {
  // X-axis
  svg.append("g")
    .attr("class", "x-axis")
    .attr("transform", `translate(0,${height - CHART_CONFIG.margin.bottom})`)
    .call(d3.axisBottom(xScale).tickSize(0).ticks(6))
    .call(g => {
      g.selectAll("text")
        .attr('fill', CHART_CONFIG.axisColor)
        .style('font-size', '11px');
      g.selectAll("line")
        .attr('stroke', CHART_CONFIG.axisColor);
      g.select(".domain").remove();
    });

  // Y-axis
  svg.append("g")
    .attr("class", "y-axis")
    .attr("transform", `translate(${CHART_CONFIG.margin.left},0)`)
    .call(d3.axisLeft(yScale)
      .tickSize(-width + CHART_CONFIG.margin.right + CHART_CONFIG.margin.left)
      .ticks(5)
      .tickFormat(d3.format("~s")))
    .call(g => {
      g.selectAll("line")
        .attr('stroke', '#525252')
        .attr('stroke-width', 0.7)
        .attr('opacity', 0.3);
      g.selectAll("text")
        .attr('fill', CHART_CONFIG.axisColor)
        .style('font-size', '10px');
      g.select(".domain").remove();
    });
};

const createTitle = (svg, title, width) => {
  svg.append("text")
    .attr("class", "title")
    .attr("x", width / 2)
    .attr("y", CHART_CONFIG.margin.top / 2)
    .style("text-anchor", "middle")
    .style("font-size", "15px")
    .attr("fill", CHART_CONFIG.axisColor)
    .text(title);
};

const createSubtitle = (svg, subtitle, width) => {
  svg.append("text")
    .attr("class", "subtitle")
    .attr("x", width / 2)
    .attr("y", CHART_CONFIG.margin.top - 5)
    .style("text-anchor", "middle")
    .style("font-size", "11px")
    .attr("fill", "#9ca3af")
    .text(subtitle);
};

const createTooltip = (svg) => {
  const tooltip = svg.append("g")
    .attr("class", "tooltip-group")
    .style("pointer-events", "none")
    .style("opacity", 0);
  
  tooltip.append("rect")
    .attr("class", "tooltip-bg")
    .attr("rx", 4)
    .attr("ry", 4)
    .attr("width", 120)
    .attr("height", 60)
    .attr("fill", CHART_CONFIG.tooltipBgColor)
    .attr("opacity", 0.9);
  
  tooltip.append("text")
    .attr("class", "tooltip-title")
    .attr("x", 8)
    .attr("y", 15)
    .attr("fill", "white")
    .style("font-weight", "bold")
    .style("font-size", "12px");
  
  tooltip.append("text")
    .attr("class", "tooltip-price")
    .attr("x", 8)
    .attr("y", 32)
    .attr("fill", "white")
    .style("font-size", "11px");
  
  tooltip.append("text")
    .attr("class", "tooltip-date")
    .attr("x", 8)
    .attr("y", 48)
    .attr("fill", "white")
    .style("font-size", "11px");
  
  return tooltip;
};

const createLegend = (svg, topThree, bottomThree, colorScale, y, sixMonthsAgo, endDate) => {
  const legend = svg.append("g")
    .attr("class", "chart-legend")
    .attr("transform", `translate(${CHART_CONFIG.margin.left + 5}, ${CHART_CONFIG.margin.top + 5})`);

  const fromDate = formatDate(sixMonthsAgo);
  const toDate = formatDate(endDate);

  // Add highest title and items
  legend.append("text")
    .attr("class", "highest-title")
    .attr("y", 0)
    .style("font-size", "11px")
    .style("font-weight", "bold")
    .attr("fill", CHART_CONFIG.axisColor)
    .text(`Highest ${y} from ${fromDate} to ${toDate}`);

  topThree.forEach((item, i) => {
    legend.append("text")
      .attr("class", `top-item item-${makeSafeKey(item.key)}`)
      .attr("y", 16 + i * 16)
      .style("font-size", "10px")
      .style("fill", colorScale(item.key))
      .text(item.key);
  });

  // Add lowest title and items
  legend.append("text")
    .attr("class", "lowest-title")
    .attr("y", 16 + 3 * 16 + 16)
    .style("font-size", "11px")
    .style("font-weight", "bold")
    .attr("fill", CHART_CONFIG.axisColor)
    .text(`Lowest ${y} from ${fromDate} to ${toDate}`);

  bottomThree.forEach((item, i) => {
    legend.append("text")
      .attr("class", `bottom-item item-${makeSafeKey(item.key)}`)
      .attr("y", 16 + 3 * 16 + 16 + 16 + i * 16)
      .style("font-size", "10px")
      .style("fill", colorScale(item.key))
      .text(item.key);
  });

  return legend;
};

export default React.memo(ResalePricesChart);