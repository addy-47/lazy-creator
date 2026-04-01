import axios from "axios";
import { getToken, clearToken, emitSessionExpiredEvent } from "./tokenService";
import { getLzySvcBaseURL, getLzyDirectorBaseURL } from "./config";

// Create instances for different services
const lzySvcApi = axios.create({
  baseURL: getLzySvcBaseURL(),
  headers: {
    "Content-Type": "application/json",
  },
});

const lzyDirectorApi = axios.create({
  baseURL: getLzyDirectorBaseURL(),
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor to add token
const authInterceptor = (config: any) => {
  const token = getToken();
  if (token) {
    // Standard Authorization header
    config.headers.Authorization = `Bearer ${token}`;
    // Legacy support for x-access-token if needed by some endpoints
    config.headers["x-access-token"] = token;
  }
  return config;
};

lzySvcApi.interceptors.request.use(authInterceptor);
lzyDirectorApi.interceptors.request.use(authInterceptor);

// Response interceptor to handle 401s
const responseInterceptor = (response: any) => response;
const errorInterceptor = (error: any) => {
  if (error.response?.status === 401) {
    console.warn("Session expired or unauthorized. Clearing session...");
    clearToken();
    emitSessionExpiredEvent();
  }
  return Promise.reject(error);
};

lzySvcApi.interceptors.response.use(responseInterceptor, errorInterceptor);
lzyDirectorApi.interceptors.response.use(responseInterceptor, errorInterceptor);

/**
 * Authentication API
 */
export const authApi = {
  login: (credentials: any) => lzySvcApi.post('/auth/login', credentials),
  register: (userData: any) => lzySvcApi.post('/auth/register', userData),
  firebaseLogin: (idToken: string) => lzySvcApi.post('/auth/firebase-login', { id_token: idToken }),
};

/**
 * YouTube Connection API
 */
export const youtubeApi = {
  getStatus: () => lzySvcApi.get('/youtube-auth-status'),
  getChannels: () => lzySvcApi.get('/youtube/channels'),
  startAuth: (redirectUri: string) => lzySvcApi.get('/youtube/auth/start', { 
    params: { redirect_uri: redirectUri } 
  }),
  upload: (videoId: string, metadata: any) => lzySvcApi.post(`/youtube/upload/${videoId}`, metadata),
};

/**
 * Video Generation & Management API
 */
export const videoApi = {
  generate: (formData: FormData) => lzyDirectorApi.post('/api/v1/generate-short', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  getTaskStatus: (taskId: string) => lzyDirectorApi.get(`/api/v1/tasks/${taskId}`),
  getVideos: () => lzyDirectorApi.get('/api/v1/gallery'),
  getGallery: () => lzyDirectorApi.get('/api/v1/gallery'),
  getVideoUrl: (filename: string) => {
    const token = getToken();
    const base = getLzyDirectorBaseURL();
    // For direct video loading in <video> tags
    return `${base}/api/v1/gallery/${filename}${token ? `?token=${encodeURIComponent(token)}` : ''}`;
  },
  download: async (videoId: string, filename: string) => {
    const response = await lzyDirectorApi.get(`/api/v1/download/${videoId}`, { 
      responseType: 'blob' 
    });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },
  delete: (videoId: string) => lzyDirectorApi.delete(`/api/v1/videos/${videoId}`),
  cancel: (videoId: string) => lzyDirectorApi.post(`/api/v1/cancel-video/${videoId}`),
};
