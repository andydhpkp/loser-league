const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { createAdminRouteApp, createRouteApp } = require('../support/route-app');
const { createAdminPotRouter } = require('../../server/admin/pot-routes');

test('pot endpoint rejects ordinary sessions before reading totals', async () => {
  let calls = 0;
  const router = createAdminPotRouter({ getPot: async () => { calls++; return {}; } });
  await request(createRouteApp('/pot', router)).get('/pot').expect(401);
  assert.equal(calls, 0);
});

test('admin pot endpoint returns the aggregate without mutation', async () => {
  const value = { leagueSeason: { year: 2026 }, trackCount: 10, buybackCount: 2, baseCents: 5000, buybackCents: 2000, totalCents: 7000 };
  const router = createAdminPotRouter({ getPot: async () => value });
  const response = await request(createAdminRouteApp('/pot', router)).get('/pot').expect(200);
  assert.deepEqual(response.body, value);
  assert.match(response.headers['cache-control'], /no-store/);
});

test('pot query failures return a generic error, not calculation internals', async () => {
  const router = createAdminPotRouter({ getPot: async () => { throw new Error('private fixture detail'); } });
  const response = await request(createAdminRouteApp('/pot', router)).get('/pot').expect(500);
  assert.equal(response.body.error, 'INTERNAL_ERROR');
  assert.ok(!JSON.stringify(response.body).includes('private fixture detail'));
});
