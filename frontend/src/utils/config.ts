// Configuration utility functions

/**
 * Returns the base URL for API calls based on the environment
 */
export const getAPIBaseURL = (): string => {
  return import.meta.env.VITE_API_URL || "/api";
};

/**
 * Returns the current base URL for the frontend
 */
export const getFrontendBaseURL = (): string => {
  return window.location.origin;
};
