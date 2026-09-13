// Opt-in, local-only observations. Never serialize DOM text, URLs or API data.
export function createLeagueLogoDiagnostics({ root, view = window }) {
  const document = root.ownerDocument;
  const history = new WeakMap();
  const started = view.performance.now();
  let selected = null;
  let disposed = false;
  let repaintTarget = null;
  let repaintTimer = null;

  function state(image) {
    if (!history.has(image)) history.set(image, { loads: 0, errors: 0, repaintStarts: 0, repaintFinishes: 0, repaintTransformObserved: false, manualRepaintStarts: 0, manualRepaintFinishes: 0 });
    return history.get(image);
  }
  const observer = new view.MutationObserver(records => {
    for (const record of records) {
      const image = record.target;
      if (!image.matches("img.teamLogos")) continue;
      const wasActive = (record.oldValue || "").split(/\s+/).includes("logo-repaint");
      const active = image.classList.contains("logo-repaint");
      if (!wasActive && active) {
        state(image).repaintStarts++;
        state(image).repaintTransformObserved ||= view.getComputedStyle(image).transform !== "none";
      }
      if (wasActive && !active) state(image).repaintFinishes++;
    }
    repaintButton.disabled = !canRepaint();
  });
  observer.observe(root, { subtree: true, attributes: true, attributeFilter: ["class"], attributeOldValue: true });

  const panel = document.createElement("details");
  panel.id = "logoDiagnostics";
  const summary = document.createElement("summary");
  summary.textContent = "Logo diagnostics";
  const body = document.createElement("div");
  const instructions = document.createElement("p");
  instructions.textContent = "Tap a blank logo or its cell, then copy the report. Repaint this logo tests a brief redraw without reloading. Loaded does not mean visibly painted. Reports contain technical image state only and are not sent automatically.";
  const label = document.createElement("label");
  label.htmlFor = "logoDiagnosticReport";
  label.textContent = "Technical report";
  const report = document.createElement("textarea");
  report.id = "logoDiagnosticReport";
  report.readOnly = true;
  report.rows = 6;
  report.spellcheck = false;
  const actions = document.createElement("div");
  actions.className = "logo-diagnostic-actions";
  function button(id, text) {
    const element = document.createElement("button");
    element.id = id;
    element.type = "button";
    element.textContent = text;
    element.disabled = true;
    actions.appendChild(element);
    return element;
  }
  const copyButton = button("copyLogoReport", "Copy report");
  const refreshButton = button("refreshLogoReport", "Refresh report");
  const repaintButton = button("repaintLogo", "Repaint this logo");
  const status = document.createElement("p");
  status.id = "logoDiagnosticStatus";
  status.setAttribute("role", "status");
  status.textContent = "Tap a blank logo to select it.";
  body.append(instructions, label, report, actions, status);
  panel.append(summary, body);
  document.body.appendChild(panel);

  function canRepaint() {
    return !disposed && !repaintTarget && selected?.isConnected && root.contains(selected)
      && selected.complete && selected.naturalWidth > 0 && !selected.hidden
      && !selected.classList.contains("logo-repaint");
  }

  function inVisibleRegion(image, box) {
    let left = Math.max(0, box.left);
    let top = Math.max(0, box.top);
    let right = Math.min(view.innerWidth, box.right);
    let bottom = Math.min(view.innerHeight, box.bottom);
    for (let parent = image.parentElement; parent; parent = parent.parentElement) {
      const css = view.getComputedStyle(parent);
      const bounds = parent.getBoundingClientRect();
      if (/^(auto|scroll|hidden|clip)$/.test(css.overflowX)) {
        left = Math.max(left, bounds.left);
        right = Math.min(right, bounds.right);
      }
      if (/^(auto|scroll|hidden|clip)$/.test(css.overflowY)) {
        top = Math.max(top, bounds.top);
        bottom = Math.min(bottom, bounds.bottom);
      }
    }
    return right > left && bottom > top;
  }

  function refreshReport() {
    if (disposed) return;
    if (!selected?.isConnected || !root.contains(selected)) {
      selected = null;
      report.value = "";
      copyButton.disabled = true;
      refreshButton.disabled = true;
      repaintButton.disabled = true;
      status.textContent = "Tap a blank logo to select it.";
      return;
    }
    // Capture before opening/updating the panel; do not alter the image.
    const box = selected.getBoundingClientRect();
    const css = view.getComputedStyle(selected);
    const rounded = value => Math.round(value * 100) / 100;
    const snapshot = {
      schema: "league-logo-diagnostics-v2",
      viewport: { width: view.innerWidth, height: view.innerHeight, pixelRatio: view.devicePixelRatio },
      image: {
        complete: selected.complete,
        naturalWidth: selected.naturalWidth,
        naturalHeight: selected.naturalHeight,
        width: rounded(box.width),
        height: rounded(box.height),
        hidden: selected.hidden,
        display: css.display,
        visibility: css.visibility,
        opacity: Number(css.opacity),
        transformed: css.transform !== "none",
        repaintClass: selected.classList.contains("logo-repaint"),
        manualRepaintClass: selected.classList.contains("logo-diagnostic-repaint"),
        inVisibleRegion: inVisibleRegion(selected, box),
      },
      observed: { ...state(selected), elapsedMs: Math.round(view.performance.now() - started) },
    };
    report.value = JSON.stringify(snapshot, null, 2);
    copyButton.disabled = false;
    refreshButton.disabled = false;
    repaintButton.disabled = !canRepaint();
    status.textContent = "Snapshot ready. Copy it before refreshing the page.";
  }

  return {
    copyButton,
    refreshButton,
    repaintButton,
    inspect(event) {
      if (disposed || repaintTarget) return;
      const cell = event.target.closest?.(".teamNames");
      if (!cell || !root.contains(cell)) return;
      const image = cell.querySelector("img.teamLogos");
      if (!image) return;
      selected = image;
      refreshReport();
      panel.open = true;
    },
    recordLoad(event) {
      if (!disposed && event.target.matches?.("img.teamLogos")) state(event.target).loads++;
    },
    recordError(event) {
      if (!disposed && event.target.matches?.("img.teamLogos")) state(event.target).errors++;
    },
    refreshReport,
    repaint() {
      if (!canRepaint()) return;
      const image = selected;
      repaintTarget = image;
      state(image).manualRepaintStarts++;
      panel.open = false;
      summary.textContent = "Logo diagnostics — repainting";
      image.classList.add("logo-diagnostic-repaint");
      refreshReport();
      status.textContent = "Repaint in progress. Watch the selected logo.";
      repaintTimer = view.setTimeout(() => {
        repaintTimer = null;
        image.classList.remove("logo-diagnostic-repaint");
        state(image).manualRepaintFinishes++;
        repaintTarget = null;
        refreshReport();
        summary.textContent = "Logo diagnostics — repaint finished";
        if (selected) status.textContent = "Did the logo appear? Copy the updated report and tell us what you saw.";
      }, 1000);
    },
    async copyReport() {
      if (disposed || !report.value) return;
      try {
        if (!view.navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
        await view.navigator.clipboard.writeText(report.value);
        if (!disposed) status.textContent = "Report copied.";
      } catch (_error) {
        if (disposed) return;
        report.focus();
        report.select();
        status.textContent = "Select and copy the report manually; automatic copying is unavailable.";
      }
    },
    dispose() {
      disposed = true;
      observer.disconnect();
      if (repaintTimer !== null) view.clearTimeout(repaintTimer);
      repaintTarget?.classList.remove("logo-diagnostic-repaint");
      repaintTimer = null;
      repaintTarget = null;
      selected = null;
      panel.remove();
    },
  };
}
