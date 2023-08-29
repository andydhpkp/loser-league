async function resetPasswordHandler(event) {
  event.preventDefault();
  const email = document.querySelector("#forgotPasswordEmail").value.trim();
  const newPassword = document
    .querySelector("#resetPasswordInput")
    .value.trim();
  const confirmPassword = document
    .querySelector("#confirmResetPasswordInput")
    .value.trim();
  const newUsername = document
    .querySelector("#forgotPasswordUsername")
    .value.trim();

  if (newPassword !== confirmPassword) {
    alert("Passwords do not match!");
    return;
  }

  if (email && newPassword) {
    const response = await fetch("/api/users/reset-password", {
      method: "post",
      body: JSON.stringify({
        email,
        newPassword,
        newUsername,
      }),
      headers: { "Content-Type": "application/json" },
    });

    if (response.ok) {
      alert("Password reset successful!");
      window.localStorage.setItem("loggedInUser", username.toLowerCase());
      location.href = "../profile.html";
    } else {
      alert("Failed to reset password");
    }
  }
}

document
  .querySelector("#resetPasswordBtn")
  .addEventListener("click", resetPasswordHandler);
