/**
 * Viewport-based data loading utility for optimized geo-visualization
 */

import { API_BASE_URL, buildApiUrl } from '../config/api.js';

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
 * Check if full dataset is cached for a given time point
 */
export function isFullDatasetCached(timePoint = null) {
  // If caching is disabled, always return false
  if (!VIEWPORT_CONFIG.ENABLE_CACHING) {
    return false;
  }
  
  const hasGeoJson = viewportCache.get('full_geojson') !== null;
  
  if (timePoint) {
    const hasNectar = viewportCache.get(`full_nectar_${timePoint}`) !== null;
    const hasPollen = viewportCache.get(`full_pollen_${timePoint}`) !== null;
    return hasGeoJson && hasNectar && hasPollen;
  } else {
    const hasNectar = viewportCache.get('full_nectar_max') !== null;
    const hasPollen = viewportCache.get('full_pollen_max') !== null;
    return hasGeoJson && hasNectar && hasPollen;
  }
}

/**
 * Load all viewport data (GeoJSON + nectar + pollen) in parallel
 */
export async function loadViewportData(viewState, options = {}) {
  // If viewport queries are disabled, return cached full dataset immediately
  if (!VIEWPORT_CONFIG.USE_VIEWPORT_QUERIES) {
    console.log('Viewport queries disabled - returning cached full dataset');
    
    const fullGeoJson = viewportCache.get('full_geojson');
    const fullNectar = viewportCache.get('full_nectar_max');
    const fullPollen = viewportCache.get('full_pollen_max');
    
    // If we have cached data, return it immediately without making API calls
    if (fullGeoJson && fullNectar && fullPollen) {
      console.log('Using cached full datasets - no API calls needed');
      return {
        geoJson: fullGeoJson,
        nectar: fullNectar,
        pollen: fullPollen
      };
    }
    
    // If not cached, load once and cache
    console.log('Loading full datasets once for caching');
  }
  
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

/**
 * Load nectar data for a specific time point
 */
export async function loadTimePointNectarData(viewState, timePoint, options = {}) {
  const { bufferFactor = VIEWPORT_CONFIG.BUFFER_FACTOR, useCache = VIEWPORT_CONFIG.ENABLE_CACHING } = options;
  
  // If viewport queries are disabled, load full dataset for time point
  if (!VIEWPORT_CONFIG.USE_VIEWPORT_QUERIES) {
    console.log(`Viewport queries disabled - loading full nectar dataset for time point: ${timePoint}`);
    const cacheKey = `full_nectar_${timePoint}`;
    
    if (useCache) {
      const cached = viewportCache.get(cacheKey);
      if (cached) {
        console.log(`Using cached full nectar data for time point: ${timePoint}`);
        return cached;
      }
    }
    
    try {
      const response = await fetch(buildApiUrl(`/api/nectar/time-point/${timePoint}`));
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Convert to lookup object
      const nectarTimeLookup = {};
      data.nectar_data.forEach(item => {
        nectarTimeLookup[item.feature_id] = item.nectar_concentration;
      });
      
      if (useCache) {
        viewportCache.set(cacheKey, nectarTimeLookup);
      }
      
      console.log(`Loaded full nectar data for time point ${timePoint}: ${Object.keys(nectarTimeLookup).length} features`);
      return nectarTimeLookup;
      
    } catch (error) {
      console.error(`Error loading full nectar dataset for time point ${timePoint}:`, error);
      throw error;
    }
  }
  
  // Viewport-based loading for specific time point
  const bounds = calculateViewportBounds(viewState, bufferFactor);
  const [minLng, minLat, maxLng, maxLat] = bounds;
  
  const cacheKey = viewportCache.generateKey(bounds, viewState.zoom, `nectar_${timePoint}`);
  
  if (useCache) {
    const cached = viewportCache.get(cacheKey);
    if (cached) {
      console.log(`Using cached nectar data for time point: ${timePoint}`);
      return cached;
    }
  }
  
  try {
    const url = new URL(buildApiUrl(`/api/nectar/time-point/${timePoint}/viewport`));
    url.searchParams.set('min_lng', minLng.toString());
    url.searchParams.set('min_lat', minLat.toString());
    url.searchParams.set('max_lng', maxLng.toString());
    url.searchParams.set('max_lat', maxLat.toString());
    
    console.log(`Loading viewport nectar data for time point ${timePoint}: ${url.toString()}`);
    
    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Convert array to lookup object
    const nectarTimeLookup = {};
    data.nectar_data.forEach(item => {
      nectarTimeLookup[item.feature_id] = item.nectar_concentration;
    });
    
    if (useCache) {
      viewportCache.set(cacheKey, nectarTimeLookup);
    }
    
    console.log(`Loaded ${Object.keys(nectarTimeLookup).length} nectar features for time point ${timePoint}`);
    return nectarTimeLookup;
    
  } catch (error) {
    console.error(`Error loading viewport nectar data for time point ${timePoint}:`, error);
    throw error;
  }
}

/**
 * Load pollen data for a specific time point
 */
export async function loadTimePointPollenData(viewState, timePoint, options = {}) {
  const { bufferFactor = VIEWPORT_CONFIG.BUFFER_FACTOR, useCache = VIEWPORT_CONFIG.ENABLE_CACHING } = options;
  
  // If viewport queries are disabled, load full dataset for time point
  if (!VIEWPORT_CONFIG.USE_VIEWPORT_QUERIES) {
    console.log(`Viewport queries disabled - loading full pollen dataset for time point: ${timePoint}`);
    const cacheKey = `full_pollen_${timePoint}`;
    
    if (useCache) {
      const cached = viewportCache.get(cacheKey);
      if (cached) {
        console.log(`Using cached full pollen data for time point: ${timePoint}`);
        return cached;
      }
    }
    
    try {
      const response = await fetch(buildApiUrl(`/api/pollen/time-point/${timePoint}`));
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Convert to lookup object
      const pollenTimeLookup = {};
      data.pollen_data.forEach(item => {
        pollenTimeLookup[item.feature_id] = item.pollen_concentration;
      });
      
      if (useCache) {
        viewportCache.set(cacheKey, pollenTimeLookup);
      }
      
      console.log(`Loaded full pollen data for time point ${timePoint}: ${Object.keys(pollenTimeLookup).length} features`);
      return pollenTimeLookup;
      
    } catch (error) {
      console.error(`Error loading full pollen dataset for time point ${timePoint}:`, error);
      throw error;
    }
  }
  
  // Viewport-based loading for specific time point
  const bounds = calculateViewportBounds(viewState, bufferFactor);
  const [minLng, minLat, maxLng, maxLat] = bounds;
  
  const cacheKey = viewportCache.generateKey(bounds, viewState.zoom, `pollen_${timePoint}`);
  
  if (useCache) {
    const cached = viewportCache.get(cacheKey);
    if (cached) {
      console.log(`Using cached pollen data for time point: ${timePoint}`);
      return cached;
    }
  }
  
  try {
    const url = new URL(buildApiUrl(`/api/pollen/time-point/${timePoint}/viewport`));
    url.searchParams.set('min_lng', minLng.toString());
    url.searchParams.set('min_lat', minLat.toString());
    url.searchParams.set('max_lng', maxLng.toString());
    url.searchParams.set('max_lat', maxLat.toString());
    
    console.log(`Loading viewport pollen data for time point ${timePoint}: ${url.toString()}`);
    
    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Convert array to lookup object
    const pollenTimeLookup = {};
    data.pollen_data.forEach(item => {
      pollenTimeLookup[item.feature_id] = item.pollen_concentration;
    });
    
    if (useCache) {
      viewportCache.set(cacheKey, pollenTimeLookup);
    }
    
    console.log(`Loaded ${Object.keys(pollenTimeLookup).length} pollen features for time point ${timePoint}`);
    return pollenTimeLookup;
    
  } catch (error) {
    console.error(`Error loading viewport pollen data for time point ${timePoint}:`, error);
    throw error;
  }
}

/**
 * Load only time-specific nectar and pollen data (without GeoJSON)
 */
export async function loadTimePointData(viewState, timePoint, options = {}) {
  // If viewport queries are disabled, check for cached time-specific data
  if (!VIEWPORT_CONFIG.USE_VIEWPORT_QUERIES && VIEWPORT_CONFIG.ENABLE_CACHING) {
    console.log(`Viewport queries disabled - checking cached time-specific data for time point ${timePoint}`);
    
    const fullNectar = viewportCache.get(`full_nectar_${timePoint}`);
    const fullPollen = viewportCache.get(`full_pollen_${timePoint}`);
    
    // If we have cached data, return it immediately without making API calls
    if (fullNectar && fullPollen) {
      console.log(`Using cached time-specific data for time point ${timePoint} - no API calls needed`);
      return {
        nectar: fullNectar,
        pollen: fullPollen,
        timePoint: timePoint
      };
    }
    
    // If not cached, load once and cache
    console.log(`Loading time-specific data once for time point ${timePoint} for caching`);
  }
  
  try {
    const [nectarData, pollenData] = await Promise.all([
      loadTimePointNectarData(viewState, timePoint, options),
      loadTimePointPollenData(viewState, timePoint, options)
    ]);
    
    return {
      nectar: nectarData,
      pollen: pollenData,
      timePoint: timePoint
    };
  } catch (error) {
    console.error(`Error loading time-specific data for time point ${timePoint}:`, error);
    throw error;
  }
}

/**
 * Load all viewport data for a specific time point (GeoJSON + time-specific nectar + pollen)
 */
export async function loadViewportDataForTimePoint(viewState, timePoint, options = {}) {
  // If viewport queries are disabled, return cached full dataset immediately
  if (!VIEWPORT_CONFIG.USE_VIEWPORT_QUERIES) {
    console.log(`Viewport queries disabled - returning cached full dataset for time point ${timePoint}`);
    
    const fullGeoJson = viewportCache.get('full_geojson');
    const fullNectar = viewportCache.get(`full_nectar_${timePoint}`);
    const fullPollen = viewportCache.get(`full_pollen_${timePoint}`);
    
    // If we have cached data, return it immediately without making API calls
    if (fullGeoJson && fullNectar && fullPollen) {
      console.log(`Using cached full datasets for time point ${timePoint} - no API calls needed`);
      return {
        geoJson: fullGeoJson,
        nectar: fullNectar,
        pollen: fullPollen,
        timePoint: timePoint
      };
    }
    
    // If not cached, load once and cache
    console.log(`Loading full datasets once for time point ${timePoint} for caching`);
  }
  
  try {
    const [geoJsonData, nectarData, pollenData] = await Promise.all([
      loadViewportGeoJSON(viewState, options),
      loadTimePointNectarData(viewState, timePoint, options),
      loadTimePointPollenData(viewState, timePoint, options)
    ]);
    
    return {
      geoJson: geoJsonData,
      nectar: nectarData,
      pollen: pollenData,
      timePoint: timePoint
    };
  } catch (error) {
    console.error(`Error loading viewport data for time point ${timePoint}:`, error);
    throw error;
  }
}

/**
 * Load bee population data for a specific time point
 */
export async function loadBeePopulationData(timePoint) {
  try {
    console.log(`Loading bee population data for time point: ${timePoint}`);
    
    // Check cache first
    const cacheKey = `bee_population_${timePoint}`;
    if (VIEWPORT_CONFIG.ENABLE_CACHING) {
      const cached = viewportCache.get(cacheKey);
      if (cached) {
        console.log(`Using cached bee population data for time point ${timePoint}`);
        return cached;
      }
    }
    
    const response = await fetch(`${API_BASE_URL}/api/bee-population/time-point/${timePoint}`);
    if (!response.ok) {
      throw new Error(`Failed to load bee population data: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Cache the result
    if (VIEWPORT_CONFIG.ENABLE_CACHING) {
      viewportCache.set(cacheKey, data);
    }
    
    console.log(`Loaded bee population data for time point ${timePoint}`);
    return data;
    
  } catch (error) {
    console.error(`Error loading bee population data for time point ${timePoint}:`, error);
    throw error;
  }
}

/**
 * Load complete bee population time series
 */
export async function loadBeePopulationTimeSeries() {
  try {
    console.log('Loading complete bee population time series...');
    
    // Check cache first
    const cacheKey = 'bee_population_timeseries';
    if (VIEWPORT_CONFIG.ENABLE_CACHING) {
      const cached = viewportCache.get(cacheKey);
      if (cached) {
        console.log('Using cached bee population time series');
        return cached;
      }
    }
    
    const response = await fetch(`${API_BASE_URL}/api/bee-population/timeseries`);
    if (!response.ok) {
      throw new Error(`Failed to load bee population time series: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Cache the result
    if (VIEWPORT_CONFIG.ENABLE_CACHING) {
      viewportCache.set(cacheKey, data);
    }
    
    console.log('Loaded complete bee population time series');
    return data;
    
  } catch (error) {
    console.error('Error loading bee population time series:', error);
    throw error;
  }
}

/**
 * Load available bee population metrics
 */
export async function loadBeePopulationMetrics() {
  try {
    console.log('Loading bee population metrics...');
    
    const response = await fetch(`${API_BASE_URL}/api/bee-population/metrics`);
    if (!response.ok) {
      throw new Error(`Failed to load bee population metrics: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('Loaded bee population metrics:', data.metrics);
    return data.metrics;
    
  } catch (error) {
    console.error('Error loading bee population metrics:', error);
    throw error;
  }
}
