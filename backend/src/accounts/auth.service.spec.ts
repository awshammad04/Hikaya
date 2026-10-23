import {
  ConflictException,
  HttpException,
  UnauthorizedException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { IN_MEMORY_REPOSITORY_PROVIDERS } from '../testing/in-memory-providers';
import { ACCOUNTS_REPOSITORY } from '../database/repositories/tokens';
import type { AccountsRepository } from '../database/repositories/accounts.repository';

describe('AuthService', () => {
  let service: AuthService;
  let accounts: AccountsRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AuthService, ...IN_MEMORY_REPOSITORY_PROVIDERS],
    }).compile();

    service = module.get(AuthService);
    accounts = module.get(ACCOUNTS_REPOSITORY);
  });

  it('creates an account with a normalized email and a usable session', async () => {
    const { user, token } = await service.signUp(
      '  Layla  ',
      'Layla@Example.com',
      'olive-tree-1948',
    );
    expect(user.email).toBe('layla@example.com');
    expect(user.fullName).toBe('Layla');
    expect(user).not.toHaveProperty('passwordHash');
    expect((await service.userForToken(token))?.id).toBe(user.id);
  });

  it('never stores the password or the session token in plain text', async () => {
    const { user, token } = await service.signUp(
      'Layla',
      'layla@example.com',
      'olive-tree-1948',
    );
    const stored = await accounts.findUserById(user.id);
    expect(stored?.passwordHash).toMatch(/^scrypt\$/);
    expect(stored?.passwordHash).not.toContain('olive-tree-1948');
    expect(await accounts.findSessionUser(token)).toBeNull();
  });

  it('refuses a second account for the same email', async () => {
    await service.signUp('Layla', 'layla@example.com', 'olive-tree-1948');
    await expect(
      service.signUp('Other', 'LAYLA@example.com', 'another-pass-1'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('logs in with the right password only', async () => {
    await service.signUp('Layla', 'layla@example.com', 'olive-tree-1948');
    await expect(
      service.logIn('layla@example.com', 'wrong-password', 'client'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    const { user } = await service.logIn(
      'LAYLA@example.com',
      'olive-tree-1948',
      'client',
    );
    expect(user.email).toBe('layla@example.com');
  });

  it('throttles repeated failed logins from one client', async () => {
    await service.signUp('Layla', 'layla@example.com', 'olive-tree-1948');
    for (let attempt = 0; attempt < 8; attempt += 1)
      await expect(
        service.logIn('layla@example.com', 'guess', 'client'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    const blocked = await service
      .logIn('layla@example.com', 'olive-tree-1948', 'client')
      .catch((error: unknown) => error);
    expect(blocked).toBeInstanceOf(HttpException);
    expect((blocked as HttpException).getStatus()).toBe(429);
  });

  it('ends a session on logout', async () => {
    const { token } = await service.signUp(
      'Layla',
      'layla@example.com',
      'olive-tree-1948',
    );
    await service.logOut(token);
    expect(await service.userForToken(token)).toBeNull();
  });

  it('deletes the account and its data only with the password', async () => {
    const { user, token } = await service.signUp(
      'Layla',
      'layla@example.com',
      'olive-tree-1948',
    );
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
