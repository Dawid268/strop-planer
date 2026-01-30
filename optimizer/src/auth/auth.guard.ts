import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class AtGuard extends AuthGuard('jwt') {}

@Injectable()
export class RtGuard extends AuthGuard('jwt-refresh') {}

@Injectable()
export class LocalAuthGuard extends AuthGuard('local') {}
