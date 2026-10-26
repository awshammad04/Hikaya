import {
  createHash,
  randomBytes,
  scrypt as scryptCallback,
  ScryptOptions,
  timingSafeEqual,
} from 'crypto';
import {
  ConflictException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import {
  type AccountsRepository,
  publicUser,
} from '../database/repositories/accounts.repository';
import { ACCOUNTS_REPOSITORY } from '../database/repositories/tokens';
import type { User, UserRole } from '../database/entities/account.entity';
import { SESSION_TTL_SECONDS } from './session';

const SCRYPT = { N: 16384, r: 8, p: 1, keyLength: 64 };
const MAX_FAILURES = 8;
const FAILURE_WINDOW_MS = 15 * 60 * 1000;

function scrypt(
  password: string,
  salt: Buffer,
  keyLength: number,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scryptCallback(password, salt, keyLength, options, (error, key) =>
      error ? reject(error) : resolve(key),
    ),
  );
}

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, SCRYPT.keyLength, SCRYPT);
  return [
    'scrypt',
    SCRYPT.N,
    SCRYPT.r,
    SCRYPT.p,
    salt.toString('base64'),
    key.toString('base64'),
  ].join('$');
}

async function verifyPassword(
  password: string,
  stored: string | null,
): Promise<boolean> {
  const [scheme, n, r, p, salt, expected] = (stored ?? '').split('$');
  if (scheme !== 'scrypt' || !salt || !expected) return false;
  const expectedKey = Buffer.from(expected, 'base64');
  const key = await scrypt(
    password,
    Buffer.from(salt, 'base64'),
    expectedKey.length,
    { N: Number(n), r: Number(r), p: Number(p) },
  );
  return timingSafeEqual(key, expectedKey);
}

const hashToken = (token: string) =>
  createHash('sha256').update(token).digest('hex');

/** Roles that may read the review queue and publish or reject submissions. */
const REVIEWER_ROLES: ReadonlySet<UserRole> = new Set(['editor', 'admin']);

export const isReviewer = (user: User | null | undefined): boolean =>
  Boolean(user && REVIEWER_ROLES.has(user.role));

/**
 * Accounts listed in HIKAYA_ADMIN_EMAILS act as admins without a database
 * edit, which is how the first reviewer is appointed on a fresh deployment.
 */
function withConfiguredRole(user: User): User {
  const admins = (process.env.HIKAYA_ADMIN_EMAILS ?? '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  return admins.includes(user.email.toLowerCase())
    ? { ...user, role: 'admin' }
    : user;
}

export interface SignedIn {
  user: User;
  token: string;
}

/**
 * Accounts for visitors who want their journey to follow them.
 *
 * Passwords are hashed with scrypt; sessions are random tokens of which only
 * the SHA-256 is stored. Failed logins are throttled per address and email so
 * a password cannot be guessed at speed.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly failures = new Map<
    string,
    { count: number; resetAt: number }
  >();

  constructor(
    @Inject(ACCOUNTS_REPOSITORY)
    private readonly accounts: AccountsRepository,
  ) {}

  async signUp(
    fullName: string,
    email: string,
    password: string,
  ): Promise<SignedIn> {
    const normalized = email.trim().toLowerCase();
    if (await this.accounts.findUserByEmail(normalized))
      throw new ConflictException(
        'An account with this email already exists. Log in instead.',
      );
    const user = await this.accounts.createUser({
      fullName: fullName.trim(),
      email: normalized,
      passwordHash: await hashPassword(password),
    });
    this.logger.log(`Account created for ${user.id}`);
    return {
      user: withConfiguredRole(user),
      token: await this.startSession(user.id),
    };
  }

  async logIn(
    email: string,
    password: string,
    client: string,
  ): Promise<SignedIn> {
    const normalized = email.trim().toLowerCase();
    const key = `${client}|${normalized}`;
    this.assertNotThrottled(key);
    const stored = await this.accounts.findUserByEmail(normalized);
    if (!stored || !(await verifyPassword(password, stored.passwordHash))) {
      this.recordFailure(key);
      throw new UnauthorizedException('The email or password is incorrect.');
    }
    this.failures.delete(key);
    await this.accounts.touchLogin(stored.id);
    const user = withConfiguredRole(publicUser(stored));
    return { user, token: await this.startSession(user.id) };
  }

  async logOut(token: string | undefined): Promise<void> {
    if (token) await this.accounts.deleteSession(hashToken(token));
  }

  async userForToken(token: string | undefined): Promise<User | null> {
    if (!token || token.length > 200) return null;
    const user = await this.accounts.findSessionUser(hashToken(token));
    return user && withConfiguredRole(user);
  }

  /** Permanently removes the account and everything attached to it. */
  async deleteAccount(user: User, password: string): Promise<void> {
    const stored = await this.accounts.findUserById(user.id);
    if (!stored || !(await verifyPassword(password, stored.passwordHash)))
      throw new UnauthorizedException('The password is incorrect.');
    await this.accounts.deleteUser(user.id);
    this.logger.log(`Account ${user.id} deleted by its owner`);
  }

  private async startSession(userId: string): Promise<string> {
    const token = randomBytes(32).toString('base64url');
    await this.accounts.createSession(
      hashToken(token),
      userId,
      new Date(Date.now() + SESSION_TTL_SECONDS * 1000),
    );
    return token;
  }

  private assertNotThrottled(key: string): void {
    const entry = this.failures.get(key);
    if (!entry) return;
    if (entry.resetAt <= Date.now()) {
      this.failures.delete(key);
      return;
    }
    if (entry.count >= MAX_FAILURES)
      throw new HttpException(
        'Too many failed attempts. Wait a few minutes and try again.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
  }

  private recordFailure(key: string): void {
    const entry = this.failures.get(key);
    if (entry && entry.resetAt > Date.now()) entry.count += 1;
    else
      this.failures.set(key, {
        count: 1,
        resetAt: Date.now() + FAILURE_WINDOW_MS,
      });
  }
}
