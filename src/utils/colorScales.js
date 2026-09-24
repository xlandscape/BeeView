import { scaleLinear } from 'd3-scale';

// Land use type color mapping - Level 1 (broad categories)
const level1LandUseColors = {
  'Arable': [120, 180, 80, 180],
  'Forest': [34, 139, 34, 180], // Green,
  'Water': [0, 0, 255, 180],    // Blue
  'Developed': [128, 128, 128, 180], // Gray
  'Grassland': [144, 238, 144, 180], // Light green
  'Miscellaneous': [139, 69, 19, 180], // Brown
};

// Land use type color mapping - Level 2 (more specific categories)
const level2LandUseColors = {
  // Arable subcategories
  'Cereals': [255, 215, 0, 180], // Gold
  'Vegetables and flowers': [255, 20, 147, 180], // Deep pink
  'Root and tuber crops': [210, 180, 140, 180], // Tan
  'Fodder crops': [124, 252, 0, 180], // Lawn green
  'Oil seed crops': [255, 140, 0, 180], // Dark orange
  'Protein crops': [238, 130, 238, 180], // Violet
  'Non-permanent industrial crops': [255, 165, 0, 180], // Orange
  'Permanent crops': [220, 20, 60, 180], // Crimson
  
  // Forest subcategories
  'Broad-leaved forest': [0, 100, 0, 180], // Dark green
  'Coniferous forest': [0, 128, 0, 180], // Green
  'Mixed forest': [34, 139, 34, 180], // Forest green
  
  // Water subcategories
  'Water': [0, 0, 255, 180], // Blue
  'Water buffers': [70, 130, 180, 180], // Steel blue
  
  // Developed subcategories
  'Roads': [105, 105, 105, 180], // Dim gray
  'Railways': [64, 64, 64, 180], // Dark gray
  'Airports': [169, 169, 169, 180], // Dark gray
  'Urban fabric': [128, 128, 128, 180], // Gray
  
  // Grassland subcategories
  'Permanent pasture': [173, 255, 47, 180], // Green yellow
  'Natural grassland': [144, 238, 144, 180], // Light green
  'Semi-natural grassland': [50, 205, 50, 180], // Lime green
  
  // Miscellaneous subcategories
  'Open areas': [222, 184, 135, 180], // Burlywood
  'Other': [160, 82, 45, 180], // Saddle brown
};

// Default color for unknown land use types
const defaultColor = [150, 150, 150];

export const getLandUseColor = (landUseType, level = 1) => {
  if (level === 1) {
    return level1LandUseColors[landUseType] || defaultColor;
  } else if (level === 2) {
    return level2LandUseColors[landUseType] || defaultColor;
  } else if (level === 3) {
    return level3LandUseColors[landUseType] || defaultColor;
  }
  return defaultColor;
};

export const getLevel1LandUseColor = (landUseType) => {
  return level1LandUseColors[landUseType] || defaultColor;
};

export const getLevel2LandUseColor = (landUseType) => {
  return level2LandUseColors[landUseType] || defaultColor;
};

