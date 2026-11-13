import { INestApplication } from '@nestjs/common';
import { Test, TestingModuleBuilder } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../../src/app.module.js';

export type TestApp = INestApplication<App>;

// Boots the full AppModule in-process. Pass `customize` to override providers (e.g. clocks, mailers).
export async function createTestApp(
  customize: (builder: TestingModuleBuilder) => TestingModuleBuilder = (b) => b,
): Promise<TestApp> {
  const moduleRef = await customize(
    Test.createTestingModule({ imports: [AppModule] }),
  ).compile();
  const app = moduleRef.createNestApplication<TestApp>();
  await app.init();
  return app;
}

export const api = (app: TestApp) => request(app.getHttpServer());
