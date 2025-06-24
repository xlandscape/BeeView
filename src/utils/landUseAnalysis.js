import * as turf from '@turf/turf';

export const analyzeLandUseData = (landUseData) => {
  if (!landUseData || !landUseData.features) return [];
  
  // Group features by land use type
  const landUseGroups = {};
  
  landUseData.features.forEach(feature => {
    const landUseType = feature.properties.L1_label || 'Unknown';
    
    if (!landUseGroups[landUseType]) {
      landUseGroups[landUseType] = {
        type: landUseType,
        features: [],
        featureIds: []
      };
    }
    
    landUseGroups[landUseType].features.push(feature);
    landUseGroups[landUseType].featureIds.push(feature.id);
  });
  
  // Calculate area for each land use type
 // ...existing code...
  return Object.values(landUseGroups).map(group => {
    const combinedFeatures = turf.featureCollection(group.features);
    let dissolved;
    try {
      dissolved = turf.dissolve(combinedFeatures);
    } catch (e) {
      dissolved = null;
    }

    let area = 0;
    if (dissolved) {
      if (dissolved.type === 'FeatureCollection' && dissolved.features.length > 0) {
        // Use the first feature in the collection
        const feat = dissolved.features[0];
        if (feat.geometry && (feat.geometry.type === 'Polygon' || feat.geometry.type === 'MultiPolygon')) {
          area = turf.area(feat) / 10000;
        }
      } else if (
        dissolved.type === 'Feature' &&
        dissolved.geometry &&
        (dissolved.geometry.type === 'Polygon' || dissolved.geometry.type === 'MultiPolygon')
      ) {
        area = turf.area(dissolved) / 10000;
      }
    }

    // Fallback: sum areas if dissolve failed
    if (!area) {
      area = group.features.reduce((sum, feat) => {
        if (feat.geometry && (feat.geometry.type === 'Polygon' || feat.geometry.type === 'MultiPolygon')) {
          return sum + turf.area(feat) / 10000;
        }
        return sum;
      }, 0);
    }

    return {
      type: group.type,
      area,
      featureIds: group.featureIds,
      featureCount: group.features.length
    };
  });
// ...existing code...
};

export const calculateLandUsePercentage = (landUseData) => {
  const stats = analyzeLandUseData(landUseData);
  const totalArea = stats.reduce((sum, item) => sum + item.area, 0);
  
  return stats.map(item => ({
    ...item,
    percentage: (item.area / totalArea) * 100
  }));
};