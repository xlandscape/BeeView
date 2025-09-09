/**
 * Viewport-based data loading utility for optimized geo-visualization
 */

const API_BASE_URL = 'http://127.0.0.1:8080';

// Configuration options
const VIEWPORT_CONFIG = {
  USE_VIEWPORT_QUERIES: true, // Set to false to always load full dataset for debugging
  ENABLE_CACHING: true,       // Set to false to disable caching
  BUFFER_FACTOR: 0.2          // Default buffer factor for viewport bounds
};

// Cache for storing loaded viewport data
class ViewportCache {
  constructor(maxCacheSize = 50) {
    this.cache = new Map();
    this.maxCacheSize = maxCacheSize;
  }

  generateKey(bounds, zoom, dataType) {
    const [minLng, minLat, maxLng, maxLat] = bounds;
    const roundedZoom = Math.floor(zoom);
    return `${dataType}_${minLng.toFixed(4)}_${minLat.toFixed(4)}_${maxLng.toFixed(4)}_${maxLat.toFixed(4)}_${roundedZoom}`;
  }

  get(key) {
    if (this.cache.has(key)) {
      // Move to end (most recently used)
      const value = this.cache.get(key);
      this.cache.delete(key);
      this.cache.set(key, value);
      return value;
    }
    return null;
  }

  set(key, value) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxCacheSize) {
      // Remove oldest entry
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
  }

  clear() {
    this.cache.clear();
  }
}

// Global cache instance
const viewportCache = new ViewportCache();

/**
 * Calculate viewport bounds with buffer for smooth panning
 */
export function calculateViewportBounds(viewState, bufferFactor = 0.2) {
  const { longitude, latitude, zoom } = viewState;
  
  // Calculate approximate bounds based on zoom level
  const latRange = 180 / Math.pow(2, zoom);
  const lngRange = 360 / Math.pow(2, zoom);
  
  // Add buffer for smooth panning
  const latBuffer = latRange * bufferFactor;
  const lngBuffer = lngRange * bufferFactor;
  
  return [
    longitude - lngRange - lngBuffer, // minLng
    latitude - latRange - latBuffer,  // minLat
    longitude + lngRange + lngBuffer, // maxLng
    latitude + latRange + latBuffer   // maxLat
  ];
}

/**
 * Load GeoJSON data for the current viewport
 */
