// const { post } = require("../../controllers/api/user-routes");

async function loginFormHandler(event) {
  event.preventDefault();
  const username = document.querySelector("#inputUsername").value.trim();
  const password = document.querySelector("#inputPassword").value.trim();
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
      const data = await response.json();
      const userId = data.user.id; // Assuming the response includes the user's ID

      // Store the username and user ID in localStorage
      window.localStorage.setItem("loggedInUser", username.toLowerCase());
      window.localStorage.setItem("loggedInUserId", userId);

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
