import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { TAG_COLORS, PROPERTY_TAGS } from '../constants';

const TimelineChart = ({ properties, yearRange, setYearRange }) => {
  const chartRef = useRef(null);
  const brushRef = useRef(null);
  const [brushSelection, setBrushSelection] = useState(null);
  
  useEffect(() => {
    const year_range = [1960, new Date().getFullYear()]
    const years = d3.range(year_range[0], year_range[1])

    if (!chartRef.current || !properties || properties.length === 0) return;

    const data = nestData(properties);
    const res_nested = Array.from(d3.group(data, d => d.tag))
      .map(([key, values]) => ({
        key,
        values: values.sort((a, b) => yearRange[0] + years.indexOf(parseYear(a.town)) - yearRange[0] + years.indexOf(parseYear(b.town)))
      }));

    const chart = d3.select(chartRef.current);
    chart.selectAll("*").remove();

    const rect = chart.node().getBoundingClientRect();
    const svg = chart.append("svg")
      .attr("width", rect.width)
      .attr("height", rect.height);

    const group = svg.append('g');

    const margin = { top: 20, right: 30, bottom: 30, left: 30 };

    const xScale = d3.scaleTime()
      .domain(d3.extent(years, d => parseYear(d)))
      .range([margin.left, rect.width - margin.right]);

    const yScale = d3.scaleSqrt()
      .domain([0, d3.max(res_nested.map(d => d.values).flat(), d => d.value)])
      .range([rect.height - margin.bottom, margin.top]);

    // Add title
    group.append('text')
      .attr('class', 'title')
      .attr("transform", `translate(${5},${10})`)
      .style('font-size', '12px')
      .style('font-family', 'Montserrat')
      .attr('fill', '#fff')
      .text('Cumulative number of HDB properties completed');

    group.append('text')
      .attr('class', 'subtitle')
      .attr("transform", `translate(${(rect.width - margin.right) / 2},${26})`)
      .style('text-anchor', 'middle')
      .style('font-size', '11px')
      .attr('fill', "#9ca3af")
      .text('Drag to select time range');

    // Add x-axis
    group.append("g")
      .attr("transform", `translate(0,${rect.height - margin.bottom})`)
      .call(d3.axisBottom(xScale).tickSize(0).ticks(6))
      .call(g => {
        g.selectAll("text")
          .attr('fill', '#d4d4d4')
          .style('font-size', '11px');
        g.selectAll("line")
          .attr('stroke', '#d4d4d4');
        g.select(".domain").remove();
      });

    // Add y-axis
    group.append("g")
      .attr("transform", `translate(${margin.left},0)`)
      .call(d3.axisLeft(yScale).tickSize(-rect.width + margin.right).ticks(3).tickFormat(d3.format("~s")))
      .call(g => {
        g.selectAll("line")
          .attr('stroke', '#525252')
          .attr('stroke-width', 0.7)
          .attr('opacity', 0.3);

        g.selectAll("text")
          .attr('fill', '#d4d4d4')
          .style('font-size', '10px');
        g.select(".domain").remove();
      });

    const line = d3.line()
      .x(d => xScale(d.town))
      .y(d => yScale(d.value));

    const glines = group.selectAll('.line-group')
      .data(res_nested, d => d.key);

    const entered_lines = glines.enter()
      .append('g')
      .attr('class', 'line-group');

    entered_lines.append('path')
      .attr('class', 'line');

    glines.merge(entered_lines)
      .select('.line')
      .attr('d', d => line(d.values))
      .style('stroke', (d, i) => TAG_COLORS[d.key] || '#000000')
      .style('fill', 'none')
      .style('opacity', 0.8)
      .style('stroke-width', '1.5px')
      .style('stroke-cap', 'round');

    glines.exit().remove();

    // Add brush with persistent selection
    const brush = d3.brushX()
      .extent([[margin.left, margin.top], [rect.width - margin.right, rect.height - margin.bottom]])
      .on("brush end", (event) => {
        if (!event.sourceEvent) return; // Only transition after input
        if (!event.selection) return; // Ignore empty selections
        
        const s = event.selection;
        const newRange = s.map(xScale.invert);
        const years = newRange.map(d => d.getFullYear());
        
        // Ensure we have valid years before updating
        if (years[0] && years[1] && years[0] !== years[1]) {
          setYearRange(years);
          if (event.type === 'end') {
            setBrushSelection(s); // Only store selection on end
          }
        }
      });

    const brushGroup = group.append("g")
      .attr("class", "brush")
      .call(brush);

    // If we have a stored selection, restore it
    if (brushSelection) {
      brushGroup.call(brush.move, brushSelection);
    } 
    // else if (yearRange && yearRange.length === 2) {
    //   // If we have a yearRange but no brushSelection, set the brush based on yearRange
    //   const initialSelection = yearRange.map(year => xScale(parseYear(year)));
    //   brushGroup.call(brush.move, initialSelection);
    // }

    // Store the brush instance for cleanup
    brushRef.current = brush;

  }, [properties]); // Remove yearRange from dependencies

  // Cleanup brush on unmount
  useEffect(() => {
    return () => {
      if (brushRef.current) {
        d3.select(chartRef.current).selectAll('.brush').call(brushRef.current.move, null);
      }
    };
  }, []);

  if (!properties || properties.length === 0) {
    return <div ref={chartRef}>Loading data...</div>;
  } else {
    return <div ref={chartRef} id="chart-timeline" />;
  }
};

// Helper functions
function nestData(data) {
  const tags = PROPERTY_TAGS
  const years = d3.range(1960, new Date().getFullYear());

  const dataByCountry = Array.from(
    d3.rollup(
      data,
      leaves => leaves.length,
      d => d.date,
      d => d.tag
    )
  )
    .filter(([key, value]) => value != 0)
    .map(([key, value]) => ({
      key,
      values: Array.from(value).sort((a, b) => tags.indexOf(a[0]) - tags.indexOf(b[0]))
    }))
    .map(d => ({
      ...d,
      values: d.values.map(inner => ({
        key: inner[0],
        value: inner[1]
      }))
    }));

  let json = [];
  dataByCountry.forEach(a => {
    tags.forEach((b, i) => {
      if (a.values[i]) {
        json.push({
          'town': a.key,
          'tag': a.values[i].key,
          'value': a.values[i].value,
        });
      }
    });
  });

  let dataNew = [];
  tags.forEach(s => {
    let cumsum_arr = [];
    years.forEach(year => {
      const label = d3.timeParse("%Y")(year);
      const tmp = json.find(d => d.tag === s && d.town.getTime() === label.getTime());
      if (tmp) cumsum_arr.push(tmp.value);
      const cumsum = cumsum_arr.reduce((a, b) => a + b, 0);
      dataNew.push({
        tag: s,
        town: label,
        value: cumsum
      });
    });
  });

  return dataNew;
}

function parseYear(year) {
  return d3.timeParse("%Y")(year);
}

export default TimelineChart; 