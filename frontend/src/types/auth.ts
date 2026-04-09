export interface UserProfile {
  id: string;
  email: string;
  name: string;
  picture?: string;
}

export interface AuthResponseData {
  token: string;
  user: UserProfile;
}

export interface JWTPayload {
  id: string;
  email: string;
  exp: number;
  iat: number;
}
