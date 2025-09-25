// src/components/ColonyHealth/PopulationChart.tsx
import React, { useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import * as d3 from 'd3';
import { useSpring, animated } from 'react-spring';

const PopulationChart = () => {
  const svgRef = useRef(null);
  const currentTime = useSelector(state => state.time.current);
  const colonyData = useSelector(state => state.colony.data);
  
  const animatedProps = useSpring({
    population: colonyData?.population || 0,
    from: { population: 0 }
  });
  
  useEffect(() => {
    if (!colonyData) return;
    
    // D3 code to render population over time chart
    // ...
    
  }, [colonyData, currentTime]);
  
  return (
    <div className="colony-chart">
      <h3>Colony Population</h3>
      <animated.div className="population-counter">
        {animatedProps.population.to(val => Math.floor(val).toLocaleString())} bees
      </animated.div>
      <svg ref={svgRef} width="100%" height="200"></svg>
    </div>
  );
};

export default PopulationChart;