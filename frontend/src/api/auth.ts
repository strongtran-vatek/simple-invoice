import { http, LOGIN_PATH } from './http'

export interface Credentials {
  email: string
  password: string
}

export interface LoginResponse {
  accessToken: string
  tokenType: 'Bearer'
  /** Token lifetime in seconds. */
  expiresIn: number
}

export interface UserProfile {
  id: string
  email: string
  fullname: string
}

export async function login(credentials: Credentials): Promise<LoginResponse> {
  const response = await http.post<LoginResponse>(LOGIN_PATH, credentials)
  return response.data
}

export async function fetchCurrentUser(): Promise<UserProfile> {
  const response = await http.get<UserProfile>('/auth/me')
  return response.data
}
