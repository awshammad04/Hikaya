import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthenticatedRequest, readCookie, SESSION_COOKIE } from './session';

/** Rejects the request unless it carries a live session. */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = await this.auth.userForToken(readCookie(req, SESSION_COOKIE));
    if (!user) throw new UnauthorizedException('Sign in to use your account.');
    req.user = user;
    return true;
  }
}
