// const { post } = require("../../controllers/api/user-routes");

async function loginFormHandler(event) {
  event.preventDefault();
  const username = document.querySelector("#inputUsername").value.trim();
  const password = document.querySelector("#inputPassword").value.trim();
  // here if you want to make it optional
  const staySignedIn = true;

  if (username && password) {
    console.log(username);
    console.log(password);
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
      window.localStorage.setItem("loggedInUser", username.toLowerCase());
      location.href = "../profile.html";
      console.log(response);
    } else {
      alert("Sorry, incorrect username or password");
    }
  }
}

function revealLoginPassword() {
  var x = document.getElementById("inputPassword");
  if (x.type === "password") {
    x.type = "text";
  } else {
    x.type = "password";
  }
}

document.addEventListener("DOMContentLoaded", function () {
  document
    .querySelector(".login-form")
    .addEventListener("submit", loginFormHandler);
});
