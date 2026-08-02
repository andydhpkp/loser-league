const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  createLegacyEmergencyRepair,
  changedTrackTargets,
} = require("../../server/admin/legacy-emergency-repair");

test("legacy emergency repair commits its mutation and sanitized non-undoable audit before responding", async () => {
  const events = [];
  const transaction = {
    async commit() { events.push("commit"); },
    async rollback() { events.push("rollback"); },
  };
  const middleware = createLegacyEmergencyRepair({
    beginTransaction: async () => transaction,
    createAudit: async (details) => events.push(["audit", details]),
    loadStates: async () => events.some((event) => event === "loaded-before")
      ? [{ id: 7, currentPick: "Raiders", stateVersion: 2 }]
      : (events.push("loaded-before"), [{ id: 7, currentPick: "Broncos", stateVersion: 1 }]),
  });
  const req = { method: "PUT", route: { path: "/reduce-used-picks/:trackId/:targetLength" } };
  const responses = [];
  const res = {
    statusCode: 200,
    locals: {},
    status(code) { this.statusCode = code; return this; },
    json(body) { responses.push([this.statusCode, body]); return this; },
  };

  await middleware(req, res, () => {
    assert.equal(res.locals.legacyEmergencyTransaction, transaction);
    res.json({ newUsedPicksLength: 2 });
  });

  assert.deepEqual(events, [
    "loaded-before",
    ["audit", {
      method: "PUT",
      routePattern: "/reduce-used-picks/:trackId/:targetLength",
      targets: [{
        targetId: 7,
        beforeState: { id: 7, currentPick: "Broncos", stateVersion: 1 },
        afterState: { id: 7, currentPick: "Raiders", stateVersion: 2 },
      }],
      transaction,
    }],
    "commit",
  ]);
  assert.deepEqual(responses, [[200, { newUsedPicksLength: 2 }]]);
});

test("legacy emergency repair rolls back and preserves an error response without auditing", async () => {
  const events = [];
  const transaction = {
    async commit() { events.push("commit"); },
    async rollback() { events.push("rollback"); },
  };
  const middleware = createLegacyEmergencyRepair({
    beginTransaction: async () => transaction,
    createAudit: async () => events.push("audit"),
    loadStates: async () => [],
  });
  const req = { method: "DELETE", route: { path: "/clear-memory/delete-wrong-pick" } };
  const responses = [];
  const res = {
    statusCode: 200,
    locals: {},
    status(code) { this.statusCode = code; return this; },
    json(body) { responses.push([this.statusCode, body]); return this; },
  };

  await middleware(req, res, () => res.status(404).json({ message: "No tracks found" }));

  assert.deepEqual(events, ["rollback"]);
  assert.deepEqual(responses, [[404, { message: "No tracks found" }]]);
});

test("legacy emergency target diffs retain only changed and deleted sanitized Track states", () => {
  assert.deepEqual(changedTrackTargets(
    [{ id: 1, currentPick: "Broncos" }, { id: 2, currentPick: "Raiders" }],
    [{ id: 1, currentPick: "Broncos" }, { id: 2, currentPick: null }],
  ), [{ targetId: 2, beforeState: { id: 2, currentPick: "Raiders" }, afterState: { id: 2, currentPick: null } }]);
  assert.deepEqual(changedTrackTargets([{ id: 3, currentPick: "Bills" }], []), [
    { targetId: 3, beforeState: { id: 3, currentPick: "Bills" }, afterState: null },
  ]);
});
