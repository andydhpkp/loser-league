async function viewLeaguePicks(event) {
    event.preventDefault();
    const main = document.getElementById('leagueMain')

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