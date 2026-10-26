import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService, isReviewer } from './auth.service';
import { AuthenticatedRequest, readCookie, SESSION_COOKIE } from './session';

/**
 * Rejects the request unless it carries a live session for an editor or
 * admin. Visitors get 403 rather than 404 so the review page can say why.
 */
@Injectable()
export class ReviewerGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = await this.auth.userForToken(readCookie(req, SESSION_COOKIE));
    if (!user) throw new UnauthorizedException('Sign in to review stories.');
    if (!isReviewer(user))
      throw new ForbiddenException(
        'Only the review team can open the review queue.',
      );
    req.user = user;
    return true;
  }
}
