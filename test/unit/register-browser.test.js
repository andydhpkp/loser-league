const assert = require("node:assert/strict");
const test = require("node:test");

test("registration alerts the safe server message when account creation fails", async (t) => {
  const alerts = [];
  const fields = {
    "#createFirstName": { value: " Test " },
    "#createLastName": { value: " User " },
    "#createUsername": { value: " TestUser " },
    "#createEmail": { value: "test@example.test" },
    "#createPassword": { value: "password" },
  };
  t.mock.method(globalThis, "fetch", async () => ({
    ok: false,
    json: async () => ({ message: "An account with that email already exists. Log in or use a different email." }),
  }));
  globalThis.document = { querySelector: (selector) => fields[selector] };
  globalThis.location = { href: "" };
  globalThis.alert = (message) => alerts.push(message);
  t.after(() => {
    delete globalThis.document;
    delete globalThis.location;
    delete globalThis.alert;
  });
  const { signupFormHandler } = await import(`../../public/js/register.js?server-message=${Date.now()}`);

  await signupFormHandler({ preventDefault() {} });

  assert.deepEqual(alerts, ["An account with that email already exists. Log in or use a different email."]);
  assert.equal(globalThis.location.href, "");
});

test("registration warns when required fields are missing before submitting", async (t) => {
  const alerts = [];
  let submitted = false;
  const fields = {
    "#createFirstName": { value: "Test" },
    "#createLastName": { value: "User" },
    "#createUsername": { value: "" },
    "#createEmail": { value: "test@example.test" },
    "#createPassword": { value: "password" },
  };
  t.mock.method(globalThis, "fetch", async () => {
    submitted = true;
    return { ok: true };
  });
  globalThis.document = { querySelector: (selector) => fields[selector] };
  globalThis.location = { href: "" };
  globalThis.alert = (message) => alerts.push(message);
  t.after(() => {
    delete globalThis.document;
    delete globalThis.location;
    delete globalThis.alert;
  });
  const { signupFormHandler } = await import(`../../public/js/register.js?required-fields=${Date.now()}`);

  await signupFormHandler({ preventDefault() {} });

  assert.equal(submitted, false);
  assert.deepEqual(alerts, ["Enter your first name, last name, username, email, and password."]);
});