// Land use type color mapping - Level 3 (most specific categories)
const level3LandUseColors = {
  // Cereals (1100s) - Yellow/Gold family
  'Another cereal of a different kind': [255, 239, 0, 180], // Yellow
  'Another spring cereal of the genus Hordeum': [255, 225, 0, 180],
  'Buckwheat': [255, 211, 0, 180],
  'Corn': [255, 215, 0, 180], // Gold
  'Feed made up of cereals and/or protein (in proportion < 50%) and/or forage legumes (in proportion < 50%)': [255, 197, 0, 180],
  'Mixed cereals': [255, 183, 0, 180],
  'Other Sorghum-type cereal': [255, 169, 0, 180],
  'Silage corn': [255, 155, 0, 180],
  'Sorghum': [255, 140, 0, 180],
  'Spelt': [255, 126, 0, 180],
  'Spring barley': [255, 112, 0, 180],
  'Spring durum wheat': [255, 98, 0, 180],
  'Spring oats': [255, 84, 0, 180],
  'Spring soft wheat': [255, 70, 0, 180],
  'Spring triticale': [255, 56, 0, 180],
  'Sweet corn': [255, 42, 0, 180],
  'Winter barley': [255, 28, 0, 180],
  'Winter durum wheat': [255, 14, 0, 180],
  'Winter oats': [255, 0, 0, 180],
  'Winter rye': [241, 0, 0, 180],
  'Winter soft wheat': [227, 0, 0, 180],
  'Winter triticale': [213, 0, 0, 180],

  // Oil seed crops (1200s) - Orange family
  'Soy': [255, 165, 0, 180], // Orange
  'Spring non-textile linen': [255, 150, 15, 180],
  'Spring rapeseed': [255, 135, 30, 180],
  'Sunflower': [255, 120, 45, 180],
  'Winter non-textile linen': [255, 105, 60, 180],
  'Winter rapeseed': [255, 90, 75, 180],

  // Protein crops (1300s) - Purple/Violet family
  'Beans': [238, 130, 238, 180], // Violet
  'Mixture of predominantly protein crops (peas and / or lupine and / or faba bean) sown before 05/31 and cereals': [225, 115, 225, 180],
  'Mixture of protein crops (peas and / or lupine and / or faba bean)': [212, 100, 212, 180],
  'Spring peas sown before May 31': [199, 85, 199, 180],
  'Sweet spring lupin sown before may 31st': [186, 70, 186, 180],
  'Winter peas': [173, 55, 173, 180],
  'Chickpeas': [160, 40, 160, 180],
  'Cultivated lentils (non-forage)': [147, 25, 147, 180],

  // Vegetables (1500s) - Pink/Magenta family
  'Artichoke': [255, 20, 147, 180], // Deep pink
  'Arugula': [255, 35, 147, 180],
  'Bean / Flageolet': [255, 50, 147, 180],
  'Butternut squash / Butternut': [255, 65, 147, 180],
  'Cabbage': [255, 80, 147, 180],
  'Carrot': [255, 95, 147, 180],
  'Chicory / Endive / Escarole': [255, 110, 147, 180],
  'Courgette/pumpkin': [255, 125, 147, 180],
  'Cucumber/pickle': [255, 140, 147, 180],
  'Daisy': [255, 155, 147, 180],
  'Eggplant': [255, 170, 147, 180],
  'Garlic': [255, 185, 147, 180],
  'Green peas': [255, 200, 147, 180],
  'Lavender': [255, 215, 147, 180],
  'Leek': [255, 230, 147, 180],
  'Lettuce / Batavia / Oak leaf': [255, 245, 147, 180],
  'Melon': [240, 230, 140, 180],
  'Onion/shallot': [225, 215, 125, 180],
  'Other annual vegetable or fruit': [210, 200, 110, 180],
  'Other vegetable or perennial fruit': [195, 185, 95, 180],
  'Pepper': [180, 170, 80, 180],
  'Potato for consumption': [165, 155, 65, 180],
  'Pumpkin': [150, 140, 50, 180],
  'Radish': [135, 125, 35, 180],
  'Spinach': [120, 110, 20, 180],
  'Strawberry': [105, 95, 5, 180],
  'Tomato': [220, 20, 60, 180], // Crimson
  'Turnip': [205, 5, 45, 180],
  'Watermelon': [190, 0, 30, 180],

  // Aromatic/medicinal plants (1600s) - Cyan/Teal family
  'Another annual fragrance, aromatic and medicinal plant': [0, 255, 255, 180], // Cyan
  'Another perennial perfume, aromatic and medicinal plant': [15, 240, 255, 180],
  'Basil': [30, 225, 255, 180],
  'Black Psyllium from Provence': [45, 210, 255, 180],
  'Chives': [60, 195, 255, 180],
  'Coriander': [75, 180, 255, 180],
  'Fennel': [90, 165, 255, 180],
  'Fenugreek': [105, 150, 255, 180],
  'Non-forage beet / Swiss chard': [120, 135, 255, 180],
  'Parsley': [135, 120, 255, 180],
  'Thyme': [150, 105, 255, 180],
  'Tobacco': [165, 90, 255, 180],

  // Complex arable land (1700s) - Brown/Tan family  
  'Brome grass 5 years or less': [210, 180, 140, 180], // Tan
  'Complex cultivation patterns': [195, 165, 125, 180],
  'Cultures carried out in inter-rows: 2 cultures each representing more than 25%': [180, 150, 110, 180],
  'Cultures carried out in inter-rows: 3 cultures each representing more than 25%': [165, 135, 95, 180],
  'Fallow 5 years or less': [150, 120, 80, 180],
  'Fallow 6 years or more declared as Area of ​​ecological interest': [135, 105, 65, 180],
  'Fallow 6 years or older': [120, 90, 50, 180],
  'Field edge': [105, 75, 35, 180],
  'Greenhouse culture without soil': [90, 60, 20, 180],
  'Hemp': [75, 45, 5, 180],
  'Land principally occupied by agriculture, with significant areas of natural vegetation': [139, 69, 19, 180], // Brown
  'Miscanthus': [124, 54, 4, 180],
  'Non-irrigated arable land': [109, 39, 0, 180],
  'Permissible strip along a forest with production': [94, 24, 0, 180],
  'Temporarily unused agricultural area': [79, 9, 0, 180],
  'Truffle (oak grove of mycorrhizal plants)': [64, 0, 0, 180],

  // Permanent crops - Fruit (2100s) - Red family
  'Bigarreau cherry for processing': [220, 20, 60, 180], // Crimson
  'Fruit and berry plantation': [205, 35, 75, 180],
  'Nursery': [190, 50, 90, 180],
  'Orchard': [175, 65, 105, 180],
  'Plum d\'Ente for processing': [160, 80, 120, 180],
  'Small red fruit': [145, 95, 135, 180],
  'Williams pear for processing': [130, 110, 150, 180],

  // Nuts (2200s) - Dark red family
  'Chestnut': [139, 0, 0, 180], // Dark red
  'Hazelnut': [124, 15, 15, 180],
  'Nuts': [109, 30, 30, 180],

  // Grapes (2300s) - Purple family
  'Vine: table grapes': [128, 0, 128, 180], // Purple
  'Vine: vat grapes': [143, 15, 143, 180],
  'Vine: wine grapes not in production': [158, 30, 158, 180],
  'Vineyard restructuring': [173, 45, 173, 180],
  'Vineyards': [188, 60, 188, 180],

  // Olives (2400s) - Olive green
  'Olive orchard': [128, 128, 0, 180], // Olive

  // Fodder legumes (3100s) - Light green family
  'Dactyl 5 years or less (orchard grass?)': [124, 252, 0, 180], // Lawn green
  'Dehydrated alfalfa': [109, 237, 15, 180],
  'Faba bean sown before May 31st': [94, 222, 30, 180],
  'Mixture of legumes predominantly at seed and forage grasses 5 years or less': [79, 207, 45, 180],
  'Other alfalfa': [64, 192, 60, 180],
  'Other clover': [49, 177, 75, 180],
  'Other sainfoin': [34, 162, 90, 180],
  'Other spring fodder peas': [19, 147, 105, 180],
  'Other vetch': [4, 132, 120, 180],
  'Other winter fodder peas': [0, 117, 135, 180],
  'Sweet pea': [0, 102, 150, 180],

  // Other fodder (3200s) - Medium green family
  'Fescue 5 years or less': [0, 128, 0, 180], // Green
  'Fodder beetroot': [15, 143, 15, 180],
  'Mixture of forage legumes (among themselves)': [30, 158, 30, 180],
  'Mixture of predominant forage legumes and grains and / or oilseeds': [45, 173, 45, 180],
  'Moha': [60, 188, 60, 180],
  'Other annual fodder of a different kind': [75, 203, 75, 180],
  'Other pure forage grass 5 years or less': [90, 218, 90, 180],
  'Other weeded forage plants': [105, 233, 105, 180],

  // Grasslands (3300s) - Light green variations
  'Buffer band': [144, 238, 144, 180], // Light green
  'Digitized_grassland - mixed use': [159, 253, 159, 180],
  'Natural grassland': [174, 238, 174, 180],
  'Other temporary grassland 5 years or less': [189, 223, 189, 180],

  // Pastures (3400s) - Yellow-green family
  'Grazed wood': [173, 255, 47, 180], // Green yellow
  'Pastoral area - predominant woody fodder resources': [158, 240, 32, 180],
  'Pastoral area - predominantly grass and woody fodder resources present': [143, 225, 17, 180],
  'Pastures': [128, 210, 2, 180],
  'Permanent pasture - predominantly grass (woody fodder resources absent or scarce)': [113, 195, 0, 180],
  'Digitized_grassland - pasture': [98, 180, 0, 180],

  // Meadows (3500s) - Green variations
  'Digitized_grassland - orchard meadow': [50, 205, 50, 180], // Lime green
  'Long rotation meadow (6 years or more)': [65, 220, 65, 180],
  'Ryegrass 5 years or less': [80, 235, 80, 180],
  'Digitized_grassland - meadow, CF<=2': [95, 250, 95, 180],
  'Digitized_grassland - meadow, CF>=3': [110, 235, 110, 180],

  // Forests (4100s) - Dark green family
  'BDForest': [0, 100, 0, 180], // Dark green
  'Broad-leaved forest': [15, 115, 15, 180],
  'Coniferous forest': [30, 130, 30, 180],
  'Mixed forest': [34, 139, 34, 180], // Forest green
  'Permissible strip along a forest without production': [49, 154, 49, 180],
  'Sclerophyllous vegetation': [64, 169, 64, 180],
  'Short rotation coppice': [79, 184, 79, 180],
  'Transitional woodland/shrub': [94, 199, 94, 180],
  'Wooded area on old farmland': [109, 214, 109, 180],

  // Wood margins (4200s)
  'Wood margins': [46, 125, 50, 180],

  // Urban/Transport (5100s-5400s) - Gray family
  'Airports': [169, 169, 169, 180], // Dark gray
  'Discontinuous urban fabric': [154, 154, 154, 180],
  'Continuous urban fabric': [139, 139, 139, 180],
  'Industrial or commercial units': [124, 124, 124, 180],
  'Mineral extraction sites': [109, 109, 109, 180],
  'Road and rail networks and associated land': [94, 94, 94, 180],
  'Sport and leisure facilities': [79, 79, 79, 180],
  'Roads': [105, 105, 105, 180], // Dim gray
  'Road buffers': [120, 120, 120, 180],

  // Water (6100s) - Blue family
  'Water': [0, 0, 255, 180], // Blue
  'Water bodies': [15, 15, 255, 180],
  'Water courses': [30, 30, 255, 180],
  'Water buffer': [70, 130, 180, 180], // Steel blue

  // Bare/Sparse areas (7100s-7200s) - Beige/Sand family
  'Beaches, dunes, sand': [238, 203, 173, 180], // Navajo white
  'Sparsely vegetated areas': [222, 184, 135, 180], // Burlywood

  // Special categories
  'Background': [245, 245, 245, 180], // White smoke
};

