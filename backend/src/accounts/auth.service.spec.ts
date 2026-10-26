import {
  BadRequestException,
  ConflictException,
  HttpException,
  UnauthorizedException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { IN_MEMORY_REPOSITORY_PROVIDERS } from '../testing/in-memory-providers';
import { ACCOUNTS_REPOSITORY } from '../database/repositories/tokens';
import type { AccountsRepository } from '../database/repositories/accounts.repository';

const LAYLA = { countryCode: '+970', phone: '0599123456' };

describe('AuthService', () => {
  let service: AuthService;
  let accounts: AccountsRepository;

  const signUpLayla = () =>
    service.signUp('Layla', LAYLA.countryCode, LAYLA.phone, 'olive-tree-1948');

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AuthService, ...IN_MEMORY_REPOSITORY_PROVIDERS],
    }).compile();

    service = module.get(AuthService);
    accounts = module.get(ACCOUNTS_REPOSITORY);
  });

  afterEach(() => {
    delete process.env.HIKAYA_ADMIN_PHONES;
  });

  const logIn = (phone: string, password: string, countryCode = '+970') =>
    service.logIn(countryCode, phone, password, 'client');

  it('creates an account with a normalized phone number and a usable session', async () => {
    const { user, token } = await service.signUp(
      '  Layla  ',
      '+970',
      '059 912 3456',
      'olive-tree-1948',
    );
    expect(user.phone).toBe('+970599123456');
    expect(user.email).toBeNull();
    expect(user.fullName).toBe('Layla');
    expect(user).not.toHaveProperty('passwordHash');
    expect((await service.userForToken(token))?.id).toBe(user.id);
  });

  it('refuses a number that cannot be real', async () => {
    await expect(
      service.signUp('Layla', '+970', '12345', 'olive-tree-1948'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('never stores the password or the session token in plain text', async () => {
    const { user, token } = await signUpLayla();
    const stored = await accounts.findUserById(user.id);
    expect(stored?.passwordHash).toMatch(/^scrypt\$/);
    expect(stored?.passwordHash).not.toContain('olive-tree-1948');
    expect(await accounts.findSessionUser(token)).toBeNull();
  });

  it('refuses a second account for the same number, however it is written', async () => {
    await signUpLayla();
    await expect(
      service.signUp('Other', '+972', '+970 59 912 3456', 'another-pass-1'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('logs in with the phone number and the right password only', async () => {
    await signUpLayla();
    await expect(logIn(LAYLA.phone, 'wrong-password')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    const { user } = await logIn('599 123 456', 'olive-tree-1948');
    expect(user.phone).toBe('+970599123456');
  });

  it('keeps an optional email, which is never a way to log in', async () => {
    const { user } = await service.signUp(
      'Layla',
      '+970',
      '0599123456',
      'olive-tree-1948',
      '  Layla@Example.com ',
    );
    expect(user.email).toBe('layla@example.com');
    await expect(
      service.signUp(
        'Sami',
        '+970',
        '0598765432',
        'another-pass-1',
        'LAYLA@example.com',
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    // The second sign-up was refused before anything was created.
    expect(await accounts.findUserByPhone('+970598765432')).toBeNull();
  });

  it('throttles repeated failed logins from one client', async () => {
    await signUpLayla();
    for (let attempt = 0; attempt < 8; attempt += 1)
      await expect(logIn(LAYLA.phone, 'guess')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    const blocked = await logIn(LAYLA.phone, 'olive-tree-1948').catch(
      (error: unknown) => error,
    );
    expect(blocked).toBeInstanceOf(HttpException);
    expect((blocked as HttpException).getStatus()).toBe(429);
  });

  it('makes only numbers listed in HIKAYA_ADMIN_PHONES admins', async () => {
    process.env.HIKAYA_ADMIN_PHONES = '+970 599 123 456, 970522222222';
    const { user, token } = await signUpLayla();
    expect(user.role).toBe('admin');
    expect((await service.userForToken(token))?.role).toBe('admin');

    const other = await service.signUp(
      'Sami',
      '+970',
      '0598765432',
      'olive-tree-1948',
    );
    expect(other.user.role).toBe('visitor');
  });

  it('ends a session on logout', async () => {
    const { token } = await signUpLayla();
    await service.logOut(token);
    expect(await service.userForToken(token)).toBeNull();
  });

  it('deletes the account and its data only with the password', async () => {
    const { user, token } = await signUpLayla();
    await accounts.addProgress(user.id, { visited: ['silwan'] });
    await expect(
      service.deleteAccount(user, 'wrong-password'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    await service.deleteAccount(user, 'olive-tree-1948');
    expect(await accounts.findUserById(user.id)).toBeNull();
    expect(await service.userForToken(token)).toBeNull();
    expect((await accounts.getProgress(user.id)).visited).toEqual([]);
  });
});
