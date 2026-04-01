/**
 * Returns the base URL for the new Go orchestrator service (lzy-svc)
 */
export const getLzySvcBaseURL = (): string => {
  return import.meta.env.VITE_LZY_SVC_URL || "/api/v1/lzy-svc";
};

/**
 * Returns the base URL for the legacy Python video generation service (lzy-director)
 */
export const getLzyDirectorBaseURL = (): string => {
  return import.meta.env.VITE_LZY_DIRECTOR_URL || "/api/v1/lzy-director";
};

/**
 * Returns the current base URL for the frontend
 */
export const getFrontendBaseURL = (): string => {
  return import.meta.env.VITE_FRONTEND_URL || window.location.origin;
};

// Backwards compatibility for the old API base URL format if needed
export const getAPIBaseURL = getLzyDirectorBaseURL;
