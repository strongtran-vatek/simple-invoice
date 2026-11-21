import type { Request } from 'express';

/** Claims carried by an access token. */
export interface JwtPayload {
  /** The user's id. */
  sub: string;
  email: string;
}

/** The signed-in user, as attached to the request by the guard. */
export interface AuthenticatedUser {
  id: string;
  email: string;
  fullname: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}
