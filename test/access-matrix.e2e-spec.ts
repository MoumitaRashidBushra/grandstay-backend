import { ThrottlerGuard } from '@nestjs/throttler';
import type { User } from '@prisma/client';
import type { TestApp } from './utils/app.js';
import { api, createTestApp } from './utils/app.js';
import { disconnectDatabase, resetDatabase } from './utils/db.js';
import {
  createAdmin,
  createCustomer,
  createReceptionist,
} from './utils/factories.js';

// HTL-35.3 role and ownership access matrix.
// NFR-SEC-03: every mounted endpoint is called with no token and with each role.
// NFR-SEC-04: a profile read follows the token subject. A different user id in the
// path or query does not return that person's profile.
// Staff, admin, booking, and invoice routes are not mounted in this build.

const ROLES = ['ADMIN', 'RECEPTIONIST', 'CUSTOMER'] as const;
type Role = (typeof ROLES)[number];
type Actor = Role | 'anonymous';

const ACTORS: Actor[] = ['anonymous', ...ROLES];

type Account = User & { password: string };
type Method = 'GET' | 'POST';

type Endpoint = {
  method: Method;
  path: string;
  body?: Record<string, unknown>;
  expect: Record<Actor, number>;
};

const ENDPOINTS: Endpoint[] = [
  {
    method: 'GET',
    path: '/api/v1',
    expect: { anonymous: 200, ADMIN: 200, RECEPTIONIST: 200, CUSTOMER: 200 },
  },
  {
    method: 'POST',
    path: '/api/v1/auth/login',
    body: {},
    expect: { anonymous: 400, ADMIN: 400, RECEPTIONIST: 400, CUSTOMER: 400 },
  },
  {
    method: 'POST',
    path: '/api/v1/auth/refresh',
    expect: { anonymous: 401, ADMIN: 401, RECEPTIONIST: 401, CUSTOMER: 401 },
  },
  {
    method: 'POST',
    path: '/api/v1/auth/logout',
    expect: { anonymous: 201, ADMIN: 201, RECEPTIONIST: 201, CUSTOMER: 201 },
  },
  {
    method: 'GET',
    path: '/api/v1/me',
    expect: { anonymous: 401, ADMIN: 200, RECEPTIONIST: 200, CUSTOMER: 200 },
  },
];

const MATRIX = ENDPOINTS.flatMap((endpoint) =>
  ACTORS.map((actor) => ({
    method: endpoint.method,
    path: endpoint.path,
    body: endpoint.body,
    actor,
    status: endpoint.expect[actor],
  })),
);

