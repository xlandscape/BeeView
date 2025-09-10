import * as d3 from 'd3';

// Land use type color mapping
const landUseColors = {
  'Arable': [120, 180, 80, 180],
  'Forest': [34, 139, 34, 180], // Green,
  'Water': [0, 0, 255, 180],    // Blue
  'Developed': [128, 128, 128, 180], // Gray
};

// Default color for unknown land use types
const defaultColor = [150, 150, 150];

export const getLandUseColor = (landUseType) => {
  return landUseColors[landUseType] || defaultColor;
};

export const getNectarColor = (value) => {
  const min = 0;
  const max = 0.0003000001;
  // Clamp and normalize value
  const t = Math.max(0, Math.min(1, (value - min) / (max - min)));
  // Interpolate: white to red
  const r = 255;
  const g = Math.round(255 * (1 - t));
  const b = Math.round(255 * (1 - t));
  return [r, g, b, 180]; // RGBA, alpha=180 for some transparency 
};

export const getPollenColor = (value) => {
  const min = 0;
  const max = 0.0001000001;
  // Clamp and normalize value
  const t = Math.max(0, Math.min(1, (value - min) / (max - min)));
  // Interpolate: white to red
  const r = 255;
  const g = Math.round(255 * (1 - t));
  const b = Math.round(255 * (1 - t));
  return [r, g, b, 180]; // RGBA, alpha=180 for some transparency 
};

// Generate a color scale for continuous values
export const generateColorScale = (domain, colorRange) => {
  return d3.scaleLinear()
    .domain(domain)
    .range(colorRange);
};

// Bee population color scales - using different color schemes for different metrics
export const getBeePopulationColor = (value, metric, maxValue = null) => {
  if (value === null || value === undefined || value < 0) {
    return [200, 200, 200, 180]; // Gray for no data
  }
  
  // Define max values and color schemes for different bee population metrics
  const metricConfig = {
    'totalEggs': { max: 2000, color: [255, 255, 0] }, // Yellow
    'totalLarvae': { max: 2000, color: [255, 165, 0] }, // Orange
    'totalPupae': { max: 2000, color: [255, 140, 0] }, // Dark orange
    'totalIHbees': { max: 10000, color: [0, 0, 255] }, // Blue
    'totalForagers': { max: 5000, color: [0, 255, 0] }, // Green
    'totalIHbees + totalForagers': { max: 15000, color: [128, 0, 128] }, // Purple
    'totalDroneEggs': { max: 200, color: [255, 192, 203] }, // Pink
    'totalDroneLarvae': { max: 200, color: [255, 20, 147] }, // Deep pink
    'totalDronePupae': { max: 200, color: [199, 21, 133] }, // Medium violet red
    'totalDrones': { max: 100, color: [139, 0, 139] }, // Dark magenta
  };
  
  const config = metricConfig[metric];
  if (!config) {
    // Default color scheme if metric not found
    const t = Math.max(0, Math.min(1, value / (maxValue || 1000)));
    return [Math.round(255 * t), 0, Math.round(255 * (1 - t)), 180];
  }
  
  // Use provided maxValue or config max
  const max = maxValue || config.max;
  
  // Normalize value (0 to 1)
  const t = Math.max(0, Math.min(1, value / max));
  
  // Interpolate from white to the metric's color
  const [r, g, b] = config.color;
  const red = Math.round(255 * (1 - t) + r * t);
  const green = Math.round(255 * (1 - t) + g * t);
  const blue = Math.round(255 * (1 - t) + b * t);
  
  return [red, green, blue, 180];
};

// Helper function to get dynamic max values for bee population metrics
export const getBeePopulationMaxValues = (timeSeriesData) => {
  if (!timeSeriesData) return {};
  
  const maxValues = {};
  
  // Calculate max values for each metric across all time points
  Object.keys(timeSeriesData).forEach(metric => {
    if (metric !== 'days' && Array.isArray(timeSeriesData[metric])) {
      maxValues[metric] = Math.max(...timeSeriesData[metric]);
    }
  });
  
  return maxValues;
};