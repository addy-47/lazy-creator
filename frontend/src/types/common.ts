export interface BaseResponse {
  status: string;
  message?: string;
}

export type ApiResponse<T> = BaseResponse & T;

export type Theme = "light" | "dark" | "system";

export interface PaginationParams {
  limit?: number;
  skip?: number;
}
