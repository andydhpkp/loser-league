const assert = require("node:assert/strict");
const test = require("node:test");

const { listAdminActions } = require("../../server/admin/action-registry");

test("registry documents every existing browser admin mutation without actor attribution", () => {
  const actions = listAdminActions();
  assert.deepEqual(
    actions.map((action) => action.name),
    [
      "CREATE_LEAGUE_SEASON",
      "START_LEAGUE_SEASON",
      "ENABLE_PRESEASON",
      "START_REGULAR_SEASON",
      "ADD_USER_WIN",
      "CREATE_TRACK",
      "DELETE_TRACK",
      "DELETE_USER",
      "OVERRIDE_GAME_RESULT",
      "CLOSE_WEEK",
      "COMPLETE_LEAGUE_SEASON",
      "ROLLOVER_LEAGUE_SEASON",
      "RESET_CURRENT_PICKS",
      "ASSIGN_CURRENT_PICK",
      "REPLACE_CURRENT_PICK",
      "REACTIVATE_TRACK",
      "RESET_PLAYOFF_PICK_POOLS",
      "CORRECT_HISTORICAL_PICK",
      "RECONCILE_PICK_OUTCOME",
      "REBUILD_TRACK_PROJECTIONS",
      "UNDO_ADMIN_ACTION",
    ]
  );
  for (const action of actions) {
    assert.ok(action.description);
    assert.ok(Array.isArray(action.warnings));
    assert.ok(Array.isArray(action.instructions));
    assert.equal(typeof action.undoable, "boolean");
    assert.equal(Object.hasOwn(action, "actor"), false);
  }
});
