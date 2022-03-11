// const { post } = require("../../controllers/api/user-routes");

async function loginFormHandler(event) {
    event.preventDefault();
    const username = document.querySelector('#inputUsername').value.trim();
    const password = document.querySelector('#inputPassword').value.trim();

    if (username && password) {
        console.log(username);
        console.log(password);
        const response = await fetch('/api/users/login', {
            method: 'post',
            body: JSON.stringify({
                username,
                password
            }),
            headers: { 'Content-Type': 'application/json' }
        });

        if (response.ok) {
            location.href = "../profile.html";
        } else {
            alert(response.statusText);
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

document.querySelector('.login-form').addEventListener('submit', loginFormHandler);