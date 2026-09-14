const test = require('node:test');
if (!process.env.TEST_DATABASE_URL) {
  test('admin pot database checks', { skip: 'TEST_DATABASE_URL is not set' }, () => {});
} else {
  process.env.NODE_ENV = 'test';
  const assert = require('node:assert/strict');
  const Sequelize = require('sequelize');
  const { sequelize, User, Track, Pick, LeagueSeason, BuybackDecision, BuybackDecisionTrack } = require('../../models');
  const { getLeaguePot } = require('../../server/modules/pot/pot-service');
  const { migrateEmptyTestDatabase } = require('../support/migrate-test-database');
  const migration = require('../../migrations/20260914000000-add-league-pot-exemption');
  const user = (username, email = `${username}@example.test`) => User.create({ first_name: 'Fixture', last_name: 'User', username, email, password: 'test-password' });
  const track = (owner, season) => Track.create({ user_id: owner.id, league_season_id: season?.id || null, available_picks: ['Broncos'], wrong_pick: 'Jets' });
  async function decision(owner, season, tracks, status, resolutions) {
    const d = await BuybackDecision.create({ user_id: owner.id, league_season_id: season.id, status, origin: 'ADMIN', unit_price_cents: 1000 });
    for (const [index, t] of tracks.entries()) {
      const pick = await Pick.create({ track_id: t.id, league_season_id: season.id, week: 1, pick_cycle: 1, team_name: 'Jets', origin: 'USER_SUBMISSION', outcome: 'WRONG_PICK', committed_at: new Date(), state_version: 0 });
      await BuybackDecisionTrack.create({ buyback_decision_id: d.id, track_id: t.id, week_one_pick_id: pick.id, resolution: resolutions[index] });
    }
  }
  test.beforeEach(() => migrateEmptyTestDatabase(sequelize));
  test.after(() => sequelize.close());

  test('pot includes original eliminated Tracks and fulfilled buybacks only, excluding free and other-season Tracks', async () => {
    const free = await user('Andydhpkp');
    const paid = await user('paid');
    const pending = await user('pending');
    const cancelled = await user('cancelled');
    await sequelize.getQueryInterface().dropTable('league_pot_exemption');
    await migration.up(sequelize.getQueryInterface(), Sequelize);
    const season = await LeagueSeason.create({ year: 2026, state: 'ACTIVE', current_week: 2, open_slot: 1 });
    const old = await LeagueSeason.create({ year: 2025, state: 'COMPLETE', current_week: 18, open_slot: null });
    const paidTracks = await Promise.all([track(paid, season), track(paid, season), track(paid, season)]);
    await decision(paid, season, paidTracks.slice(0, 2), 'COMPLETED_USER_REQUEST', ['FULFILLED', 'UNFULFILLED']);
    await decision(free, season, [await track(free, season)], 'COMPLETED_ADMIN_DIRECT', ['FULFILLED']);
    await decision(pending, season, [await track(pending, season)], 'PENDING_USER_REQUEST', ['PENDING']);
    await decision(cancelled, season, [await track(cancelled, season)], 'CANCELLED_ADMIN', ['UNFULFILLED']);
    await decision(paid, old, [await track(paid, old)], 'COMPLETED_ADMIN_DIRECT', ['FULFILLED']);
    await track(paid, null);
    const result = await getLeaguePot();
    assert.deepEqual(result, { leagueSeason: { year: 2026, schedulePhase: 'REGULAR' }, trackCount: 5, buybackCount: 1, baseCents: 2500, buybackCents: 1000, totalCents: 3500 });
    await free.update({ username: 'renamed-free' });
    await migration.up(sequelize.getQueryInterface(), Sequelize);
    assert.deepEqual(await getLeaguePot(), result);
    await paidTracks[0].update({ wrong_pick: 'Bears' });
    assert.deepEqual(await getLeaguePot(), result);
    await season.update({ open_slot: null, state: 'COMPLETE' });
    assert.deepEqual(await getLeaguePot(), result);
  });

  test('no season, missing exemption and zero Track states are explicit', async () => {
    assert.deepEqual(await getLeaguePot(), { leagueSeason: null });
    await LeagueSeason.create({ year: 2026, state: 'SETUP', current_week: 0, open_slot: 1 });
    await assert.rejects(getLeaguePot(), /exemption/);
    await user('Andydhpkp');
    await migration.up(sequelize.getQueryInterface(), Sequelize);
    assert.equal((await getLeaguePot()).totalCents, 0);
  });

  test('exemption setup rejects absent or ambiguous identity without registering an account', async () => {
    await user('ordinary');
    await assert.rejects(migration.up(sequelize.getQueryInterface(), Sequelize), /uniquely/);
    await user('Andydhpkp');
    await user('andydhpkp', 'duplicate@example.test');
    await assert.rejects(migration.up(sequelize.getQueryInterface(), Sequelize), /uniquely/);
    const [rows] = await sequelize.query('SELECT user_id FROM league_pot_exemption');
    assert.equal(rows.length, 0);
    await assert.rejects(migration.down(), /forward-only/);
  });
}
