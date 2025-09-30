import { buildApiUrl } from '../config/api';

/**
 * Load applications data for plant protection products
 * @param {Array} selectedFeatureIds - Optional array of feature IDs to filter by
 * @returns {Promise<Array>} Array of application objects
 */
export const loadApplicationsData = async (selectedFeatureIds = []) => {
  try {
    let url = buildApiUrl('/api/applications');
    
    // If features are selected, add them to the query
    if (selectedFeatureIds.length > 0) {
      const featureIdsStr = selectedFeatureIds.join(',');
      url += `?feature_ids=${featureIdsStr}`;
    }
    
    console.log('🌐 applicationsLoader: Fetching from URL:', url);
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('🌐 applicationsLoader: Raw API response structure:', {
      isObject: typeof data === 'object',
      hasApplicationsKey: 'applications' in data,
      applicationsLength: data.applications ? data.applications.length : 'N/A'
    });
    
    // Parse the applications data
    // Expected format: {"applications": [{lulc_feature_id: 123, application_day: 145, ...}, ...]}
    const result = data.applications || [];
    console.log('🌐 applicationsLoader: Parsed applications:', result.length, 'records');
    console.log('🌐 applicationsLoader: First application:', result[0]);
    return result;
    
  } catch (error) {
    console.error('Error loading applications data:', error);
    return [];
  }
};

/**
 * Parse applications from text file format if needed
 * @param {string} textData - Raw text data from applications.txt
 * @returns {Array} Parsed applications array
 */
export const parseApplicationsText = (textData) => {
  if (!textData) return [];
  
  const lines = textData.split('\n').filter(line => line.trim());
  const applications = [];
  
  // Skip header line if present
  const dataLines = lines[0].includes('feature_id') ? lines.slice(1) : lines;
  
  dataLines.forEach(line => {
    const parts = line.split('\t'); // Assuming tab-separated
    if (parts.length >= 2) {
      const application = {
        feature_id: parseInt(parts[0]) || 0,
        application_day: parseInt(parts[1]) || 0,
        // Add other fields as needed based on your file format
        concentration: parseFloat(parts[2]) || 0,
        contact: parts[3] || '',
        // ... add more fields as they exist in your file
      };
      applications.push(application);
    }
  });
  
  return applications;
};