import {
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
} from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

import { RequestWithUser } from '../interfaces/request-with-user.interface';

export const GetCurrentUser = createParamDecorator(
  (
    data: keyof RequestWithUser['user'] | undefined,
    context: ExecutionContext,
  ) => {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    if (!data) return request.user;
    return request.user[data];
  },
);

export const GetCurrentUserId = createParamDecorator(
  (_: undefined, _context: ExecutionContext): string => {
    const request = _context.switchToHttp().getRequest<RequestWithUser>();
    return request.user.sub || request.user.userId;
  },
);
