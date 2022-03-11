async function signupFormHandler(event) {
    event.preventDefault();
    const first_name = document.querySelector('#createFirstName').value.trim();
    const last_name = document.querySelector('#createLastName').value.trim();
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