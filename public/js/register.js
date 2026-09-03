export function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
  }
  
async function readErrorMessage(response) {
    try {
        const payload = await response.json();
        if (payload && typeof payload.message === "string" && payload.message.trim()) {
            return payload.message;
        }
    } catch (_error) {
        // Fall through to a stable client-side fallback.
    }
    return "We could not create your account. Please check your information and try again.";
}

export async function signupFormHandler(event) {
    event.preventDefault();
    let first_name = document.querySelector('#createFirstName').value.trim();
    first_name = capitalizeFirstLetter(first_name)
    let last_name = document.querySelector('#createLastName').value.trim();
    last_name = capitalizeFirstLetter(last_name)
    let username = document.querySelector('#createUsername').value.trim();
    username = username.toLowerCase()
    const email = document.querySelector('#createEmail').value.trim();
    const password = document.querySelector('#createPassword').value.trim();

    if (first_name && last_name && username && email && password) {
        const response = await fetch('/api/users', {
            method: 'post',
            body: JSON.stringify({
                first_name,
                last_name,
                username,
                email,
                password
            }),
            headers: { 'Content-Type': 'application/json' }
        });
        if (response.ok) {
            location.href = "/dashboard.html";
        } else {
            alert(await readErrorMessage(response));
        }
    } else {
        alert("Enter your first name, last name, username, email, and password.");
    }
}

export function revealPassword() {
    var x = document.getElementById("register-master-password");
    if (x.type === "password") {
        x.type = "text";
    } else {
        x.type = "password";
    }
}

export function bindRegistrationForm() {
  document
    .querySelector(".register-form")
    .addEventListener("submit", signupFormHandler);
}
