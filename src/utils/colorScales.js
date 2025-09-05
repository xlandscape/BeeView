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