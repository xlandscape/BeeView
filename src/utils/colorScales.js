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

// Generate a color scale for continuous values
export const generateColorScale = (domain, colorRange) => {
  return d3.scaleLinear()
    .domain(domain)
    .range(colorRange);
};