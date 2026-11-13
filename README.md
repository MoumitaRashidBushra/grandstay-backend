<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

### Prerequisites

- Node.js 20+ and npm
- PostgreSQL 16 running locally (the schema uses the `btree_gist` extension, which ships with the standard Postgres contrib package)

### Install and configure

```bash
$ npm install
$ cp .env.example .env     # on Windows PowerShell: Copy-Item .env.example .env
```

## Docker Compose setup (PostgreSQL)

This project runs its local database in Docker Compose using the service defined in `docker-compose.yml`.

The Postgres container automatically runs `docker/postgres/init.sql` on first startup, which creates the required `btree_gist` extension for the schema.

### 1. Configure environment variables

Create or update the root `.env` file with the database values:

```env
POSTGRES_DB=grandstay
POSTGRES_USER=postgres
POSTGRES_PASSWORD=password
POSTGRES_PORT=5432
DATABASE_URL=postgresql://postgres:password@localhost:5432/grandstay
```

### 2. Start the database container

```bash
docker compose up -d
```

Check the database status:

```bash
docker compose ps
```

To view logs:

```bash
docker compose logs -f postgres
```

To stop it:

```bash
docker compose down
```

> The database is exposed on `localhost:5432`, persists in the Docker volume `grandstay_pgdata`, and is initialized by `docker/postgres/init.sql`.

### 3. Run Prisma migrations

After the PostgreSQL container is up, generate the Prisma client and apply migrations:

```bash
npx prisma generate
npx prisma migrate deploy
```

If you want demo data:

```bash
npx prisma db seed
```

### 4. Reset the database

Use this only for local development when you want a clean database state.

#### Full reset with Docker volume removal

```bash
docker compose down -v
docker compose up -d
npx prisma migrate reset
```

This removes the database volume, recreates the PostgreSQL container, and resets the schema and seed data.

#### Manual destructive reset

```bash
psql -U postgres -h localhost -d grandstay -f prisma/drop_all.sql
npx prisma migrate deploy
npx prisma db seed
```

## Run the backend locally

Once the database is running and migrations are applied, start the NestJS app:

```bash
npm run start:dev
```

Edit `.env` and set the values for your machine:

| Variable         | Description                                  | Example                                                  |
| ---------------- | -------------------------------------------- | -------------------------------------------------------- |
| `NODE_ENV`       | Runtime environment                          | `development`                                            |
| `PORT`           | HTTP port                                    | `3000`                                                   |
| `DATABASE_URL`   | PostgreSQL connection string used by Prisma  | `postgresql://postgres:password@localhost:5432/grandstay` |
| `JWT_SECRET`     | Secret used to sign JWTs (use a strong value) | `replace_with_a_secure_secret`                           |
| `JWT_EXPIRES_IN` | JWT lifetime                                 | `1d`                                                     |

Create the empty database first (name must match `DATABASE_URL`):

```bash
$ psql -U postgres -c "CREATE DATABASE grandstay;"
```

## Database (Prisma)

