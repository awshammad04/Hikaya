import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { User } from '../database/entities/account.entity';
import { AuthService, Credentials } from './auth.service';
import { DeleteAccountDto, LogInDto, SignUpDto } from './dto/account.dto';
import {
  clearedSessionCookie,
  clientAddress,
  CurrentUser,
  readCookie,
  SESSION_COOKIE,
  sessionCookie,
} from './session';
import { SessionGuard } from './session.guard';

/**
 * Account endpoints. Accounts are optional - every feature works for guests.
 *
 * POST   /api/v1/auth/signup   -> create an account (name, phone) and sign in
 * POST   /api/v1/auth/login    -> sign in with a phone number, or an older email
 * POST   /api/v1/auth/logout   -> end this session
 * GET    /api/v1/auth/me       -> { user } for a session, { user: null } for a guest
 * DELETE /api/v1/auth/me       -> delete the account and all its data
 */
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('signup')
  @HttpCode(201)
  async signUp(
    @Body() dto: SignUpDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ user: User }> {
    const { user, token } = await this.auth.signUp(
      dto.name,
      dto.countryCode,
      dto.phone,
      dto.password,
    );
    res.setHeader('Set-Cookie', sessionCookie(token));
    return { user };
  }

  @Post('login')
  @HttpCode(200)
  async logIn(
    @Body() dto: LogInDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ user: User }> {
    const credentials: Credentials =
      dto.email !== undefined
        ? { email: dto.email }
        : { countryCode: dto.countryCode ?? '', phone: dto.phone ?? '' };
    const { user, token } = await this.auth.logIn(
      credentials,
      dto.password,
      clientAddress(req),
    );
    res.setHeader('Set-Cookie', sessionCookie(token));
    return { user };
  }

  @Post('logout')
  @HttpCode(204)
  async logOut(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.auth.logOut(readCookie(req, SESSION_COOKIE));
    res.setHeader('Set-Cookie', clearedSessionCookie());
  }

  @Get('me')
  async me(@Req() req: Request): Promise<{ user: User | null }> {
    return {
      user: await this.auth.userForToken(readCookie(req, SESSION_COOKIE)),
    };
  }

  @Delete('me')
  @UseGuards(SessionGuard)
  @HttpCode(204)
  async deleteAccount(
    @CurrentUser() user: User,
    @Body() dto: DeleteAccountDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.auth.deleteAccount(user, dto.password);
    res.setHeader('Set-Cookie', clearedSessionCookie());
  }
}
