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


async function getBodyForPicks() {
    fetch(`/api/tracks/`).then(function(response) {
        if(response.ok) {
            response.json().then(function(data) {
                console.log(data)
                let picks = document.getElementsByClassName('tempPick')
                let totalPicks = picks.length
                let trackHelp = document.getElementsByClassName('trackContainer')
                let trackTotal = trackHelp.length
                let trackIdPicksArr = []
                let trackSelectionsArr = []
                let finalPicksArrHelper = []
                let picksObj = []
                

                if (totalPicks != trackTotal) {
                    alert('Please Make A Pick For Each Track')
                } else {
                    
                    for(i=0; i<trackTotal; i++) {
                        let parseId = parseInt(trackHelp[i].id)
                        trackIdPicksArr.push(parseId)
                        trackSelectionsArr.push(picks[i].id)
                        finalPicksArrHelper.push(trackSelectionsArr[i].split(',', 2))
                        let finalPick = finalPicksArrHelper[i][1]
            
                        picksObj.push({
                            trackId: parseId,
                            trackSelection: finalPick
                        })
                    }
            
                    console.log(picksObj)
            
                    for(i=0; i<picksObj.length; i++) {
                        let idHelper = picksObj[i].trackId - 1;
                        let available_picks = data[idHelper].available_picks
                        let used_picks = data[idHelper].used_picks
                        let current_pick = picksObj[i].trackSelection
                        let user_id = data[idHelper].user_id
                        let putTrackId = picksObj[i].trackId
                        let colorTrack = document.getElementById(picksObj[i].trackId)
                        let noDuplicates = document.getElementsByClassName('successfulPick')
                        let noDuplicatesId =[]

                        if(noDuplicates.length>0) {
                            for(k=0; k<noDuplicates.length; k++) {
                                noDuplicatesId.push(parseInt(noDuplicates[k].id))
                            }
                        }

                        console.log(noDuplicates)
                        console.log(noDuplicatesId)
                        console.log(putTrackId)

                        if(!noDuplicatesId.includes(putTrackId)) {
                            let tryAgain = document.getElementsByClassName('unsuccessfulPick')

                            if(tryAgain.length>0) {
                                for(j=0; j<tryAgain.length; j++) {
                                    let tryAgainId = parseInt(tryAgain[j].id)
                                    if(putTrackId === tryAgainId) {
                                        let resetClass = tryAgain[j]
                                        resetClass.classList.toggle('unsuccessfulPick')
                                    }
                                }
                            }

                            if(used_picks.includes(current_pick)) {
                                let alertTrackNumber = i + 1
                                colorTrack.classList.toggle('unsuccessfulPick')
                                alert(`Sorry, ${current_pick} has already been picked for track number ${alertTrackNumber}, try again!`)
                            } else {
                                used_picks.push(current_pick)
                                available_picks = available_picks.filter(item => item !== current_pick)
                                console.log('submitted!!!!')
                                colorTrack.classList.toggle('successfulPick')
                                makePick(available_picks, used_picks, current_pick, user_id, putTrackId)
                            }
                        }

                    }
                    let finishedCheck = document.getElementsByClassName('successfulPick')
                    if (finishedCheck.length === picksObj.length) {
                        location.href = "../league-page.html"
                    } 
                }


            })
        } else {
            alert('Sorry, could not connect to database, please try again')
            console.log(response)
        }
    })
}


async function makePick(available_picks, used_picks, current_pick, user_id, putTrackId) {

    const response = await fetch(`api/tracks/${putTrackId}`, {
        method: 'put',
        body: JSON.stringify({
            available_picks,
            used_picks,
            current_pick,
            user_id
        }),
        headers: {'Content-Type': 'application/json'}
    })
    if(response.ok) {
        console.log('updated')
    } else {
        alert(response.statusText)
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

async function leagueUserTableHandler() {

    fetch('/api/users').then(function(response) {
        if (response.ok) {
            response.json().then(function (data) {

                //let orderUsersArr = 

                let viewUsersTable = document.getElementById('leagueMain')

                let mainTable = document.createElement('table')
                mainTable.className = 'table'
                let tHead = document.createElement('thead')
                let trHead = document.createElement('tr')
                let firstScope = document.createElement('th')
                firstScope.setAttribute('scope', 'col')

                let secondScope = document.createElement('th')
                secondScope.setAttribute('scope', 'col')
                secondScope.innerText = 'First'

                let thirdScope = document.createElement('th')
                thirdScope.setAttribute('scope', 'col')
                thirdScope.innerText = 'Last'

                let fourthScope = document.createElement('th')
                fourthScope.setAttribute('scope', 'col')
                fourthScope.innerText = 'Tracks Left'

                let fifthScope = document.createElement('th')
                fifthScope.setAttribute('scope', 'col')
                fifthScope.innerText = 'Picks Submitted'

                trHead.appendChild(firstScope)
                trHead.appendChild(secondScope)
                trHead.appendChild(thirdScope)
                trHead.appendChild(fourthScope)
                trHead.appendChild(fifthScope)
                tHead.appendChild(trHead)
                mainTable.appendChild(tHead)

                console.log(mainTable)

                let tBody = document.createElement('tbody')

                for (i=0; i<data.length; i++) {
                    let tr = document.createElement('tr')
                    let th = document.createElement('th')
                    th.setAttribute('scope', 'row')
                    th.innerText = i+1
                    tr.appendChild(th)

                    let tdFirst = document.createElement('td')
                    tdFirst.innerText = data[i].first_name
                    let tdLast = document.createElement('td')
                    tdLast.innerText = data[i].last_name
                    let tdTracks = document.createElement('td')
                    tdTracks.innerText = data[i].tracks.length
                    let tdSubmitted = document.createElement('td')
                    tdSubmitted.innerText = 'Yes'

                    tr.appendChild(tdFirst)
                    tr.appendChild(tdLast)
                    tr.appendChild(tdTracks)
                    tr.appendChild(tdSubmitted)

                    tBody.appendChild(tr)
                }

                mainTable.appendChild(tBody)

                viewUsersTable.appendChild(mainTable)

            })
        } else {
            alert('Sorry, could not connect to database')
        }
    })
}