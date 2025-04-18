// Configuration utility functions

/**
 * Returns the base URL for API calls based on the environment
 */
export const getAPIBaseURL = (): string => {
  // For local development
  if (process.env.NODE_ENV === "development") {
    return "http://localhost:4000/api";
  }

  // For production
  return "/api";
};

/**
 * Returns the current base URL for the frontend
 */
export const getFrontendBaseURL = (): string => {
  return window.location.origin;
};
