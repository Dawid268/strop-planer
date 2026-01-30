import { Request } from 'express';

export interface JwtUserPayload {
  userId: string;
  email: string;
  role: string;
  sub?: string;
  refreshToken?: string;
}

export interface RequestWithUser extends Request {
  user: JwtUserPayload;
}
