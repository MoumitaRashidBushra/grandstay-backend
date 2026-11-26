import { ThrottlerGuard } from '@nestjs/throttler';
import type { User } from '@prisma/client';
import type { TestApp } from './utils/app.js';
import { api, createTestApp } from './utils/app.js';
import { disconnectDatabase, prisma, resetDatabase } from './utils/db.js';
import {
  createAdmin,
  createCustomer,
  createReceptionist,
} from './utils/factories.js';

// HTL-35.3 role and ownership access matrix.
// NFR-SEC-03: every mounted route is called with no token and with each role.
// NFR-SEC-04: a booking reference or invoice number returns another customer's
// data to nobody. Profile reads follow the token subject.

const ROLES = ['ADMIN', 'RECEPTIONIST', 'CUSTOMER'] as const;
type Role = (typeof ROLES)[number];
type Actor = Role | 'anonymous';

const ACTORS: Actor[] = ['anonymous', ...ROLES];

type Account = User & { password: string };
type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

type Endpoint = {
  method: Method;
  path: string;
  body?: Record<string, unknown>;
  expect: Record<Actor, number>;
  notFound?: string;
};

const MISSING_REFERENCE = 'GS-000101-NONE1';
const MISSING_INVOICE = 'INV-0000-000000';
const OWNER_REFERENCE = 'GS-261126-OWN01';
const OTHER_REFERENCE = 'GS-261126-OWN02';
const OWNER_INVOICE = 'INV-2026-000001';
const OTHER_INVOICE = 'INV-2026-000002';

const everyone = (status: number): Record<Actor, number> => ({
  anonymous: status,
  ADMIN: status,
  RECEPTIONIST: status,
  CUSTOMER: status,
});

const allow = (roles: readonly Role[], granted: number): Record<Actor, number> => ({
  anonymous: 401,
  ADMIN: roles.includes('ADMIN') ? granted : 403,
  RECEPTIONIST: roles.includes('RECEPTIONIST') ? granted : 403,
  CUSTOMER: roles.includes('CUSTOMER') ? granted : 403,
});