export const getLevel3LandUseColor = (landUseType) => {
  return level3LandUseColors[landUseType] || defaultColor;
};

// Vegetation type color mapping
const vegetationColors = {
  // Most common vegetation types (ordered by frequency)
  'nan': [200, 200, 200, 180], // Gray for NaN/unknown
  'cereals general': [255, 215, 0, 180], // Gold
  'grassland low density general': [144, 238, 144, 180], // Light green
  'wood_general': [34, 139, 34, 180], // Forest green
  'peas general': [238, 130, 238, 180], // Violet
  'leguminose mixture general': [186, 85, 211, 180], // Medium orchid
  'no vegetation general': [245, 245, 220, 180], // Beige
  'no forage vegetation': [220, 220, 220, 180], // Light gray
  'grassland medium density general': [173, 255, 47, 180], // Green yellow
  'Grassland_pasture_moderate': [124, 252, 0, 180], // Lawn green
  'fallow general': [210, 180, 140, 180], // Tan
  'maize general': [255, 215, 0, 180], // Gold (same as cereals)
  'urban_general': [128, 128, 128, 180], // Gray
  'sorghum general': [255, 140, 0, 180], // Dark orange
  'linen general': [255, 182, 193, 180], // Light pink
  'arable-natural mix': [154, 205, 50, 180], // Yellow green
  'alfalfa general': [0, 255, 127, 180], // Spring green
  'peas spring general': [218, 112, 214, 180], // Orchid
  'haselnut_general': [139, 69, 19, 180], // Saddle brown
  'fruit and berry generalised': [255, 20, 147, 180], // Deep pink
  'grassland_pasture_intense': [50, 205, 50, 180], // Lime green
  'fallow temporary general': [188, 143, 143, 180], // Rosy brown
  'cabbage_general': [72, 209, 204, 180], // Medium turquoise
  'lentis general': [147, 112, 219, 180], // Medium purple
  'grassland meadow <=2 cuts': [152, 251, 152, 180], // Pale green
  'clover general': [127, 255, 0, 180], // Chartreuse
  'no beeforage vegetation': [211, 211, 211, 180], // Light gray
  'Fagopyrum esculentum': [160, 82, 45, 180], // Saddle brown (buckwheat)
  'rape spring': [255, 255, 0, 180], // Yellow
  'nursery generalised': [250, 128, 114, 180], // Salmon
  'woodmargin_general': [85, 107, 47, 180], // Dark olive green
  'lupin spring general': [138, 43, 226, 180], // Blue violet
  'rape winter': [255, 215, 0, 180], // Gold
  'no vegetation': [248, 248, 255, 180], // Ghost white
  'chestnut general': [205, 133, 63, 180], // Peru
  'pollen_only': [255, 218, 185, 180], // Peach puff
  'esparsette_general': [219, 112, 147, 180], // Pale violet red
  'dunes general': [244, 164, 96, 180], // Sandy brown
  'beans_general': [34, 139, 34, 180], // Forest green
  'vetch_general': [148, 0, 211, 180], // Dark violet
  'riparian': [0, 191, 255, 180], // Deep sky blue
  'pears early generalised': [255, 182, 193, 180], // Light pink
  'grassland orchard meadow': [189, 252, 201, 180], // Mint green
  'carrot general': [255, 140, 0, 180], // Dark orange
  'grassland meadow >=3 cuts': [0, 250, 154, 180], // Medium spring green
  'strawberry_general': [220, 20, 60, 180], // Crimson
  'potato_general': [160, 82, 45, 180], // Saddle brown
  'grassland natural unmanaged': [107, 142, 35, 180], // Olive drab
  'thyme_general': [128, 0, 128, 180], // Purple
  'leek_general': [173, 255, 47, 180], // Green yellow
  'artichoke general': [60, 179, 113, 180], // Medium sea green
  'beans general': [46, 139, 87, 180], // Sea green
  'lavender general': [230, 230, 250, 180], // Lavender
  'roadmargin_1cut_general': [105, 105, 105, 180], // Dim gray
  'fenugreek_general': [255, 228, 181, 180], // Moccasin
  'sunflower general': [255, 215, 0, 180], // Gold
  'grassland meadow 2 cut': [144, 238, 144, 180], // Light green
  'soy general': [255, 165, 0, 180], // Orange

  // Legacy fallbacks (keeping for backward compatibility)
  'Natural grassland': [144, 238, 144, 180], // Light green
  'Semi-natural grassland': [34, 139, 34, 180], // Forest green  
  'Improved grassland': [173, 255, 47, 180], // Green yellow
  'Natural vegetation': [0, 128, 0, 180], // Green
  'Forest': [46, 125, 50, 180], // Dark green
  'Cereals': [255, 215, 0, 180], // Gold
  'Root and tuber crops': [210, 180, 140, 180], // Tan
  'Non-permanent industrial crops': [255, 165, 0, 180], // Orange
  'Fruit trees and berry plantations': [255, 20, 147, 180], // Deep pink
  'Olive groves': [128, 128, 0, 180], // Olive
  'Vineyards': [128, 0, 128, 180], // Purple
  'Pastures': [124, 252, 0, 180], // Lawn green
  'Arable land': [255, 248, 220, 180], // Cornsilk
  'Permanent crops': [220, 20, 60, 180], // Crimson
};

