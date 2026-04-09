/**
 * Returns the base URL for the new Go orchestrator service (lzy-svc)
 */
export const getLzySvcBaseURL = (): string => {
  return import.meta.env.VITE_LZY_SVC_URL || "/api/v1/lzy-svc";
};

/**
 * Returns the current base URL for the frontend
 */
export const getFrontendBaseURL = (): string => {
  return import.meta.env.VITE_FRONTEND_URL || window.location.origin;
};

