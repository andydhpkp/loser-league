async function logout() {
  try {
    const response = await fetch("/logout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    if (response.status === 204) {
      // Session destroyed successfully
      window.localStorage.removeItem("loggedInUser");
      window.localStorage.removeItem("loggedInUserId"); // Clear loggedInUserId
      location.href = "/index.html";
    } else if (response.status === 404) {
      // User was not logged in or session not found
      console.error("User was not logged in.");
      window.localStorage.removeItem("loggedInUser"); // Clear local storage
      window.localStorage.removeItem("loggedInUserId"); // Clear loggedInUserId
      location.href = "/index.html"; // Redirect to /index.html
    } else {
      // Some other unexpected response from server
      console.error("Failed to log out on the backend.");
    }
  } catch (error) {
    console.error("An error occurred:", error);
  }
}
