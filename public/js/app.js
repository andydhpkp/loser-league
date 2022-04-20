async function createTrack(user_id) {
    let available_picks = nflArray2.map(getTeamNames)
    let used_picks = []
    let current_pick = ''

    const response = await fetch('/api/tracks', {
        method: 'post',
        body: JSON.stringify({
            available_picks,
            used_picks,
            current_pick,
            user_id
        }),
        headers: { 'Content-Type': 'application/json' }
    });
    if (response.ok) {
        console.log('CREATED TRACK')
        console.log(response)
    } else {
        alert(response.statusText)
    }
}

function getTeamNames(names) {
    return names.teamName
}


async function displayUsers() {

    fetch('/api/users').then(function(response) {
        if (response.ok) {
            response.json().then(function (data) {
                let adminViewUserDiv = document.getElementById('adminUsers')

                for (i=0; i<data.length; i++) {
                    let hiddenUserId = document.createElement('hidden')
                    let trackAmountDiv = document.createElement('div')
                    let usersNameDiv = document.createElement('div')
                    let trackAmountInput = document.createElement('input')
                    trackAmountInput.setAttribute('type', 'text')
                    trackAmountInput.setAttribute('class', 'trackAmounts')
                    trackAmountInput.setAttribute('placeholder', 'Number of Tracks')
                    let individualUserDiv = document.createElement('div') 
                    individualUserDiv.className = 'adminUsersView'
                    usersNameDiv.innerHTML = data[i].first_name
                    hiddenUserId.innerText = data[i].id
                    trackAmountDiv.appendChild(trackAmountInput)
                    individualUserDiv.appendChild(usersNameDiv)
                    individualUserDiv.appendChild(trackAmountDiv)
                    individualUserDiv.appendChild(hiddenUserId)
                    adminViewUserDiv.appendChild(individualUserDiv)
                }

                let trackSubmitBtn = document.createElement('button')
                trackSubmitBtn.setAttribute('class', 'btn btn-primary')
                trackSubmitBtn.setAttribute('onclick', 'submitTrackNumberHandler()')
                trackSubmitBtn.innerText = 'Submit Tracks'
                adminViewUserDiv.appendChild(trackSubmitBtn)
            })
        } else {
            alert('Sorry, could not connect to database')
        }
    })
}

function submitTrackNumberHandler() {
    let idGetter = document.getElementsByClassName('adminUsersView')
    let trackGetter = document.getElementsByClassName('trackAmounts')
    let postTrackHelp = []
    for (i=0; i<idGetter.length; i++) {
        let user_id = idGetter[i].children[2].innerText
        let track_number = trackGetter[i].value.trim()
        postTrackHelp.push({
            userId: parseInt(user_id),
            trackNumber: parseInt(track_number)
        })
    }
    for (i=0; i<postTrackHelp.length; i++) {
        console.log(postTrackHelp)
        for (j=0; j<postTrackHelp[i].trackNumber; j++) {
            createTrack(postTrackHelp[i].userId)
        }
    }
}


async function pickHandler() {

    let totalPicksNeeded = document.getElementById('trackNumber').value.trim();
    let picks = document.getElementsByClassName('tempPick')
    let totalPicks = picks.length
    let trackHelp = document.getElementsByClassName('trackContainer')
    let trackTotal = trackHelp.length

    if (totalPicks != totalPicksNeeded) {
        alert('Please Make A Pick For Each Track')
    } else {
        
        //figure out how to have track Id
        
        

        const response = await fetch('api/tracks/:id', {
            method: 'put',
            body: JSON.stringify({

            })
        })
    }

    /* const pick = document.querySelector('#inputUsername').value;

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
            alert('Sorry, incorrect username or password');
        }
    } */
}

function revealLoginPassword() {
    var x = document.getElementById("inputPassword");
    if (x.type === "password") {
        x.type = "text";
    } else {
        x.type = "password";
    }
}

//document.querySelector('.login-form').addEventListener('submit', loginFormHandler);

function registerClick(clicked_id) {
    
    let duplicateCheck = document.getElementsByClassName('tempPick')

    let clickedCheck = clicked_id.split(',', 1)
    let clickedCheckInt = parseInt(clickedCheck[0])

    let duplicateCheckId = duplicateCheck

    for (i=0; i<duplicateCheck.length; i++) {
        duplicateCheckId = duplicateCheck[i].id
        let duplicateCheckIdArr = duplicateCheckId.split(',', 1)
        let parsedDuplicateCheckId = parseInt(duplicateCheckIdArr[0])

        if(clickedCheckInt === parsedDuplicateCheckId) {
            let extra = duplicateCheck[i]
            extra.removeAttribute('class', 'tempPick')
        }
    }
    let pickedTeam = clicked_id
    let pickedTeamDiv = document.getElementById(pickedTeam)
    pickedTeamDiv.setAttribute('class', 'tempPick')
}

function submitPicks() {

}