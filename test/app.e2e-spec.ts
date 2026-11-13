import { api, createTestApp, TestApp } from './utils/app.js';

describe('AppController (e2e)', () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/ (GET)', () => {
    return api(app).get('/').expect(200).expect('Hello World!');
  });
});
