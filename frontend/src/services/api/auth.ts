import { AxiosResponse } from "axios";
import { lzySvcApi, handleApiError } from "./client";
import { AuthResponseData } from "@/types/auth";
import { ApiResponse, BaseResponse } from "@/types/common";


/**
 * Authentication API
 */
export const authApi = {
  login: async (credentials: Record<string, string>): Promise<AxiosResponse<ApiResponse<AuthResponseData>>> => {
    try {
      const response = await lzySvcApi.post('/auth/login', credentials);
      return response;
    } catch (error) {
      handleApiError(error);
    }
  },
  
  register: async (userData: Record<string, unknown>): Promise<AxiosResponse<ApiResponse<AuthResponseData>>> => {
    try {
      const response = await lzySvcApi.post('/auth/register', userData);
      return response;
    } catch (error) {
      handleApiError(error);
    }
  },
  
  getGoogleAuthUrl: async (): Promise<AxiosResponse<ApiResponse<{ url: string }>>> => {
    try {
      const response = await lzySvcApi.get('/auth/google-url');
      return response;
    } catch (error) {
      handleApiError(error);
    }
  },
  
  refreshToken: async (): Promise<AxiosResponse<ApiResponse<{ token: string }>>> => {
    try {
      const response = await lzySvcApi.post('/auth/refresh');
      return response;
    } catch (error) {
      handleApiError(error);
    }
  },
  
  logout: async (): Promise<AxiosResponse<BaseResponse>> => {
    try {
      const response = await lzySvcApi.post('/auth/logout');
      return response;
    } catch (error) {
      handleApiError(error);
    }
  },
};
