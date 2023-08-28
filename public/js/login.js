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

document
  .querySelector(".login-form")
  .addEventListener("submit", loginFormHandler);

// document.getElementById("logoutBtn").addEventListener("click", logout);

async function logout() {
  try {
    const response = await fetch("/logout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    if (response.status === 204) {
      // Session destroyed successfully
      window.localStorage.removeItem("loggedInUser");
      location.href = "/index.html";
    } else if (response.status === 404) {
      // User was not logged in or session not found
      console.error("User was not logged in.");
      window.localStorage.removeItem("loggedInUser"); // Clear local storage
      location.href = "/index.html"; // Redirect to /index.html
    } else {
      // Some other unexpected response from server
      console.error("Failed to log out on the backend.");
    }
  } catch (error) {
    console.error("An error occurred:", error);
  }
}
