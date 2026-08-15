import { browserLogger } from "../logger.js";

// Verify these names and files during every League Season activation. See docs/nfl-data.md.
const TEAM_LOGO_PATHS = Object.freeze({
  "Arizona Cardinals": "/css/assets/logos/arizona-cardinals-logo.png",
  "Atlanta Falcons": "/css/assets/logos/atlanta-falcons-logo.png",
  "Baltimore Ravens": "/css/assets/logos/baltimore-ravens-logo.png",
  "Buffalo Bills": "/css/assets/logos/buffalo-bills-logo.png",
  "Carolina Panthers": "/css/assets/logos/carolina-panthers-logo.png",
  "Chicago Bears": "/css/assets/logos/chicago-bears-logo.png",
  "Cincinnati Bengals": "/css/assets/logos/cincinnati-bengals-logo.png",
  "Cleveland Browns": "/css/assets/logos/cleveland-browns-logo.png",
  "Dallas Cowboys": "/css/assets/logos/dallas-cowboys-logo.png",
  "Denver Broncos": "/css/assets/logos/denver-broncos-logo.png",
  "Detroit Lions": "/css/assets/logos/detroit-lions-logo.png",
  "Green Bay Packers": "/css/assets/logos/green-bay-packers-logo.png",
  "Houston Texans": "/css/assets/logos/houston-texans-logo.png",
  "Indianapolis Colts": "/css/assets/logos/indianapolis-colts-logo.png",
  "Jacksonville Jaguars": "/css/assets/logos/jacksonville-jaguars-logo.png",
  "Kansas City Chiefs": "/css/assets/logos/kansas-city-chiefs-logo.png",
  "Las Vegas Raiders": "/css/assets/logos/oakland-raiders-logo.png",
  "Los Angeles Chargers": "/css/assets/logos/los-angeles-chargers-logo.png",
  "Los Angeles Rams": "/css/assets/logos/Rams-icon.png",
  "Miami Dolphins": "/css/assets/logos/miami-dolphins-logo.png",
  "Minnesota Vikings": "/css/assets/logos/minnesota-vikings-logo.png",
  "New England Patriots": "/css/assets/logos/new-england-patriots-logo.png",
  "New Orleans Saints": "/css/assets/logos/new-orleans-saints-logo.png",
  "New York Giants": "/css/assets/logos/new-york-giants-logo.png",
  "New York Jets": "/css/assets/logos/new-york-jets-logo.png",
  "Philadelphia Eagles": "/css/assets/logos/philadelphia-eagles-logo.png",
  "Pittsburgh Steelers": "/css/assets/logos/pittsburgh-steelers-logo.png",
  "San Francisco 49ers": "/css/assets/logos/san-francisco-49ers-logo.png",
  "Seattle Seahawks": "/css/assets/logos/seattle-seahawks-logo.png",
  "Tampa Bay Buccaneers": "/css/assets/logos/tampa-bay-buccaneers-logo.png",
  "Tennessee Titans": "/css/assets/logos/tennessee-titans-logo.png",
  "Washington Commanders": "/css/assets/logos/Washington-Commanders-icon.png",
});

export function resolveTeamLogo(teamName) {
  return TEAM_LOGO_PATHS[teamName] || null;
}

export function loadTeamLogo({
  teamName,
  image,
  fallback,
  timeoutMs = 5000,
  keepFallbackVisible = false,
  setTimeoutImpl = globalThis.setTimeout,
  clearTimeoutImpl = globalThis.clearTimeout,
  logger = browserLogger,
  warnedTeamNames,
}) {
  const logoPath = resolveTeamLogo(teamName);
  fallback.hidden = !keepFallbackVisible;
  image.hidden = false;
  image.alt = `${teamName} logo`;

  let retryStarted = false;
  let settled = false;
  let timeoutId;
  let resolveOutcome;
  const outcome = new Promise((resolve) => {
    resolveOutcome = resolve;
  });

  const settle = (value) => {
    if (settled) return;
    settled = true;
    resolveOutcome(value);
  };
  const handleLoad = () => {
    clearTimeoutImpl(timeoutId);
    image.hidden = false;
    fallback.hidden = !keepFallbackVisible;
    image.removeEventListener("error", handleError);
    image.removeEventListener("load", handleLoad);
    settle("loaded");
  };
  const showFallback = ({ allowLateLoad = false } = {}) => {
    clearTimeoutImpl(timeoutId);
    image.hidden = true;
    fallback.hidden = false;
    image.removeEventListener("error", handleError);
    if (!allowLateLoad) image.removeEventListener("load", handleLoad);
    settle("fallback");
  };
  const handleError = () => {
    if (retryStarted) {
      showFallback();
      return;
    }
    retryStarted = true;
    image.src = `${logoPath}?retry=1`;
  };

  if (!logoPath) {
    if (!warnedTeamNames?.has(teamName)) {
      logger.warn("No checked-in Team logo", { teamName });
      warnedTeamNames?.add(teamName);
    }
    showFallback();
    return outcome;
  }

  image.addEventListener("load", handleLoad);
  image.addEventListener("error", handleError);
  timeoutId = setTimeoutImpl(() => showFallback({ allowLateLoad: true }), timeoutMs);
  image.src = logoPath;
  return outcome;
}

export { TEAM_LOGO_PATHS };