export const getVegetationColor = (vegetationType) => {
  return vegetationColors[vegetationType] || defaultColor;
};

export const getNectarColor = (value) => {
  const min = 0;
  const max = 0.00009900; // Updated to match actual data range (110% of actual max)
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
  const max = 0.06600000; // Updated to match actual data range (110% of actual max)
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
  return scaleLinear()
    .domain(domain)
    .range(colorRange);
};

// Bee population color scales - using different color schemes for different metrics
export const getBeePopulationColor = (value, metric, maxValue = null) => {
  if (value === null || value === undefined || value < 0) {
    return [200, 200, 200, 180]; // Gray for no data
  }
  
  // Define max values and color schemes for different bee population metrics
  // Updated to match actual metrics from load_bee_population.py
  const metricConfig = {
    'TotalIHbees + TotalForagers + TotalDroneEggs + TotalEggs + TotalDroneLarvae + TotalLarvae + TotalDronePupae + TotalPupae': { 
      max: 25000, color: [255, 0, 0] }, // Red for total colony size
    'TotalIHbees + TotalForagers': { 
      max: 15000, color: [128, 0, 128] }, // Purple for adults
    'TotalDroneEggs + TotalEggs': { 
      max: 2200, color: [255, 255, 0] }, // Yellow for all eggs
    'TotalDroneLarvae + TotalLarvae': { 
      max: 2200, color: [255, 165, 0] }, // Orange for all larvae  
    'TotalDronePupae + TotalPupae': { 
      max: 2200, color: [255, 140, 0] }, // Dark orange for all pupae
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

// Map friendly layer names to actual database metric names
export const getBeePopulationMetricName = (layerName) => {
  const layerToMetricMapping = {
    'TotalColony': 'TotalIHbees + TotalForagers + TotalDroneEggs + TotalEggs + TotalDroneLarvae + TotalLarvae + TotalDronePupae + TotalPupae',
    'TotalAdults': 'TotalIHbees + TotalForagers',
    'AllEggs': 'TotalDroneEggs + TotalEggs',
    'AllLarvae': 'TotalDroneLarvae + TotalLarvae',
    'AllPupae': 'TotalDronePupae + TotalPupae'
  };
  
  return layerToMetricMapping[layerName] || layerName;
};