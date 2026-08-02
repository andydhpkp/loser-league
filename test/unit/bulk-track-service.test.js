const assert = require("node:assert/strict");
const test = require("node:test");
const { normalizeAdditions } = require("../../server/admin/bulk-track-service");

test("bulk Track quantities normalize valid input", () => {
  assert.deepEqual(normalizeAdditions([{ userId: "3", quantity: "10" }]), [{ userId: 3, quantity: 10 }]);
});

test("bulk Track quantities reject empty, duplicate, fractional, and excessive requests", () => {
  for (const additions of [
    [],
    [{ userId: 3, quantity: 0 }],
    [{ userId: 3, quantity: 1.5 }],
    [{ userId: 3, quantity: 101 }],
    [{ userId: 3, quantity: 1 }, { userId: 3, quantity: 2 }],
  ]) assert.throws(() => normalizeAdditions(additions));
});