const ENDPOINTS: Endpoint[] = [
  { method: 'GET', path: '/api/v1', expect: everyone(200) },
  { method: 'GET', path: '/api/v1/health', expect: everyone(200) },
  { method: 'GET', path: '/api/v1/ready', expect: everyone(200) },
  { method: 'GET', path: '/api/v1/settings', expect: everyone(200) },
  { method: 'PUT', path: '/api/v1/settings', body: {}, expect: allow(['ADMIN'], 501) },
  { method: 'GET', path: '/api/v1/categories', expect: everyone(200) },
  { method: 'GET', path: '/api/v1/categories/:id', expect: everyone(200) },
  {
    method: 'PATCH',
    path: '/api/v1/categories',
    body: {},
    expect: allow(['ADMIN'], 501),
  },
  { method: 'GET', path: '/api/v1/availability', expect: everyone(200) },
  {
    method: 'POST',
    path: '/api/v1/auth/register',
    body: {},
    expect: everyone(501),
  },
  { method: 'POST', path: '/api/v1/auth/login', body: {}, expect: everyone(400) },
  { method: 'POST', path: '/api/v1/auth/refresh', expect: everyone(401) },
  { method: 'POST', path: '/api/v1/auth/logout', expect: everyone(201) },
  {
    method: 'GET',
    path: '/api/v1/me',
    expect: { anonymous: 401, ADMIN: 200, RECEPTIONIST: 200, CUSTOMER: 200 },
  },
  {
    method: 'POST',
    path: '/api/v1/me/password',
    body: {},
    expect: allow(['ADMIN', 'RECEPTIONIST', 'CUSTOMER'], 501),
  },
  {
    method: 'POST',
    path: '/api/v1/admin/staff',
    body: {},
    expect: allow(['ADMIN'], 501),
  },
  {
    method: 'PATCH',
    path: '/api/v1/admin/staff/:id',
    body: {},
    expect: allow(['ADMIN'], 501),
  },
  { method: 'GET', path: '/api/v1/admin/rooms', expect: allow(['ADMIN'], 501) },
  { method: 'POST', path: '/api/v1/admin/rooms', body: {}, expect: allow(['ADMIN'], 501) },
  { method: 'GET', path: '/api/v1/admin/rooms/:id', expect: allow(['ADMIN'], 501) },
  {
    method: 'PATCH',
    path: '/api/v1/admin/rooms/:id',
    body: {},
    expect: allow(['ADMIN'], 501),
  },
  { method: 'DELETE', path: '/api/v1/admin/rooms/:id', expect: allow(['ADMIN'], 501) },
  {
    method: 'POST',
    path: '/api/v1/admin/rooms/:id/status',
    body: {},
    expect: allow(['ADMIN'], 501),
  },
  { method: 'GET', path: '/api/v1/admin/reservations', expect: allow(['ADMIN'], 501) },
  { method: 'GET', path: '/api/v1/admin/dashboard', expect: allow(['ADMIN'], 501) },
  {
    method: 'POST',
    path: '/api/v1/bookings/quote',
    body: {},
    expect: allow(['CUSTOMER'], 501),
  },
  { method: 'POST', path: '/api/v1/bookings', body: {}, expect: allow(['CUSTOMER'], 501) },
  { method: 'GET', path: '/api/v1/bookings', expect: allow(['CUSTOMER'], 501) },
  {
    method: 'GET',
    path: '/api/v1/bookings/:reference',
    expect: allow(['ADMIN', 'RECEPTIONIST', 'CUSTOMER'], 404),
    notFound: 'Booking not found',
  },
  {
    method: 'GET',
    path: '/api/v1/bookings/:reference/confirmation.pdf',
    expect: allow(['ADMIN', 'RECEPTIONIST', 'CUSTOMER'], 404),
    notFound: 'Booking not found',
  },
  {
    method: 'POST',
    path: '/api/v1/bookings/:reference/cancel',
    expect: allow(['ADMIN', 'CUSTOMER'], 404),
    notFound: 'Booking not found',
  },
  { method: 'GET', path: '/api/v1/desk/bookings', expect: allow(['ADMIN', 'RECEPTIONIST'], 501) },
  { method: 'GET', path: '/api/v1/desk/arrivals', expect: allow(['ADMIN', 'RECEPTIONIST'], 501) },
  {
    method: 'GET',
    path: '/api/v1/desk/departures',
    expect: allow(['ADMIN', 'RECEPTIONIST'], 501),
  },
  {
    method: 'POST',
    path: '/api/v1/desk/bookings/:reference/check-in',
    expect: allow(['ADMIN', 'RECEPTIONIST'], 501),
  },
  {
    method: 'POST',
    path: '/api/v1/desk/bookings/:reference/check-out',
    expect: allow(['ADMIN', 'RECEPTIONIST'], 501),
  },
  {
    method: 'GET',
    path: '/api/v1/invoices/:number.pdf',
    expect: allow(['ADMIN', 'RECEPTIONIST', 'CUSTOMER'], 404),
    notFound: 'Invoice not found',
  },
];

const MATRIX = ENDPOINTS.flatMap((endpoint) =>
  ACTORS.map((actor) => ({ ...endpoint, actor, status: endpoint.expect[actor] })),
);

type ObjectRoute = {
  label: string;
  method: Method;
  ownerUrl: string;
  otherUrl: string;
  readers: readonly Role[];
  denial: string;
};

