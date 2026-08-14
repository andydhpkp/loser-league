const HISTORY_MS = 30 * 24 * 60 * 60 * 1000;

const keyFor = ({ year, phase, round }) => `${year}:${phase}:${round}`;

function reconcileEvents({ existing, evidence, invalidKeys, now = new Date() }) {
  const current = new Map(existing.map((event) => [keyFor(event), event]));
  const changes = [];
  for (const fact of evidence) {
    const prior = current.get(keyFor(fact));
    if (!prior) changes.push({ ...fact, status: "CONFIRMED", sequence: 0, kind: "CREATE", revisedAt: now });
    else if (prior.status !== "CONFIRMED" || new Date(prior.deadline).getTime() !== new Date(fact.deadline).getTime()) changes.push({ ...fact, status: "CONFIRMED", sequence: prior.sequence + 1, kind: "UPDATE", revisedAt: now });
    else if (prior.sourceHash !== fact.sourceHash) changes.push({ ...fact, status: prior.status, sequence: prior.sequence, kind: "EVIDENCE", revisedAt: prior.revisedAt });
  }
  for (const invalidKey of invalidKeys) {
    const prior = current.get(invalidKey);
    if (prior && prior.status !== "CANCELLED" && new Date(prior.deadline) > now) changes.push({ ...prior, status: "CANCELLED", sequence: prior.sequence + 1, kind: "CANCEL", revisedAt: now, cancelledAt: now });
  }
  return { changes };
}

function visibleEvents(events, now = new Date()) {
  const cutoff = now.getTime() - HISTORY_MS;
  return events.filter((event) => new Date(event.deadline).getTime() >= cutoff && (event.status !== "CANCELLED" || !event.cancelledAt || new Date(event.cancelledAt).getTime() >= cutoff));
}

module.exports = { HISTORY_MS, keyFor, reconcileEvents, visibleEvents };