export async function loadViewportGeoJSON(viewState, options = {}) {
  const { bufferFactor = VIEWPORT_CONFIG.BUFFER_FACTOR, useCache = VIEWPORT_CONFIG.ENABLE_CACHING } = options;
  
  // If viewport queries are disabled, load full dataset
  if (!VIEWPORT_CONFIG.USE_VIEWPORT_QUERIES) {
    console.log('Viewport queries disabled - loading full GeoJSON dataset');
    const cacheKey = 'full_geojson';
    
    if (useCache) {
      const cached = viewportCache.get(cacheKey);
      if (cached) {
        console.log('Using cached full GeoJSON data');
        return cached;
      }
    }
    
    try {
      const response = await fetch(`${API_BASE_URL}/geojson`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (useCache) {
        viewportCache.set(cacheKey, data);
      }
      
      console.log(`Loaded full dataset: ${data.features?.length || 0} features`);
      return data;
      
    } catch (error) {
      console.error('Error loading full GeoJSON dataset:', error);
      throw error;
    }
  }
  
  // Original viewport-based loading
  const bounds = calculateViewportBounds(viewState, bufferFactor);
  const [minLng, minLat, maxLng, maxLat] = bounds;
  
  const cacheKey = viewportCache.generateKey(bounds, viewState.zoom, 'geojson');
  
  if (useCache) {
    const cached = viewportCache.get(cacheKey);
    if (cached) {
      console.log('Using cached GeoJSON data');
      return cached;
    }
  }
  
  try {
    const url = new URL(`${API_BASE_URL}/geojson/viewport`);
    url.searchParams.set('min_lng', minLng.toString());
    url.searchParams.set('min_lat', minLat.toString());
    url.searchParams.set('max_lng', maxLng.toString());
    url.searchParams.set('max_lat', maxLat.toString());
    url.searchParams.set('zoom', viewState.zoom.toString());
    
    console.log(`Loading viewport GeoJSON: ${url.toString()}`);
    
    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (useCache) {
      viewportCache.set(cacheKey, data);
    }
    
    console.log(`Loaded ${data.features?.length || 0} features for viewport`);
    return data;
    
  } catch (error) {
    console.error('Error loading viewport GeoJSON:', error);
    throw error;
  }
}

/**
 * Load nectar max values for the current viewport
 */
export async function loadViewportNectarMax(viewState, options = {}) {
  const { bufferFactor = VIEWPORT_CONFIG.BUFFER_FACTOR, useCache = VIEWPORT_CONFIG.ENABLE_CACHING } = options;
  
  // If viewport queries are disabled, load full dataset
  if (!VIEWPORT_CONFIG.USE_VIEWPORT_QUERIES) {
    console.log('Viewport queries disabled - loading full nectar dataset');
    const cacheKey = 'full_nectar';
    
    if (useCache) {
      const cached = viewportCache.get(cacheKey);
      if (cached) {
        console.log('Using cached full nectar data');
        return cached;
      }
    }
    
    try {
      const response = await fetch(`${API_BASE_URL}/nectar/max`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Convert to lookup object
      const nectarMaxLookup = {};
      data["max_nectar"].forEach(item => {
        nectarMaxLookup[item.feature_id] = item.max_nectar;
      });
      
      if (useCache) {
        viewportCache.set(cacheKey, nectarMaxLookup);
      }
      
      console.log(`Loaded full nectar dataset: ${Object.keys(nectarMaxLookup).length} features`);
      return nectarMaxLookup;
      
    } catch (error) {
      console.error('Error loading full nectar dataset:', error);
      throw error;
    }
  }
  
  // Original viewport-based loading
  const bounds = calculateViewportBounds(viewState, bufferFactor);
  const [minLng, minLat, maxLng, maxLat] = bounds;
  
  const cacheKey = viewportCache.generateKey(bounds, viewState.zoom, 'nectar');
  
  if (useCache) {
    const cached = viewportCache.get(cacheKey);
    if (cached) {
      console.log('Using cached nectar data');
      return cached;
    }
  }
  
  try {
    const url = new URL(`${API_BASE_URL}/nectar/max/viewport`);
    url.searchParams.set('min_lng', minLng.toString());
    url.searchParams.set('min_lat', minLat.toString());
    url.searchParams.set('max_lng', maxLng.toString());
    url.searchParams.set('max_lat', maxLat.toString());
    
    console.log(`Loading viewport nectar data: ${url.toString()}`);
    
    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Convert array to lookup object
    const nectarMaxLookup = {};
    data.max_nectar.forEach(item => {
      nectarMaxLookup[item.feature_id] = item.max_nectar;
    });
    
    if (useCache) {
      viewportCache.set(cacheKey, nectarMaxLookup);
    }
    
    console.log(`Loaded nectar data for ${data.max_nectar?.length || 0} features`);
    return nectarMaxLookup;
    
  } catch (error) {
    console.error('Error loading viewport nectar data:', error);
    throw error;
  }
}

/**
 * Load pollen max values for the current viewport
 */
export async function loadViewportPollenMax(viewState, options = {}) {
  const { bufferFactor = VIEWPORT_CONFIG.BUFFER_FACTOR, useCache = VIEWPORT_CONFIG.ENABLE_CACHING } = options;
  
  // If viewport queries are disabled, load full dataset
  if (!VIEWPORT_CONFIG.USE_VIEWPORT_QUERIES) {
    console.log('Viewport queries disabled - loading full pollen dataset');
    const cacheKey = 'full_pollen';
    
    if (useCache) {
      const cached = viewportCache.get(cacheKey);
      if (cached) {
        console.log('Using cached full pollen data');
        return cached;
      }
    }
    
    try {
      const response = await fetch(`${API_BASE_URL}/pollen/max`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Convert to lookup object
      const pollenMaxLookup = {};
      data["max_pollen"].forEach(item => {
        pollenMaxLookup[item.feature_id] = item.max_pollen;
      });
      
      if (useCache) {
        viewportCache.set(cacheKey, pollenMaxLookup);
      }
      
      console.log(`Loaded full pollen dataset: ${Object.keys(pollenMaxLookup).length} features`);
      return pollenMaxLookup;
      
    } catch (error) {
      console.error('Error loading full pollen dataset:', error);
      throw error;
    }
  }
  
  // Original viewport-based loading
  const bounds = calculateViewportBounds(viewState, bufferFactor);
  const [minLng, minLat, maxLng, maxLat] = bounds;
  
  const cacheKey = viewportCache.generateKey(bounds, viewState.zoom, 'pollen');
  
  if (useCache) {
    const cached = viewportCache.get(cacheKey);
    if (cached) {
      console.log('Using cached pollen data');
      return cached;
    }
  }
  
  try {
    const url = new URL(`${API_BASE_URL}/pollen/max/viewport`);
    url.searchParams.set('min_lng', minLng.toString());
    url.searchParams.set('min_lat', minLat.toString());
    url.searchParams.set('max_lng', maxLng.toString());
    url.searchParams.set('max_lat', maxLat.toString());
    
    console.log(`Loading viewport pollen data: ${url.toString()}`);
    
    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Convert array to lookup object
    const pollenMaxLookup = {};
    data.max_pollen.forEach(item => {
      pollenMaxLookup[item.feature_id] = item.max_pollen;
    });
    
    if (useCache) {
      viewportCache.set(cacheKey, pollenMaxLookup);
    }
    
    console.log(`Loaded pollen data for ${data.max_pollen?.length || 0} features`);
    return pollenMaxLookup;
    
  } catch (error) {
    console.error('Error loading viewport pollen data:', error);
    throw error;
  }
}

/**
 * Debounce function to limit API calls during rapid viewport changes
 */
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Clear all cached data
 */
export function clearViewportCache() {
  viewportCache.clear();
}

/**
 * Configure viewport loading behavior
 */
export function setViewportConfig(config) {
  Object.assign(VIEWPORT_CONFIG, config);
  console.log('Viewport configuration updated:', VIEWPORT_CONFIG);
}

/**
 * Get current viewport configuration
 */
export function getViewportConfig() {
  return { ...VIEWPORT_CONFIG };
}

/**
 * Load all viewport data (GeoJSON + nectar + pollen) in parallel
 */
export async function loadViewportData(viewState, options = {}) {
  try {
    const [geoJsonData, nectarData, pollenData] = await Promise.all([
      loadViewportGeoJSON(viewState, options),
      loadViewportNectarMax(viewState, options),
      loadViewportPollenMax(viewState, options)
    ]);
    
    return {
      geoJson: geoJsonData,
      nectar: nectarData,
      pollen: pollenData
    };
  } catch (error) {
    console.error('Error loading viewport data:', error);
    throw error;
  }
}
