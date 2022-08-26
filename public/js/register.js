function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
  }
  

async function signupFormHandler(event) {
    event.preventDefault();
    let first_name = document.querySelector('#createFirstName').value.trim();
    first_name = capitalizeFirstLetter(first_name)
    let last_name = document.querySelector('#createLastName').value.trim();
    last_name = capitalizeFirstLetter(last_name)
    const username = document.querySelector('#createUsername').value.trim();
    const email = document.querySelector('#createEmail').value.trim();
    const password = document.querySelector('#createPassword').value.trim();

    if (first_name && last_name && email && password) {
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
            window.localStorage.setItem("loggedInUser", username)
            location.href = "../profile.html";
        } else {
            alert(response.statusText);
        }
    }
}

function revealPassword() {
    var x = document.getElementById("register-master-password");
    if (x.type === "password") {
        x.type = "text";
    } else {
        x.type = "password";
    }
}

document.querySelector('.register-form').addEventListener('submit', signupFormHandler);