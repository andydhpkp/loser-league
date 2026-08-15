const assert = require("node:assert/strict");
const test = require("node:test");

test("login submits the exact persistence choice and preserves password whitespace", async (t) => {
  const requests = [];
  const fields = {
    "#inputUsername": { value: "  alice  " },
    "#inputPassword": { value: " secret " },
    "#staySignedIn": { checked: false },
  };
  t.mock.method(globalThis, "fetch", async (url, options) => {
    requests.push({ url, options });
    return { ok: true, json: async () => ({ user: { id: 3, username: "alice" } }) };
  });
  globalThis.document = { querySelector: (selector) => fields[selector] };
  globalThis.location = { search: "", href: "" };
  t.after(() => {
    delete globalThis.document;
    delete globalThis.location;
  });
  const { loginFormHandler } = await import(`../../public/js/login.js?test=${Date.now()}`);

  await loginFormHandler({ preventDefault() {} });

  assert.deepEqual(JSON.parse(requests[0].options.body), {
    username: "alice",
    password: " secret ",
    staySignedIn: false,
  });
  assert.equal(globalThis.location.href, "/dashboard.html");
});

test("login destination accepts only the existing safe return path", async () => {
  const { resolveLoginDestination } = await import(`../../public/js/login.js?destination=${Date.now()}`);
  assert.equal(resolveLoginDestination("?returnTo=%2Freminder-settings.html"), "/reminder-settings.html");
  assert.equal(resolveLoginDestination("?returnTo=https%3A%2F%2Fevil.example"), "/dashboard.html");
  assert.equal(resolveLoginDestination("?returnTo=%2F%2Fevil.example"), "/dashboard.html");
  assert.equal(resolveLoginDestination(""), "/dashboard.html");
});