describe('Role and ownership access matrix', () => {
  let app: TestApp;
  let users: Record<Role, Account>;
  let otherCustomer: Account;
  let tokens: Record<Role, string>;
  let otherToken: string;

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
    await seedOwnedRecords(customer, stranger, admin.id);

    tokens = {
      ADMIN: await accessToken(admin.email, admin.password),
      RECEPTIONIST: await accessToken(receptionist.email, receptionist.password),
      CUSTOMER: await accessToken(customer.email, customer.password),
    };
    otherToken = await accessToken(stranger.email, stranger.password);
  });

  afterAll(async () => {
    await app.close();
    await disconnectDatabase();
  });

  describe('NFR-SEC-03 every endpoint and role', () => {
    it('covers every mounted route', () => {
      const expected = ENDPOINTS.map(({ method, path }) => ({ method, path })).sort(byRoute);
      expect(mountedRoutes(app)).toEqual(expected);
    });

    it.each(MATRIX)(
      '$method $path as $actor returns $status',
      async ({ method, path, body, actor, status, notFound }) => {
        const response = await call(actor, method, concreteUrl(path), body);

        expect(response.status).toBe(status);
        expectNoSecret(response.body);
        if (path === '/api/v1/auth/refresh') {
          expect(response.body.message).toBe('Invalid refresh token');
        } else if (status === 401) {
          expect(response.body.message).toBe('Unauthorized');
        }
        if (status === 403) expect(response.body.message).toBe('Forbidden');
        if (status === 404) expect(response.body.message).toBe(notFound);

        if (path === '/api/v1' && status === 200) {
          expect(response.text).toBe('Hello World!');
        }
        if (path === '/api/v1/auth/logout' && status === 201) {
          expect(response.body.message).toBe('Logged out successfully');
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

  describe('NFR-SEC-04 object access', () => {
    it.each(ROLES)(
      '%s keeps their own profile when the query names someone else',
      async (role) => {
        const response = await call(role, 'GET', '/api/v1/me', undefined, {
          id: otherCustomer.id.toString(),
        });

        expect(response.status).toBe(200);
        expectOwnProfile(response.body, users[role]);
        expectNoPerson(response.body, otherCustomer);
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
        expectNoPerson(response.body, otherCustomer);
      },
    );

    it.each([
      {
        label: 'booking detail',
        method: 'GET' as const,
        ownerUrl: `/api/v1/bookings/${OWNER_REFERENCE}`,
        otherUrl: `/api/v1/bookings/${OTHER_REFERENCE}`,
        readers: ['ADMIN', 'RECEPTIONIST'] as const,
        denial: 'Booking not found',
      },
      {
        label: 'confirmation',
        method: 'GET' as const,
        ownerUrl: `/api/v1/bookings/${OWNER_REFERENCE}/confirmation.pdf`,
        otherUrl: `/api/v1/bookings/${OTHER_REFERENCE}/confirmation.pdf`,
        readers: ['ADMIN', 'RECEPTIONIST'] as const,
        denial: 'Booking not found',
      },
      {
        label: 'cancel',
        method: 'POST' as const,
        ownerUrl: `/api/v1/bookings/${OWNER_REFERENCE}/cancel`,
        otherUrl: `/api/v1/bookings/${OTHER_REFERENCE}/cancel`,
        readers: ['ADMIN'] as const,
        denial: 'Booking not found',
      },
      {
        label: 'invoice',
        method: 'GET' as const,
        ownerUrl: `/api/v1/invoices/${OWNER_INVOICE}.pdf`,
        otherUrl: `/api/v1/invoices/${OTHER_INVOICE}.pdf`,
        readers: ['ADMIN', 'RECEPTIONIST'] as const,
        denial: 'Invoice not found',
      },
    ] satisfies ObjectRoute[])(
      '$label returns the owner and staff, and hides it from the other customer',
      async (route) => {
        const strangerDenied = await callAs(otherToken, route.method, route.ownerUrl);
        expect(strangerDenied.status).toBe(404);
        expect(strangerDenied.body.message).toBe(route.denial);
        expectNoPerson(strangerDenied.body, users.CUSTOMER);

        const ownerDenied = await call('CUSTOMER', route.method, route.otherUrl);
        expect(ownerDenied.status).toBe(404);
        expect(ownerDenied.body.message).toBe(route.denial);
        expectNoPerson(ownerDenied.body, otherCustomer);

        const ownerAllowed = await call('CUSTOMER', route.method, route.ownerUrl);
        expect(ownerAllowed.status).toBe(501);
        expectNoPerson(ownerAllowed.body, otherCustomer);

        const anonymous = await call('anonymous', route.method, route.ownerUrl);
        expect(anonymous.status).toBe(401);
        expectNoPerson(anonymous.body, users.CUSTOMER);

        for (const role of ['ADMIN', 'RECEPTIONIST'] as const) {
          const response = await call(role, route.method, route.ownerUrl);
          expect(response.status).toBe(route.readers.some((reader) => reader === role) ? 501 : 403);
          expectNoPerson(response.body, users.CUSTOMER);
          expectNoPerson(response.body, otherCustomer);
        }
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
    const token = actor === 'anonymous' ? undefined : tokens[actor];
    return callAs(token, method, path, body, query);
  }

  function callAs(
    token: string | undefined,
    method: Method,
    path: string,
    body?: Record<string, unknown>,
    query?: Record<string, string>,
  ) {
    const request = api(app)[method.toLowerCase() as 'get' | 'post' | 'put' | 'patch' | 'delete'](
      path,
    );
    if (token) request.set('Authorization', `Bearer ${token}`);
    if (query) request.query(query);
    if (body) request.send(body);
    return request;
  }
});

function concreteUrl(path: string): string {
  return path
    .replace(':id', '99999')
    .replace(':reference', MISSING_REFERENCE)
    .replace(':number.pdf', `${MISSING_INVOICE}.pdf`);
}

async function seedOwnedRecords(
  owner: Account,
  stranger: Account,
  issuedById: bigint,
): Promise<void> {
  const category = await prisma.roomCategory.create({
    data: { name: 'Access Matrix', nightlyPrice: '4000.00', capacity: 2 },
  });
  const [roomA, roomB] = await Promise.all([
    prisma.room.create({
      data: { number: '901', categoryId: category.id, floor: 9 },
    }),
    prisma.room.create({
      data: { number: '902', categoryId: category.id, floor: 9 },
    }),
  ]);

  await Promise.all([
    createStay(owner, roomA.id, OWNER_REFERENCE, OWNER_INVOICE, issuedById),
    createStay(stranger, roomB.id, OTHER_REFERENCE, OTHER_INVOICE, issuedById),
  ]);
}

function createStay(
  guest: Account,
  roomId: number,
  reference: string,
  invoiceNumber: string,
  issuedById: bigint,
) {
  return prisma.booking.create({
    data: {
      reference,
      customerId: guest.id,
      roomId,
      checkIn: new Date('2026-12-01T12:00:00.000Z'),
      checkOut: new Date('2026-12-02T12:00:00.000Z'),
      guests: 1,
      leadGuestName: guest.fullName,
      leadGuestMobile: guest.mobile ?? '01700000000',
      nightlyPrice: '4000.00',
      totalAmount: '4000.00',
      invoice: {
        create: {
          number: invoiceNumber,
          totalAmount: '4000.00',
          paidAmount: '4000.00',
          issuedById,
        },
      },
    },
  });
}

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

function expectNoPerson(body: unknown, person: Account): void {
  const text = JSON.stringify(body);
  expect(text).not.toContain(person.email);
  expect(text).not.toContain(person.fullName);
  const mobile = person.mobile?.trim();
  if (mobile) expect(text).not.toContain(mobile);
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
  return found.sort(byRoute);
}

function byRoute(
  a: { method: string; path: string },
  b: { method: string; path: string },
): number {
  return a.path.localeCompare(b.path) || a.method.localeCompare(b.method);
}

function normalizePath(path: string): string {
  const collapsed = path.replace(/\/{2,}/g, '/');
  if (collapsed.length > 1 && collapsed.endsWith('/')) return collapsed.slice(0, -1);
  return collapsed || '/';
}