describe('Role and ownership access matrix', () => {
  let app: TestApp;
  let users: Record<Role, Account>;
  let otherCustomer: Account;
  let tokens: Record<Role, string>;

  beforeAll(async () => {
    app = await createTestApp((builder) =>
      builder.overrideGuard(ThrottlerGuard).useValue({ canActivate: () => true }),
    );
    await resetDatabase();

    const [admin, receptionist, customer, stranger] = await Promise.all([
      createAdmin(),
      createReceptionist(),
      createCustomer(),
      createCustomer(),
    ]);
    users = { ADMIN: admin, RECEPTIONIST: receptionist, CUSTOMER: customer };
    otherCustomer = stranger;
    tokens = {
      ADMIN: await accessToken(admin.email, admin.password),
      RECEPTIONIST: await accessToken(receptionist.email, receptionist.password),
      CUSTOMER: await accessToken(customer.email, customer.password),
    };
  });

  afterAll(async () => {
    await app.close();
    await disconnectDatabase();
  });

  describe('NFR-SEC-03 every endpoint and role', () => {
    it('covers every mounted route', () => {
      const expected = ENDPOINTS.map(({ method, path }) => ({ method, path })).sort(
        (a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method),
      );
      expect(mountedRoutes(app)).toEqual(expected);
    });

    it.each(MATRIX)(
      '$method $path as $actor returns $status',
      async ({ method, path, body, actor, status }) => {
        const response = await call(actor, method, path, body);

        expect(response.status).toBe(status);
        expectNoSecret(response.body);

        if (path === '/api/v1' && status === 200) {
          expect(response.text).toBe('Hello World!');
        }

        if (path === '/api/v1/auth/refresh') {
          expect(response.body.message).toBe('Invalid refresh token');
        }

        if (path === '/api/v1/auth/logout' && status === 201) {
          expect(response.body.message).toBe('Logged out successfully');
        }

        if (path === '/api/v1/me' && status === 401) {
          expect(response.body.message).toBe('Unauthorized');
        }

        if (path === '/api/v1/me' && status === 200 && actor !== 'anonymous') {
          expectOwnProfile(response.body, users[actor]);
          const payload = JSON.stringify(response.body);
          expect(payload).not.toContain(otherCustomer.email);
          for (const role of ROLES) {
            if (role !== actor) expect(payload).not.toContain(users[role].email);
          }
        }
      },
    );
  });

  describe('NFR-SEC-04 profile ownership', () => {
    it.each(ROLES)(
      '%s keeps their own profile when the query names someone else',
      async (role) => {
        const response = await call(role, 'GET', '/api/v1/me', undefined, {
          id: otherCustomer.id.toString(),
        });

        expect(response.status).toBe(200);
        expectOwnProfile(response.body, users[role]);
        expect(JSON.stringify(response.body)).not.toContain(otherCustomer.email);
        expect(JSON.stringify(response.body)).not.toContain(otherCustomer.fullName);
      },
    );

    it.each(ACTORS)(
      '%s cannot open another user by putting their id in the profile path',
      async (actor) => {
        const response = await call(
          actor,
          'GET',
          `/api/v1/me/${otherCustomer.id.toString()}`,
        );

        expect(response.status).toBe(404);
        const body = JSON.stringify(response.body);
        expect(body).not.toContain(otherCustomer.email);
        expect(body).not.toContain(otherCustomer.fullName);
        const mobile = otherCustomer.mobile?.trim();
        if (mobile) expect(body).not.toContain(mobile);
      },
    );
  });

  async function accessToken(email: string, password: string): Promise<string> {
    const response = await api(app)
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);
    return response.body.accessToken as string;
  }

  function call(
    actor: Actor,
    method: Method,
    path: string,
    body?: Record<string, unknown>,
    query?: Record<string, string>,
  ) {
    const request = api(app)[method.toLowerCase() as 'get' | 'post'](path);
    if (actor !== 'anonymous') {
      request.set('Authorization', `Bearer ${tokens[actor]}`);
    }
    if (query) request.query(query);
    if (body) request.send(body);
    return request;
  }
});

function expectOwnProfile(body: unknown, user: Account): void {
  expect(body).toMatchObject({
    id: user.id.toString(),
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    mustResetPw: false,
  });
  expectNoSecret(body);
}

function expectNoSecret(body: unknown): void {
  expect(JSON.stringify(body)).not.toMatch(
    /passwordHash|password_hash|\$argon2|\$2[aby]\$/i,
  );
}

type RouteLayer = {
  route?: { path: string; methods: Record<string, boolean> };
  handle?: { stack?: RouteLayer[] };
};

// Reads the Express router Nest built. Express 5 exposes it as `router`, not `_router`.
function mountedRoutes(app: TestApp): { method: string; path: string }[] {
  const expressApp = app.getHttpAdapter().getInstance() as {
    router?: { stack: RouteLayer[] };
  };
  const found: { method: string; path: string }[] = [];

  const visit = (stack: RouteLayer[], prefix: string) => {
    for (const layer of stack) {
      if (layer.route?.path && !layer.route.path.includes('*')) {
        const path = normalizePath(prefix + layer.route.path);
        for (const [method, enabled] of Object.entries(layer.route.methods)) {
          if (enabled && method !== 'head' && !method.startsWith('_')) {
            found.push({ method: method.toUpperCase(), path });
          }
        }
        continue;
      }

      const nested = layer.handle?.stack;
      if (nested) visit(nested, prefix);
    }
  };

  visit(expressApp.router?.stack ?? [], '');

  return found.sort(
    (a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method),
  );
}

function normalizePath(path: string): string {
  const collapsed = path.replace(/\/{2,}/g, '/');
  if (collapsed.length > 1 && collapsed.endsWith('/')) {
    return collapsed.slice(0, -1);
  }
  return collapsed || '/';
}
