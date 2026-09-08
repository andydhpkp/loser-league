// Safari can leave loaded League logos unpainted. Keep the user-confirmed
// one-second transform temporary and bounded, rather than promoting the table.
export function createLeagueLogoRepaint(view = window) {
  if (!view.IntersectionObserver) return { observe() {}, dispose() {} };

  const pending = new Set();
  const nearby = new Set();
  const completed = new WeakSet();
  let active = [];
  let frame = null;
  let timer = null;
  let disposed = false;

  const observer = new view.IntersectionObserver((entries) => {
    if (disposed) return;
    for (const { target, isIntersecting } of entries) {
      if (!pending.has(target)) continue;
      if (isIntersecting) nearby.add(target);
      else nearby.delete(target);
    }
    schedule();
  }, { root: null, rootMargin: "100px 0px", threshold: 0 });

  function forget(image) {
    observer.unobserve(image);
    image.removeEventListener("load", schedule);
    pending.delete(image);
    nearby.delete(image);
  }

  function startBatch() {
    frame = null;
    if (disposed) return;
    for (const image of nearby) {
      if (!image.isConnected) {
        forget(image);
        continue;
      }
      if (!image.complete || image.naturalWidth === 0 || image.hidden) continue;
      image.classList.add("logo-repaint");
      active.push(image);
      if (active.length === 8) break;
    }
    if (!active.length) return;
    timer = view.setTimeout(() => {
      timer = null;
      for (const image of active) {
        image.classList.remove("logo-repaint");
        completed.add(image);
        forget(image);
      }
      active = [];
      schedule();
    }, 1000);
  }

  function schedule() {
    if (disposed || frame !== null || timer !== null || !nearby.size) return;
    frame = view.requestAnimationFrame(startBatch);
  }

  return {
    observe(image) {
      if (disposed || pending.has(image) || completed.has(image)) return;
      pending.add(image);
      // Register after the loader's listener so late loads restore visibility
      // before the scheduled frame checks eligibility.
      image.addEventListener("load", schedule);
      observer.observe(image);
    },
    dispose() {
      disposed = true;
      if (frame !== null) view.cancelAnimationFrame(frame);
      if (timer !== null) view.clearTimeout(timer);
      observer.disconnect();
      for (const image of pending) image.removeEventListener("load", schedule);
      for (const image of active) image.classList.remove("logo-repaint");
      pending.clear();
      nearby.clear();
      active = [];
    },
  };
}
