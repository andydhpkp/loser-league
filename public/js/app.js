const doRegister = function(e) {
    e.preventDefault();
    const username = document.getElementById('createInput').value;
    const email = document.getElementById('createEmail').value;
    const password = document.getElementById('createPassword').value;

    register({
        username: username,
        email: email,
        password: password
    }).then(function(res) {
        window.location.href = 'index.html'
    })
} 

const doLogin = function(e) {
    e.preventDefault();
    const username = document.getElementById('inputUsername').value;
    const password = document.getElementById('inputPassword').value;

    login({
        username: username,
        password: password
    }).then(function(res) {
        window.location.href = 'profile.html'
    })
}

const doLogout = function(e) {
    e.preventDefault();
}