const test = require("node:test");
const assert = require("node:assert/strict");
const { existsSync } = require("node:fs");
const { resolve } = require("node:path");

class FakeImage {
  constructor() {
    this.alt = "";
    this.hidden = false;
    this.listeners = new Map();
    this.sources = [];
  }

  set src(value) {
    this.sources.push(value);
  }

  get src() {
    return this.sources.at(-1);
  }

  addEventListener(type, listener) {
    this.listeners.set(type, listener);
  }

  removeEventListener(type, listener) {
    if (this.listeners.get(type) === listener) this.listeners.delete(type);
  }

  emit(type) {
    this.listeners.get(type)?.();
  }
}

test("a failed Team logo retries once before revealing its Team name", async () => {
  const { loadTeamLogo } = await import("../../public/js/modules/team-logos.js");
  const image = new FakeImage();
  const fallback = { hidden: false };
  let timerCallback;

  const outcome = loadTeamLogo({
    teamName: "Denver Broncos",
    image,
    fallback,
    setTimeoutImpl: (callback) => {
      timerCallback = callback;
      return 7;
    },
    clearTimeoutImpl: () => {},
  });

  assert.equal(fallback.hidden, true);
  assert.deepEqual(image.sources, [
    "/css/assets/logos/denver-broncos-logo.png",
  ]);

  image.emit("error");
  assert.deepEqual(image.sources, [
    "/css/assets/logos/denver-broncos-logo.png",
    "/css/assets/logos/denver-broncos-logo.png?retry=1",
  ]);
  assert.equal(fallback.hidden, true);

  image.emit("error");
  assert.equal(await outcome, "fallback");
  assert.equal(image.hidden, true);
  assert.equal(fallback.hidden, false);
  assert.equal(typeof timerCallback, "function");
});

test("the canonical manifest resolves checked-in artwork for every NFL Team", async () => {
  const { TEAM_LOGO_PATHS } = await import("../../public/js/modules/team-logos.js");
  const expectedTeams = [
    "Arizona Cardinals", "Atlanta Falcons", "Baltimore Ravens", "Buffalo Bills",
    "Carolina Panthers", "Chicago Bears", "Cincinnati Bengals", "Cleveland Browns",
    "Dallas Cowboys", "Denver Broncos", "Detroit Lions", "Green Bay Packers",
    "Houston Texans", "Indianapolis Colts", "Jacksonville Jaguars", "Kansas City Chiefs",
    "Las Vegas Raiders", "Los Angeles Chargers", "Los Angeles Rams", "Miami Dolphins",
    "Minnesota Vikings", "New England Patriots", "New Orleans Saints", "New York Giants",
    "New York Jets", "Philadelphia Eagles", "Pittsburgh Steelers", "San Francisco 49ers",
    "Seattle Seahawks", "Tampa Bay Buccaneers", "Tennessee Titans", "Washington Commanders",
  ];

  assert.deepEqual(Object.keys(TEAM_LOGO_PATHS).sort(), expectedTeams.sort());
  for (const path of Object.values(TEAM_LOGO_PATHS)) {
    assert.equal(path.startsWith("/css/assets/logos/"), true);
    assert.equal(existsSync(resolve("public", path.slice(1))), true, path);
  }
});

test("a loaded Team logo remains visible and keeps its fallback hidden", async () => {
  const { loadTeamLogo } = await import("../../public/js/modules/team-logos.js");
  const image = new FakeImage();
  const fallback = { hidden: false };

  const outcome = loadTeamLogo({
    teamName: "Chicago Bears",
    image,
    fallback,
    setTimeoutImpl: () => 8,
    clearTimeoutImpl: () => {},
  });
  image.emit("load");

  assert.equal(await Promise.race([outcome, Promise.resolve("pending")]), "loaded");
  assert.equal(image.hidden, false);
  assert.equal(image.alt, "Chicago Bears logo");
  assert.equal(fallback.hidden, true);
});

test("a Team logo can load on its automatic retry", async () => {
  const { loadTeamLogo } = await import("../../public/js/modules/team-logos.js");
  const image = new FakeImage();
  const fallback = { hidden: false };
  const outcome = loadTeamLogo({
    teamName: "Buffalo Bills",
    image,
    fallback,
    setTimeoutImpl: () => 9,
    clearTimeoutImpl: () => {},
  });

  image.emit("error");
  image.emit("load");

  assert.equal(await outcome, "loaded");
  assert.equal(image.hidden, false);
  assert.equal(fallback.hidden, true);
});

