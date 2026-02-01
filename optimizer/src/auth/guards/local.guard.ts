import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Local Auth Guard
 * Protects the login endpoint with username/password validation
 */
@Injectable()
export class LocalGuard extends AuthGuard('local') {}
