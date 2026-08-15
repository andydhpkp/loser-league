// const { post } = require("../../controllers/api/user-routes");

export async function loginFormHandler(event) {
  event.preventDefault();
  const username = document.querySelector("#inputUsername").value.trim();
  const password = document.querySelector("#inputPassword").value;
  const staySignedIn = document.querySelector("#staySignedIn").checked;

  if (username && password) {
    const response = await fetch("/api/users/login", {
      method: "post",
      body: JSON.stringify({
        username,
        password,
        staySignedIn,
      }),
      headers: { "Content-Type": "application/json" },
    });

    if (response.ok) {
      await response.json();
      location.href = resolveLoginDestination(location.search);
    } else {
      alert("Sorry, incorrect username or password");
    }
  }
}

export function resolveLoginDestination(search) {
  const returnTo = new globalThis.URLSearchParams(search).get("returnTo");
  return returnTo === "/reminder-settings.html" ? returnTo : "/dashboard.html";
}

export function revealLoginPassword() {
  var x = document.getElementById("inputPassword");
  if (x.type === "password") {
    x.type = "text";
  } else {
    x.type = "password";
  }
}

export function bindLoginForm() {
  document
    .querySelector(".login-form")
    .addEventListener("submit", loginFormHandler);
}
