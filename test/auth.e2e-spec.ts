import { createHash } from 'node:crypto';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Response } from 'supertest';
import { api, createTestApp, type TestApp } from './utils/app.js';
import { disconnectDatabase, prisma, resetDatabase } from './utils/db.js';
import {
  createAdmin,
  createCustomer,
  createReceptionist,
} from './utils/factories.js';

// HTL-35.2 authentication regression suite. Covers the auth API that is in this build:
// login, refresh, logout, profile read, lockout, and the login rate limit.
describe('Authentication regression', () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createTestApp((builder) =>
      builder.overrideGuard(ThrottlerGuard).useValue({ canActivate: () => true }),
    );
  });

  beforeEach(resetDatabase);

  afterAll(async () => {
    await app.close();
    await disconnectDatabase();
  });

  describe('FR-AUTH-02 login and logout', () => {
    it('returns the signed-in role so the client can open the right area', async () => {
      const users = await Promise.all([
        createAdmin(),
        createReceptionist(),
        createCustomer(),
      ]);

      for (const user of users) {
        const response = await api(app).post('/api/v1/auth/login').send({
          email: user.email,
          password: user.password,
        });

        expect(response.status).toBe(200);
        expect(response.body.user.role).toBe(user.role);
        expect(response.body.user.mustResetPw).toBe(false);
        expect(response.body.accessToken).toEqual(expect.any(String));
        expect(response.body.refreshToken).toBeUndefined();
        expectNoSecret(response.body);
      }
    });

    it('logs in when the email differs only by capitalisation or surrounding spaces', async () => {
      const customer = await createCustomer({ email: 'rahim@example.com' });

      const response = await api(app).post('/api/v1/auth/login').send({
        email: '  Rahim@Example.com  ',
        password: customer.password,
      });

      expect(response.status).toBe(200);
      expect(response.body.user.email).toBe('rahim@example.com');
      expectNoSecret(response.body);
    });

    it('uses the same 401 message for an unknown email and a wrong password', async () => {
      const customer = await createCustomer();

      const unknown = await api(app).post('/api/v1/auth/login').send({
        email: 'nobody@example.com',
        password: 'Password@123',
      });
      const wrong = await api(app).post('/api/v1/auth/login').send({
        email: customer.email,
        password: 'not-the-password',
      });

      expect(unknown.status).toBe(401);
      expect(wrong.status).toBe(401);
      expect(unknown.body.message).toBe('Invalid email or password');
      expect(wrong.body.message).toBe(unknown.body.message);
      expectNoSecret(unknown.body);
      expectNoSecret(wrong.body);
    });

    it('rejects an empty, missing, or malformed login without revealing secrets', async () => {
      const customer = await createCustomer();
      const bodies = [
        { email: customer.email, password: '' },
        { email: customer.email },
        { email: 'not-an-email', password: customer.password },
        { password: customer.password },
      ];

      for (const body of bodies) {
        const response = await api(app).post('/api/v1/auth/login').send(body);
        expect(response.status).toBe(400);
        expectNoSecret(response.body);
      }

      const stored = await prisma.user.findUnique({ where: { id: customer.id } });
      expect(stored?.failedLogins).toBe(0);
    });

    it('counts a whitespace password as a failed login', async () => {
      const customer = await createCustomer();

      const response = await api(app).post('/api/v1/auth/login').send({
        email: customer.email,
        password: '   ',
      });

      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Invalid email or password');
      expectNoSecret(response.body);

      const stored = await prisma.user.findUnique({ where: { id: customer.id } });
      expect(stored?.failedLogins).toBe(1);
    });


    it('tells a deactivated user the account is inactive after the correct password', async () => {

    it('rejects a deactivated account after the right password', async () => {

      const customer = await createCustomer({ isActive: false });

      const response = await api(app).post('/api/v1/auth/login').send({
        email: customer.email,
        password: customer.password,
      });

      expect(response.status).toBe(403);
      expect(response.body.code).toBe('ACCOUNT_INACTIVE');
      expect(response.body).toMatchObject({
        statusCode: 403,
        code: 'ACCOUNT_INACTIVE',
        message: 'Your account is deactivated. Please contact the hotel.',
      });
      expectNoSecret(response.body);
    });

    it('returns mustResetPw so a temporary password can be forced to change', async () => {
      const receptionist = await createReceptionist({ mustResetPw: true });

      const response = await api(app).post('/api/v1/auth/login').send({
        email: receptionist.email,
        password: receptionist.password,
      });

      expect(response.status).toBe(200);
      expect(response.body.user.role).toBe('RECEPTIONIST');
      expect(response.body.user.mustResetPw).toBe(true);
    });

    it('issues a 15-minute access token and a hashed 7-day refresh cookie', async () => {
      const customer = await createCustomer();
      const response = await api(app).post('/api/v1/auth/login').send({
        email: customer.email,
        password: customer.password,
      });

      expect(response.status).toBe(200);
      const payload = JSON.parse(
        Buffer.from(response.body.accessToken.split('.')[1], 'base64url').toString(),
      );
      expect(payload.role).toBe('CUSTOMER');
      expect(payload.sub).toBe(customer.id.toString());
      expect(payload.exp - payload.iat).toBe(15 * 60);

      const cookie = setCookie(response, 'refreshToken');
      expect(cookie.toLowerCase()).toContain('httponly');
      expect(cookie).toContain('Path=/api/v1/auth');
      expect(cookie.toLowerCase()).toContain('samesite=strict');
      expect(cookie).toContain('Max-Age=604800');

      const raw = cookieValue(cookie);
      const stored = await prisma.refreshToken.findUnique({
        where: { tokenHash: sha256(raw) },
      });
      expect(stored).not.toBeNull();
      expect(stored?.tokenHash).not.toBe(raw);
      expect(stored!.expiresAt.getTime()).toBeGreaterThan(Date.now() + 6 * 24 * 60 * 60 * 1000);
    });

    it('revokes the refresh token on logout', async () => {
      const customer = await createCustomer();
      const login = await api(app)
        .post('/api/v1/auth/login')
        .send({ email: customer.email, password: customer.password })
        .expect(200);
      const refreshToken = cookieValue(setCookie(login, 'refreshToken'));

      const logout = await api(app)
        .post('/api/v1/auth/logout')
        .set('Cookie', `refreshToken=${refreshToken}`);
      expect(logout.status).toBe(201);
      expect(logout.body.message).toBe('Logged out successfully');

      const refresh = await api(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', `refreshToken=${refreshToken}`);
      expect(refresh.status).toBe(401);
    });

    it('rotates a refresh token and rejects reuse of the old one', async () => {
      const customer = await createCustomer();
      const login = await api(app)
        .post('/api/v1/auth/login')
        .send({ email: customer.email, password: customer.password })
        .expect(200);
      const original = cookieValue(setCookie(login, 'refreshToken'));

      const rotated = await api(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', `refreshToken=${original}`)
        .expect(201);
      const replacement = cookieValue(setCookie(rotated, 'refreshToken'));
      expect(rotated.body.accessToken).toEqual(expect.any(String));
      expect(rotated.body.refreshToken).toBeUndefined();
      expect(replacement).not.toBe(original);

      await api(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', `refreshToken=${original}`)
        .expect(401);

      await api(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', `refreshToken=${replacement}`)
        .expect(201);
    });

    it('rejects a refresh request with no cookie', async () => {
      await api(app).post('/api/v1/auth/refresh').expect(401);
    });

    it('logs out when no refresh cookie is present', async () => {
      const logout = await api(app).post('/api/v1/auth/logout');

      expect(logout.status).toBe(201);
      expect(logout.body.message).toBe('Logged out successfully');
      expectNoSecret(logout.body);
    });
  });

  describe('FR-AUTH-04 profile', () => {
    it('returns the signed-in profile', async () => {
      const customer = await createCustomer();
      const token = await tokenFor(customer.email, customer.password);

      const me = await api(app)
        .get('/api/v1/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(me.body).toMatchObject({
        id: customer.id.toString(),
        fullName: customer.fullName,
        email: customer.email,
        role: 'CUSTOMER',
        mustResetPw: false,
      });
      expectNoSecret(me.body);
    });

    it('requires a valid access token', async () => {
      await api(app).get('/api/v1/me').expect(401);
      await api(app)
        .get('/api/v1/me')
        .set('Authorization', 'Bearer not-a-token')
        .expect(401);
    });
  });

  describe('FR-AUTH-05 failed-login lockout', () => {
    it('locks the account on the 6th attempt and sends Retry-After', async () => {
      const customer = await createCustomer();

      for (let attempt = 0; attempt < 5; attempt += 1) {
        const failed = await api(app).post('/api/v1/auth/login').send({
          email: customer.email,
          password: 'wrong-password',
        });
        expect(failed.status).toBe(401);
        expect(failed.body.message).toBe('Invalid email or password');
      }

      const locked = await api(app).post('/api/v1/auth/login').send({
        email: customer.email,
        password: customer.password,
      });

      expect(locked.status).toBe(429);
      expect(locked.body.code).toBe('TEMPORARILY_LOCKED');
      expect(Number(locked.headers['retry-after'])).toBeGreaterThan(0);
    });

    it('clears the failure count after a successful login', async () => {
      const customer = await createCustomer();

      for (let attempt = 0; attempt < 4; attempt += 1) {
        await api(app)
          .post('/api/v1/auth/login')
          .send({ email: customer.email, password: 'wrong-password' })
          .expect(401);
      }

      await api(app)
        .post('/api/v1/auth/login')
        .send({ email: customer.email, password: customer.password })
        .expect(200);

      await api(app)
        .post('/api/v1/auth/login')
        .send({ email: customer.email, password: 'wrong-password' })
        .expect(401);

      const stored = await prisma.user.findUnique({ where: { id: customer.id } });
      expect(stored?.failedLogins).toBe(1);
      expect(stored?.lockedUntil).toBeNull();
    });
  });

  describe('NFR-SEC-08 login rate limit', () => {
    let limited: TestApp;

    beforeAll(async () => {
      limited = await createTestApp();
    });

    afterAll(async () => {
      await limited.close();
    });

    it('returns 429 on the 11th login from the same client within a minute', async () => {
      for (let attempt = 0; attempt < 10; attempt += 1) {
        const response = await api(limited).post('/api/v1/auth/login').send({
          email: `nobody${attempt}@example.com`,
          password: 'Password@123',
        });
        expect(response.status).toBe(401);
      }

      const blocked = await api(limited).post('/api/v1/auth/login').send({
        email: 'nobody10@example.com',
        password: 'Password@123',
      });

      expect(blocked.status).toBe(429);
      expectNoSecret(blocked.body);
    });
  });

  describe('FR-AUTH-01 customer registration', () => {
    it('registers a customer who can log in at once', async () => {
      const response = await api(app).post('/api/v1/auth/register').send({
        fullName: 'Rahim',
        email: 'Rahim@Example.com',
        mobile: '01711000001',
        password: 'Str0ng!Pass',
      });

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        fullName: 'Rahim',
        email: 'rahim@example.com',
        mobile: '01711000001',
        role: 'CUSTOMER',
        mustResetPw: false,
        isActive: true,
      });

      const stored = await prisma.user.findUnique({
        where: { email: 'rahim@example.com' },
      });
      expect(stored?.passwordHash.startsWith('$argon2id$v=19$m=19456,t=2,p=1$')).toBe(true);
      expect(stored?.passwordHash).not.toContain('Str0ng!Pass');

      await api(app)
        .post('/api/v1/auth/login')
        .send({ email: 'rahim@example.com', password: 'Str0ng!Pass' })
        .expect(200);
    });

    it('returns 409 EMAIL_TAKEN when the email is already registered', async () => {
      await api(app).post('/api/v1/auth/register').send(registration()).expect(201);

      const duplicate = await api(app)
        .post('/api/v1/auth/register')
        .send(registration({ email: 'RAHIM@example.com' }));

      expect(duplicate.status).toBe(409);
      expect(duplicate.body.code).toBe('EMAIL_TAKEN');
      expect(await prisma.user.count()).toBe(1);
    });

    it('rejects self-registration with a staff role', async () => {
      for (const role of ['RECEPTIONIST', 'ADMIN']) {
        const response = await api(app)
          .post('/api/v1/auth/register')
          .send(registration({ email: `${role.toLowerCase()}@example.com`, role }));

        expect(response.status).toBe(422);
        expect(JSON.stringify(response.body)).toContain('role');
      }

      expect(await prisma.user.count()).toBe(0);
    });
  });

  describe('FR-AUTH-03 staff accounts', () => {
    it('requires a new password at first login for a receptionist created by an admin', async () => {
      const admin = await createAdmin();
      const adminToken = await tokenFor(admin.email, admin.password);

      const created = await api(app)
        .post('/api/v1/admin/staff')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          fullName: 'Nadia',
          email: 'nadia@example.com',
          mobile: '01711000002',
          password: 'TempPass1',
        });

      expect(created.status).toBe(201);
      expect(created.body).toMatchObject({
        fullName: 'Nadia',
        role: 'RECEPTIONIST',
        mustResetPw: true,
      });

      const firstLogin = await api(app).post('/api/v1/auth/login').send({
        email: 'nadia@example.com',
        password: 'TempPass1',
      });
      expect(firstLogin.status).toBe(200);
      expect(firstLogin.body.user.mustResetPw).toBe(true);

      await api(app)
        .post('/api/v1/me/password')
        .set('Authorization', `Bearer ${firstLogin.body.accessToken}`)
        .send({ currentPassword: 'TempPass1', newPassword: 'NewPass123' })
        .expect(200);

      const nextLogin = await api(app)
        .post('/api/v1/auth/login')
        .send({ email: 'nadia@example.com', password: 'NewPass123' })
        .expect(200);
      expect(nextLogin.body.user.mustResetPw).toBe(false);
    });

    it('deactivates a receptionist immediately and allows reactivation', async () => {
      const admin = await createAdmin();
      const adminToken = await tokenFor(admin.email, admin.password);
      const created = await api(app)
        .post('/api/v1/admin/staff')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          fullName: 'Nadia',
          email: 'nadia@example.com',
          mobile: '01711000002',
          password: 'TempPass1',
        })
        .expect(201);

      const login = await api(app)
        .post('/api/v1/auth/login')
        .send({ email: 'nadia@example.com', password: 'TempPass1' })
        .expect(200);
      const refreshToken = cookieValue(setCookie(login, 'refreshToken'));

      const deactivated = await api(app)
        .patch(`/api/v1/admin/staff/${created.body.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isActive: false });
      expect(deactivated.status).toBe(200);
      expect(deactivated.body.isActive).toBe(false);

      await api(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', `refreshToken=${refreshToken}`)
        .expect(401);

      const blocked = await api(app).post('/api/v1/auth/login').send({
        email: 'nadia@example.com',
        password: 'TempPass1',
      });
      expect(blocked.status).toBe(403);
      expect(blocked.body.code).toBe('ACCOUNT_INACTIVE');

      await api(app)
        .patch(`/api/v1/admin/staff/${created.body.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isActive: true })
        .expect(200);

      await api(app)
        .post('/api/v1/auth/login')
        .send({ email: 'nadia@example.com', password: 'TempPass1' })
        .expect(200);
    });

    it('forbids customers and receptionists from managing staff', async () => {
      const [customer, receptionist] = await Promise.all([
        createCustomer(),
        createReceptionist(),
      ]);

      for (const user of [customer, receptionist]) {
        const token = await tokenFor(user.email, user.password);
        const response = await api(app)
          .post('/api/v1/admin/staff')
          .set('Authorization', `Bearer ${token}`)
          .send({
            fullName: 'Nadia',
            email: 'nadia@example.com',
            mobile: '01711000002',
            password: 'TempPass1',
          });
        expect(response.status).toBe(403);
      }

      await api(app).post('/api/v1/admin/staff').send({}).expect(401);
    });

    it('does not let the only admin deactivate themselves', async () => {
      const admin = await createAdmin();
      const adminToken = await tokenFor(admin.email, admin.password);

      const response = await api(app)
        .patch(`/api/v1/admin/staff/${admin.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isActive: false });

      expect(response.status).toBe(403);
      const stored = await prisma.user.findUnique({ where: { id: admin.id } });
      expect(stored?.isActive).toBe(true);
    });
  });

  describe('FR-AUTH-04 password change', () => {
    it('rejects a password change when the current password is wrong', async () => {
      const customer = await createCustomer();
      const token = await tokenFor(customer.email, customer.password);

      const response = await api(app)
        .post('/api/v1/me/password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentPassword: 'not-the-password',
          newPassword: 'NewPass123',
        });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('CURRENT_PASSWORD_WRONG');
    });

    it('changes the password and revokes existing refresh tokens', async () => {
      const customer = await createCustomer();
      const login = await api(app)
        .post('/api/v1/auth/login')
        .send({ email: customer.email, password: customer.password })
        .expect(200);
      const refreshToken = cookieValue(setCookie(login, 'refreshToken'));

      await api(app)
        .post('/api/v1/me/password')
        .set('Authorization', `Bearer ${login.body.accessToken}`)
        .send({
          currentPassword: customer.password,
          newPassword: 'NewPass123',
        })
        .expect(200);

      await api(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', `refreshToken=${refreshToken}`)
        .expect(401);
      await api(app)
        .post('/api/v1/auth/login')
        .send({ email: customer.email, password: 'NewPass123' })
        .expect(200);
    });
  });

  async function tokenFor(email: string, password: string): Promise<string> {
    const response = await api(app)
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);
    return response.body.accessToken as string;
  }
});

function registration(overrides: Record<string, string> = {}) {
  return {
    fullName: 'Rahim',
    email: 'rahim@example.com',
    mobile: '01711000001',
    password: 'Str0ng!Pass',
    ...overrides,
  };
}

function expectNoSecret(body: unknown): void {
  expect(JSON.stringify(body)).not.toMatch(/passwordHash|password_hash|\$argon2|\$2[aby]\$/i);
}

function setCookie(response: Response, name: string): string {
  const header = response.headers['set-cookie'];
  const cookies = Array.isArray(header) ? header : header ? [header] : [];
  const found = cookies.find((cookie) => cookie.startsWith(`${name}=`));
  expect(found).toBeDefined();
  return found!;
}

function cookieValue(cookie: string): string {
  return cookie.split(';')[0].slice(cookie.indexOf('=') + 1);
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

