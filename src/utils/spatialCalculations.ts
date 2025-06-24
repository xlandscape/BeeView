// src/utils/spatialCalculations.ts
import * as turf from '@turf/turf';

export const calculateForagingArea = (hiveLocation, maxDistance) => {
  return turf.circle(hiveLocation, maxDistance, { units: 'kilometers' });
};

export const calculateResourceOverlap = (forageArea, resourcePatches) => {
  return resourcePatches.map(patch => {
    const intersection = turf.intersect(forageArea, patch.geometry);
    return {
      ...patch,
      overlapArea: intersection ? turf.area(intersection) : 0,
      overlapPercentage: intersection ? (turf.area(intersection) / turf.area(patch.geometry)) * 100 : 0
    };
  });
};