The data layer uses [Prisma](https://www.prisma.io/) 5 with PostgreSQL. Files live in [prisma/](prisma/):

| File                    | Purpose                                                       |
| ----------------------- | ------------------------------------------------------------- |
| `prisma/schema.prisma`  | Data model (users, rooms, bookings, payments, invoices, etc.) |
| `prisma/migrations/`    | SQL migration history (applied in order)                      |
| `prisma/seed.js`        | Development seed data                                         |
| `prisma/drop_all.sql`   | Destructive helper that drops every table (dev only)          |

See [docs/erd.md](docs/erd.md) and [docs/schema.md](docs/schema.md) for the ERD and schema documentation.

### 1. Generate the Prisma Client

```bash
$ npx prisma generate
```

This also runs automatically after `npm install` and `prisma migrate`, but run it manually whenever `schema.prisma` changes.

### 2. Run migrations

```bash
# development: apply pending migrations (creates the DB schema)
$ npx prisma migrate dev

# production / CI: apply existing migrations only, never creates new ones
$ npx prisma migrate deploy

# check which migrations are applied
$ npx prisma migrate status
```

To change the schema, edit `prisma/schema.prisma` and run `npx prisma migrate dev --name <describe_change>`, then commit the generated folder under `prisma/migrations/`. Constraints Prisma cannot express are added by hand-editing the migration SQL (see the notes at the bottom of `schema.prisma`).

### 3. Seed the database

```bash
$ npx prisma db seed
```

This runs `node prisma/seed.js` (configured under `"prisma"."seed"` in `package.json`). `migrate dev` also runs the seed automatically when it creates a fresh database or after a reset.

The seed script:

- is **development only** and **re-runnable**: it first **deletes all existing data** from every table, then re-creates it;
- is deterministic (seeded PRNG), so every run produces the same data;
- creates hotel settings, room categories (Standard, Deluxe, Suite), rooms, users and a spread of bookings with related records.

Seeded accounts (all use the password `Password@123`):

| Role         | Email                                              |
| ------------ | -------------------------------------------------- |
| ADMIN        | `admin@grandstay.example`                          |
| RECEPTIONIST | `reception1@grandstay.example`, `reception2@...`, etc. |
| CUSTOMER     | generated from names, e.g. `rahim.uddin@example.com` |

The script prints a summary (room, user and booking counts) when it finishes.

> Never run the seed against a production database.

### Useful commands

```bash
# open Prisma Studio (browser GUI for the data)
$ npx prisma studio

# drop everything and re-apply all migrations, then seed
$ npx prisma migrate reset

# validate / format the schema
$ npx prisma validate
$ npx prisma format

# manually drop all tables (destructive, dev only)
$ psql -U USER -h localhost -d DBNAME -f prisma/drop_all.sql
```

### Quick start (fresh clone)

```bash
$ npm install
$ cp .env.example .env          # then edit DATABASE_URL
$ npx prisma migrate deploy        # create tables
$ npx prisma db seed            # populate sample data
$ npm run start:dev             # start the API
```

### Troubleshooting

- **`P1001: Can't reach database server`**: check PostgreSQL is running and `DATABASE_URL` host, port and credentials are correct.
- **`P1003` / database does not exist**: create the database first (see above).
- **`extension "btree_gist" is not available`**: install the PostgreSQL contrib package, or use a role allowed to create extensions.
- **`@prisma/client did not initialize yet`**: run `npx prisma generate`.
- **Drift detected on `migrate dev`**: the DB was changed outside migrations; run `npx prisma migrate reset` (dev only, wipes data).

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Observability

In production applications, observability is essential for understanding how your system behaves, detecting issues early, and maintaining reliable performance.

[NestJS Observe](https://observe.nestjs.com) automatically instruments your NestJS application, giving you deep visibility into your system with minimal setup:

- **Distributed tracing:** Follow requests across services and understand how they flow through your system.
- **Waterfall analysis:** Visualize request execution and identify slow operations, bottlenecks, and unexpected delays.
- **Performance analysis:** Analyze application performance in real time and quickly pinpoint areas that need optimization.
- **Metrics:** Track key application and infrastructure metrics to understand system health and performance trends.
- **Logging:** Centralize and correlate logs with traces and other telemetry to make debugging easier.
- **Error tracking:** Detect errors quickly and investigate their root causes with the surrounding context.
- **SLA monitoring:** Track service-level objectives and identify when your application is approaching or exceeding defined thresholds.
- **Alarms and alerts:** Set up alerts for critical errors, performance degradation, SLA violations, and other anomalies so your team can react quickly.

This project is already instrumented. To connect it, run this and approve the code it prints at [observe.nestjs.com/link](https://observe.nestjs.com/link) - signing up for free if you have no account:

```bash
$ npx @nestjs/observe link
```

It writes the app key and secret into `.env` and makes every `nest start` script (`start`, `start:dev`, `start:debug`) load it. In production, set `OBSERVE_APP_KEY` and `OBSERVE_APP_SECRET` in the environment instead.

Or do it by hand: create an application and an API key at [observe.nestjs.com](https://observe.nestjs.com), and set the pair as `OBSERVE_APP_KEY` and `OBSERVE_APP_SECRET` in the environment the app runs in.

The free plan needs no payment details and covers 300,000 events a month. You can also browse the [live demo](https://www.observe-demo.nestjs.com/dashboard) first - the whole dashboard over a busy service's data, with nothing to install.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Auto-instrument your application with [NestJS Observe](https://observe.nestjs.com). Distributed tracing, metrics, and logging made easy. Error tracking and performance monitoring for your NestJS applications.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).

