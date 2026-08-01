const ACTIONS = Object.freeze([
  { name: "ADD_USER_WIN", description: "Record a League Season win for one User", warnings: ["Verify the year and win type before confirming."], instructions: ["Select a User.", "Enter the League Season year and win type.", "Review and confirm the preview."], undoable: false },
  { name: "CREATE_TRACK", description: "Create a blank Track for one User", warnings: ["Track enrollment must be open for the current League Season."], instructions: ["Select a User.", "Review the current League Season and Track count.", "Confirm the preview."], undoable: false },
  { name: "DELETE_TRACK", description: "Permanently delete one Track", warnings: ["This action cannot be undone."], instructions: ["Select the exact Track.", "Review its numeric ID.", "Confirm permanent deletion."], undoable: false },
  { name: "DELETE_USER", description: "Permanently delete one User and owned Tracks", warnings: ["This action cannot be undone."], instructions: ["Select the exact User.", "Review affected Track IDs.", "Confirm permanent deletion."], undoable: false },
  { name: "OVERRIDE_GAME_RESULT", description: "Record one official terminal game result", warnings: ["The result is immutable; corrections require a later repair action."], instructions: ["Select the scheduled matchup.", "Enter final scores, an explanation, and an optional source URL.", "Review and confirm the preview."], undoable: false },
  { name: "CLOSE_WEEK", description: "Manually close the current League Season week", warnings: ["Closure is final for league purposes and cannot be reopened by later game results."], instructions: ["Review all selected-game results and unfinished unselected games.", "Enter an explanation.", "Confirm the preview."], undoable: false },
]);

function listAdminActions() { return ACTIONS.map((action) => ({ ...action, warnings: [...action.warnings], instructions: [...action.instructions] })); }
function getAdminAction(name) { return ACTIONS.find((action) => action.name === name) || null; }
module.exports = { getAdminAction, listAdminActions };
