import { lzySvcApi, handleApiError } from "./client";

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  name: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  picture?: string;
}

export interface AuthResponse {
  status: string;
  token: string;
  user: User;
}

/**
 * Authentication API
 */
export const authApi = {
  login: async (credentials: LoginCredentials): Promise<{ data: AuthResponse }> => {
    try {
      const response = await lzySvcApi.post('/auth/login', credentials);
      return response;
    } catch (error) {
      handleApiError(error);
    }
  },
  
  register: async (userData: RegisterData): Promise<{ data: AuthResponse }> => {
    try {
      const response = await lzySvcApi.post('/auth/register', userData);
      return response;
    } catch (error) {
      handleApiError(error);
    }
  },
  
  firebaseLogin: async (idToken: string): Promise<{ data: AuthResponse }> => {
    try {
      const response = await lzySvcApi.post('/auth/firebase-login', { id_token: idToken });
      return response;
    } catch (error) {
      handleApiError(error);
    }
  },
  
  googleLogin: async (idToken: string): Promise<{ data: AuthResponse }> => {
    try {
      const response = await lzySvcApi.post('/auth/google-login', { id_token: idToken });
      return response;
    } catch (error) {
      handleApiError(error);
    }
  },
  
  getGoogleAuthUrl: async (): Promise<{ data: { status: string; auth_url: string; state: string } }> => {
    try {
      const response = await lzySvcApi.get('/auth/google-url');
      return response;
    } catch (error) {
      handleApiError(error);
    }
  },
  
  refreshToken: async (): Promise<{ data: { token: string } }> => {
    try {
      const response = await lzySvcApi.post('/auth/refresh');
      return response;
    } catch (error) {
      handleApiError(error);
    }
  },
  
  logout: async (): Promise<{ data: { status: string; message: string } }> => {
    try {
      const response = await lzySvcApi.post('/auth/logout');
      return response;
    } catch (error) {
      handleApiError(error);
    }
  },
};
