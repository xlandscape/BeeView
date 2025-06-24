import * as turf from '@turf/turf';

// Calculate the bounding box of GeoJSON data
export const calculateBoundingBox = (geojson) => {
  if (!geojson || !geojson.features || geojson.features.length === 0) {
    return null;
  }
  
  return turf.bbox(geojson);
};

// Convert a bounding box to a viewport object for deck.gl
export const bboxToViewport = (bbox, width, height, padding = 20) => {
  if (!bbox) return null;
  
  const [minX, minY, maxX, maxY] = bbox;
  
  // Create a bounding box as a polygon
  const boundingBox = turf.bboxPolygon(bbox);
  
  // Get the center of the bounding box
  const center = turf.center(boundingBox);
  const centerLng = center.geometry.coordinates[0];
  const centerLat = center.geometry.coordinates[1];
  
  // Calculate the appropriate zoom level
  const distanceX = turf.distance(
    turf.point([minX, minY]),
    turf.point([maxX, minY]),
    { units: 'kilometers' }
  );
  
  const distanceY = turf.distance(
    turf.point([minX, minY]),
    turf.point([minX, maxY]),
    { units: 'kilometers' }
  );
  
  // Approximate zoom level calculation
  const maxDistance = Math.max(distanceX, distanceY);
  let zoom = 14 - Math.log2(maxDistance);
  
  // Adjust for the container size and padding
  const aspectRatio = width / height;
  if (distanceX / distanceY > aspectRatio) {
    zoom -= Math.log2(1 + 2 * padding / width);
  } else {
    zoom -= Math.log2(1 + 2 * padding / height);
  }
  
  return {
    longitude: centerLng,
    latitude: centerLat,
    zoom: Math.min(Math.max(zoom, 1), 20) // Clamp zoom between 1 and 20
  };
};