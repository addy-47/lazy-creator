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
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
};

lzySvcApi.interceptors.request.use(authInterceptor);
lzyDirectorApi.interceptors.request.use(authInterceptor);

// Response interceptor to handle 401s
const responseInterceptor = (response: any) => response;
const errorInterceptor = (error: any) => {
  if (error.response?.status === 401) {
    clearToken();
    emitSessionExpiredEvent();
  }
  return Promise.reject(error);
};

lzySvcApi.interceptors.response.use(responseInterceptor, errorInterceptor);
lzyDirectorApi.interceptors.response.use(responseInterceptor, errorInterceptor);

export { lzySvcApi, lzyDirectorApi };