test("a timed-out Team logo shows its name and a late load restores the image", async () => {
  const { loadTeamLogo } = await import("../../public/js/modules/team-logos.js");
  const image = new FakeImage();
  const fallback = { hidden: false };
  let expire;
  const outcome = loadTeamLogo({
    teamName: "Seattle Seahawks",
    image,
    fallback,
    setTimeoutImpl: (callback) => {
      expire = callback;
      return 10;
    },
    clearTimeoutImpl: () => {},
  });

  expire();
  assert.equal(await outcome, "fallback");
  assert.equal(image.hidden, true);
  assert.equal(fallback.hidden, false);

  image.emit("load");
  assert.equal(image.hidden, false);
  assert.equal(fallback.hidden, true);
});

test("an unmatched Team immediately uses its name and warns safely", async () => {
  const { loadTeamLogo } = await import("../../public/js/modules/team-logos.js");
  const image = new FakeImage();
  const fallback = { hidden: false };
  const warnings = [];
  let timerStarted = false;

  const outcome = await loadTeamLogo({
    teamName: "Expansion Team",
    image,
    fallback,
    logger: { warn: (...details) => warnings.push(details) },
    setTimeoutImpl: () => {
      timerStarted = true;
    },
    clearTimeoutImpl: () => {},
  });

  assert.equal(outcome, "fallback");
  assert.equal(timerStarted, false);
  assert.equal(image.hidden, true);
  assert.equal(fallback.hidden, false);
  assert.deepEqual(warnings, [["No checked-in Team logo", { teamName: "Expansion Team" }]]);
});

test("League logo rendering isolates each Team cell", async () => {
  const { displayTeamLogos } = await import("../../public/js/modules/league-rendering.js");
  const cells = ["Denver Broncos", "Chicago Bears"].map((teamName) => ({
    children: [{ innerText: teamName, hidden: true }],
    appendChild(child) {
      this.children.push(child);
    },
  }));
  const started = [];

  const outcomes = await displayTeamLogos({
    root: { getElementsByClassName: () => cells },
    createImage: () => ({ className: "", hidden: false }),
    loadLogo: ({ teamName }) => {
      started.push(teamName);
      return teamName === "Denver Broncos"
        ? Promise.reject(new Error("synthetic image failure"))
        : Promise.resolve("loaded");
    },
  });

  assert.deepEqual(started, ["Denver Broncos", "Chicago Bears"]);
  assert.deepEqual(outcomes.map(({ status }) => status), ["rejected", "fulfilled"]);
  assert.equal(cells[0].children[1].className, "teamLogos");
  assert.equal(cells[1].children[1].className, "teamLogos");
});

test("League logo rendering leaves intentionally hidden Picks empty", async () => {
  const { displayTeamLogos } = await import("../../public/js/modules/league-rendering.js");
  const cell = {
    children: [{ innerText: "", hidden: true }],
    appendChild(child) {
      this.children.push(child);
    },
  };

  const outcomes = await displayTeamLogos({
    root: { getElementsByClassName: () => [cell] },
    createImage: () => ({ className: "" }),
    loadLogo: () => {
      throw new Error("hidden Pick should not start a logo lifecycle");
    },
  });

  assert.deepEqual(outcomes, []);
  assert.equal(cell.children.length, 1);
});

test("a matchup Team name stays visible while its logo loads", async () => {
  const { loadTeamLogo } = await import("../../public/js/modules/team-logos.js");
  const image = new FakeImage();
  const teamName = { hidden: false };

  loadTeamLogo({
    teamName: "Miami Dolphins",
    image,
    fallback: teamName,
    keepFallbackVisible: true,
    setTimeoutImpl: () => 11,
    clearTimeoutImpl: () => {},
  });

  assert.equal(teamName.hidden, false);
});

test("matchup rendering waits for independent logo fallbacks instead of rejecting", async () => {
  const { loadMatchupTeamLogos } = await import("../../public/js/teams.js");
  const images = ["Miami Dolphins", "Buffalo Bills"].map((teamName) => ({
    dataset: { teamName },
    nextElementSibling: { hidden: false },
  }));
  const started = [];

  const outcomes = await loadMatchupTeamLogos({
    root: { querySelectorAll: () => images },
    loadLogo: ({ teamName, keepFallbackVisible }) => {
      started.push([teamName, keepFallbackVisible]);
      return teamName === "Miami Dolphins"
        ? Promise.reject(new Error("synthetic lifecycle failure"))
        : Promise.resolve("loaded");
    },
  });

  assert.deepEqual(started, [
    ["Miami Dolphins", true],
    ["Buffalo Bills", true],
  ]);
  assert.deepEqual(outcomes.map(({ status }) => status), ["rejected", "fulfilled"]);
});
