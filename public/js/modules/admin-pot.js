export function createAdminPot({ root, fetchPot = () => fetch("/api/admin/pot", { cache: "no-store" }) }) {
  const total = root.querySelector("#leaguePotTotal");
  const breakdown = root.querySelector("#leaguePotBreakdown");
  const heading = root.querySelector("#leaguePotHeading");
  const refresh = root.querySelector("#refreshLeaguePot");
  const money = cents => (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
  let pending = false;
  return async function load() {
    if (pending) return;
    pending = true;
    refresh.disabled = true;
    total.textContent = "Loading…";
    breakdown.textContent = "";
    try {
      const response = await fetchPot();
      if (!response.ok) throw new Error("Unavailable");
      const pot = await response.json();
      if (!pot.leagueSeason) {
        heading.textContent = "League pot";
        total.textContent = "No League Season";
        return;
      }
      if (![pot.trackCount, pot.buybackCount, pot.baseCents, pot.buybackCents, pot.totalCents].every(value => Number.isSafeInteger(value) && value >= 0)) throw new Error("Unavailable");
      heading.textContent = `${pot.leagueSeason.year} ${pot.leagueSeason.schedulePhase === "PRESEASON" ? "preseason test pot" : "League pot"}`;
      total.textContent = money(pot.totalCents);
      breakdown.textContent = `${pot.trackCount} Tracks × $5 = ${money(pot.baseCents)}; ${pot.buybackCount} completed buybacks × $10 = ${money(pot.buybackCents)}.`;
    } catch (_error) {
      total.textContent = "Unavailable";
      breakdown.textContent = "";
    } finally {
      pending = false;
      refresh.disabled = false;
    }
  };
}
