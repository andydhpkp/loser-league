const assert = require("node:assert/strict");
const test = require("node:test");

const { listAdminActions } = require("../../server/admin/action-registry");

test("registry documents every existing browser admin mutation without actor attribution", () => {
  const actions = listAdminActions();
  assert.deepEqual(
    actions.map((action) => action.name),
    ["ADD_USER_WIN", "CREATE_TRACK", "DELETE_TRACK", "DELETE_USER"]
  );
  for (const action of actions) {
    assert.ok(action.description);
    assert.ok(Array.isArray(action.warnings));
    assert.ok(Array.isArray(action.instructions));
    assert.equal(typeof action.undoable, "boolean");
    assert.equal(Object.hasOwn(action, "actor"), false);
  }
});
