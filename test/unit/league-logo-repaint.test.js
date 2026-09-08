const test = require('node:test');
const assert = require('node:assert/strict');

async function fixture() {
  const { createLeagueLogoRepaint } = await import('../../public/js/modules/league-logo-repaint.js');
  let intersect;
  const observed = new Set();
  const frames = new Map();
  const timers = new Map();
  let id = 0;
  const view = {
    IntersectionObserver: class {
      constructor(callback) { intersect = callback; }
      observe(image) { observed.add(image); }
      unobserve(image) { observed.delete(image); }
      disconnect() { observed.clear(); }
    },
    requestAnimationFrame(fn) { frames.set(++id, fn); return id; },
    cancelAnimationFrame(id) { frames.delete(id); },
    setTimeout(fn, ms) { assert.equal(ms, 1000); timers.set(++id, fn); return id; },
    clearTimeout(id) { timers.delete(id); },
  };
  const controller = createLeagueLogoRepaint(view);
  const images = Array.from({ length: 1000 }, () => {
    const classes = new Set();
    const listeners = new Map();
    return {
      complete: true, naturalWidth: 2200, hidden: false, isConnected: true,
      classList: { add: c => classes.add(c), remove: c => classes.delete(c) },
      addEventListener: (type, fn) => listeners.set(type, fn),
      removeEventListener: type => listeners.delete(type),
      classes, listeners,
    };
  });
  images.forEach(controller.observe);
  const flush = map => { const callbacks = [...map.values()]; map.clear(); callbacks.forEach(fn => fn()); };
  return { controller, images, observed, frames, timers, frame: () => flush(frames), tick: () => flush(timers), enter: imgs => intersect(imgs.map(target => ({ target, isIntersecting: true }))), leave: imgs => intersect(imgs.map(target => ({ target, isIntersecting: false }))) };
}

test('1000 logos use at most eight temporary transforms and one batch timer', async () => {
  const f = await fixture();
  f.enter(f.images);
  f.frame();
  assert.equal(f.images.filter(i => i.classes.size).length, 8);
  assert.equal(f.timers.size, 1);
  f.tick();
  assert.equal(f.images.filter(i => i.classes.size).length, 0);
  assert.equal(f.observed.size, 992);
  f.frame();
  assert.equal(f.images.filter(i => i.classes.size).length, 8);
  f.controller.dispose();
  assert.equal(f.images.filter(i => i.classes.size).length, 0);
  assert.equal(f.timers.size, 0);
  assert.equal(f.frames.size, 0);
  assert.equal(f.observed.size, 0);
  assert.ok(f.images.every(i => i.listeners.size === 0));
});

test('only nearby loaded logos repaint, including a late load, once per visit', async () => {
  const f = await fixture();
  const [ready, late, failed, departed] = f.images;
  late.complete = false; late.naturalWidth = 0;
  failed.naturalWidth = 0; failed.hidden = true;
  f.enter([ready, late, failed, departed]);
  f.leave([departed]);
  f.frame();
  assert.equal(ready.classes.size, 1);
  assert.equal(late.classes.size, 0);
  assert.equal(failed.classes.size, 0);
  assert.equal(departed.classes.size, 0);
  f.tick(); f.frame();
  late.complete = true; late.naturalWidth = 2200;
  late.listeners.get('load')();
  f.frame();
  assert.equal(late.classes.size, 1);
  f.tick();
  f.enter([ready]); f.frame();
  assert.equal(ready.classes.size, 0);
  f.controller.dispose();
});

test('disposal before the scheduled frame cancels work; missing observer is harmless', async () => {
  const f = await fixture();
  f.enter(f.images);
  f.controller.dispose(); f.frame();
  assert.ok(f.images.every(i => i.classes.size === 0));
  const { createLeagueLogoRepaint } = await import('../../public/js/modules/league-logo-repaint.js');
  const unsupported = createLeagueLogoRepaint({});
  unsupported.observe(f.images[0]); unsupported.dispose();
});
