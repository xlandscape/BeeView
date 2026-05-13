/**
 * Centralized API configuration for the BeeForage frontend
 */

// Default API configuration
const DEFAULT_API_CONFIG = {
  protocol: 'http',
  host: 'localhost',
  port: 32000,
};

// Environment-based configuration
const getApiConfig = () => {
  return {
    protocol: import.meta.env.VITE_API_PROTOCOL || DEFAULT_API_CONFIG.protocol,
    host: import.meta.env.VITE_API_HOST || DEFAULT_API_CONFIG.host,
    port: import.meta.env.VITE_API_PORT || DEFAULT_API_CONFIG.port,
  };
};

// Build the complete API base URL
export const getApiBaseUrl = () => {
  // When served from BeeView-server (same origin), use current origin.
  // Otherwise fall back to explicit config or localhost:32000.
  if (!import.meta.env.VITE_API_HOST && !import.meta.env.VITE_API_PORT
      && typeof window !== 'undefined' && window.location.port !== '3000'
      && window.location.port !== '8081' && window.location.port !== '8082') {
    return window.location.origin;
  }
  const config = getApiConfig();
  return `${config.protocol}://${config.host}:${config.port}`;
};

// Export individual config values for convenience
export const API_CONFIG = getApiConfig();
export const API_BASE_URL = getApiBaseUrl();

// Helper function to build full API URLs
export const buildApiUrl = (endpoint) => {
  const baseUrl = getApiBaseUrl();
  // Ensure endpoint starts with /
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${baseUrl}${cleanEndpoint}`;
};

// Export for debugging
export const logApiConfig = () => {
  console.log('API Configuration:', {
    baseUrl: getApiBaseUrl(),
    config: getApiConfig(),
    environment: {
      VITE_API_PROTOCOL: import.meta.env.VITE_API_PROTOCOL,
      VITE_API_HOST: import.meta.env.VITE_API_HOST,
      VITE_API_PORT: import.meta.env.VITE_API_PORT,
    }
  });
};
