function getTeamNames(names) {
    return names.teamName
}


async function displayUsers() {
    //data-bs-toggle="modal" data-bs-target="#adminPassword" href="#
    fetch('/api/users').then(function(response) {
        if (response.ok) {
            response.json().then(function (data) {
                let adminViewUserDiv = document.getElementById('adminUsers')

                let viewHelper = document.getElementById('andrew')
                console.log(viewHelper)
                console.log(data)

                for (i=0; i<data.length; i++) {
                    let hiddenUserId = document.createElement('hidden')
                    let trackAmountDiv = document.createElement('div')
                    let usersNameDiv = document.createElement('div')
                    let trackAmountInput = document.createElement('input')
                    let userNameAnchor = document.createElement('a')

                    let userModal = document.createElement('div')
                    userModal.setAttribute('class', 'modal fade')
                    userModal.setAttribute('id', `${data[i].first_name}`)
                    userModal.setAttribute('tabindex', '-1')
                    userModal.setAttribute('aria-labelledby', 'exampleModalLabel')
                    userModal.setAttribute('aria-hidden', 'true')

                    let userModalCentered = document.createElement('div')
                    userModalCentered.setAttribute('class', 'modal-dialog modal-dialog-centered')

                    let userModalContent = document.createElement('div')
                    userModalContent.setAttribute('class', 'modal-content')

                    let userModalHeader = document.createElement('div')
                    userModalHeader.setAttribute('class', 'modal-header')

                    let userModalTitle = document.createElement('h5')
                    userModalTitle.setAttribute('class', 'modal-title')
                    userModalTitle.setAttribute('id', 'name')
                    userModalTitle.innerText = `${data[i].first_name}`

                    let userModalHeaderClose = document.createElement('button')
                    userModalHeaderClose.setAttribute('type', 'button')
                    userModalHeaderClose.setAttribute('class', 'btn-close')
                    userModalHeaderClose.setAttribute('data-bs-dismiss', 'modal')
                    userModalHeaderClose.setAttribute('aria-label', 'Close')

                    userModalHeader.appendChild(userModalTitle)
                    userModalHeader.appendChild(userModalHeaderClose)

                    userModalContent.appendChild(userModalHeader)

                    let userModalBody = document.createElement('div')
                    userModalBody.setAttribute('class', 'modal-body')

                    let userModalBodymb = document.createElement('div')
                    userModalBodymb.setAttribute('class', 'mb-3')

                    let form = document.createElement('form')
                    
                    let deleteFormDiv = document.createElement('div')
                    deleteFormDiv.setAttribute('id', 'deleteForm')

                    let individualTrackNumber = data[i].tracks
                    for(j=0; j<individualTrackNumber.length; j++) {
                        let input = document.createElement('input')
                        let label = document.createElement('label')
                        let br = document.createElement('br')
                        input.setAttribute('type', 'checkbox')
                        input.setAttribute('id', `${individualTrackNumber[j].id}`)
                        input.setAttribute('name', 'track')
                        input.setAttribute('value', 'delete')

                        label.setAttribute('for', `${individualTrackNumber[j].id}`)
                        label.innerText = ` Track ${j+1}`

                        deleteFormDiv.appendChild(input)
                        deleteFormDiv.appendChild(label)
                        deleteFormDiv.appendChild(br)
                    }

                    let userNameDiv = document.createElement('div')

                    let nameInput = document.createElement('input')
                    nameInput.setAttribute('type', 'checkbox')
                    nameInput.setAttribute('id', `${data[i].username}`)
                    nameInput.setAttribute('name', 'user')
                    nameInput.setAttribute('value', 'delete')

                    let nameLabel = document.createElement('label')
                    nameLabel.setAttribute('for', 'userDelete')
                    nameLabel.innerText = ` Delete User: ${data[i].first_name}`

                    userNameDiv.appendChild(nameInput)
                    userNameDiv.appendChild(nameLabel)

                    let modalFooterDiv = document.createElement('div')
                    modalFooterDiv.setAttribute('class', 'modal-footer')

                    let closeBtn = document.createElement('button')
                    closeBtn.setAttribute('type', 'button')
                    closeBtn.setAttribute('class', 'btn btn-secondary')
                    closeBtn.setAttribute('data-bs-dismiss', 'modal')
                    closeBtn.innerText = 'Close'

                    let deleteBtn = document.createElement('button')
                    deleteBtn.setAttribute('type', 'button')
                    deleteBtn.setAttribute('class', 'btn btn-primary')
                    deleteBtn.setAttribute('onclick', 'deleteTracksAdmin()')
                    deleteBtn.innerText = 'Delete Selected'

                    modalFooterDiv.appendChild(closeBtn)
                    modalFooterDiv.appendChild(deleteBtn)

                    form.appendChild(deleteFormDiv)
                    form.appendChild(userNameDiv)
                    form.appendChild(modalFooterDiv)

                    userModalBodymb.appendChild(form)

                    userModalBody.appendChild(userModalBodymb)

                    userModalContent.appendChild(userModalBody)

                    userModalCentered.appendChild(userModalContent)

                    userModal.appendChild(userModalCentered)

                    userNameAnchor.setAttribute('data-bs-toggle', 'modal')
                    userNameAnchor.setAttribute('data-bs-target', `#${data[i].first_name}`)
                    userNameAnchor.setAttribute('href', '#')
                    trackAmountInput.setAttribute('type', 'text')
                    trackAmountInput.setAttribute('class', 'trackAmounts')
                    trackAmountInput.setAttribute('placeholder', 'Number of Tracks')
                    let individualUserDiv = document.createElement('div') 
                    individualUserDiv.className = 'adminUsersView'
                    userNameAnchor.innerHTML = data[i].first_name
                    hiddenUserId.innerText = data[i].id
                    individualUserDiv.appendChild(userNameAnchor)
                    trackAmountDiv.appendChild(trackAmountInput)
                    individualUserDiv.appendChild(usersNameDiv)
                    individualUserDiv.appendChild(trackAmountDiv)
                    individualUserDiv.appendChild(hiddenUserId)
                    adminViewUserDiv.appendChild(individualUserDiv)
                    adminViewUserDiv.appendChild(userModal)
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
    console.log('IDGETTER')
    console.log(idGetter)
    console.log(trackGetter)
    let postTrackHelp = []
    for (i=0; i<idGetter.length; i++) {
        let user_id = idGetter[i].children[3].innerText
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

async function getUserId() {
    fetch(`/api/users/`).then(function(response) {
        if(response.ok) {
            response.json().then(function(data) {
                let loggedInUsername = localStorage.getItem('loggedInUser')
                let loggedInUserId;
                console.log(loggedInUsername)
                for(i=0; i<data.length; i++) {
                    console.log(data)
                    if(data[i].username.toLowerCase() === loggedInUsername) {
                        loggedInUserId = data[i].id
                        console.log(loggedInUserId)
                    }
                }
                localStorage.setItem('loggedInUserId', loggedInUserId)
            })
        } else {
            alert(response.error)
        }
    })
}


async function getBodyForPicks() {
    fetch(`/api/tracks/`).then(function(response) {
        if(response.ok) {
            response.json().then(function(data) {
                console.log(data)

                let weekCheck = parseInt(localStorage.getItem('thisWeek'))

                //weekCheck = 3

                let allPicksIn = 0;
                let alreadyPicked = [];
                let donePicking = false;
                let thisUsersTracks = [];
                let thisUsersId = parseInt(localStorage.getItem('loggedInUserId'));
                let trackTotalHelp = document.getElementsByClassName('trackContainer')
                console.log(thisUsersId)
                for(w=0; w<data.length; w++) {
                    if(data[w].user_id === thisUsersId) {
                        thisUsersTracks.push(data[w])
                        if(data[w].used_picks.length > weekCheck) {
                            allPicksIn++;
                            alreadyPicked.push(data[w].id)
                            console.log(allPicksIn)
                            console.log(alreadyPicked)
                        }
                        if(allPicksIn === trackTotalHelp.length) {
                            alert('It looks like you have already made picks for this week!')
                            donePicking = true
                        }
                    }
                }
                console.log(thisUsersTracks)

                console.log(alreadyPicked)

                if(donePicking === false) {
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

                        let finishedCheck = 0
    
                        if(alreadyPicked.length <= picksObj.length) {
    
                            console.log(picksObj)
                
                            for(i=0; i<picksObj.length; i++) {
                                console.log('PICKSOBJ')
                                console.log(picksObj)
                                console.log(thisUsersTracks)
    
                                let idHelper;
                                let available_picks;
                                let used_picks;
                                let current_pick;
                                let user_id;
                                let putTrackId;
    
                                for(t=0; t<picksObj.length; t++) {
                                    if(picksObj[i].trackId === thisUsersTracks[t].id) {
                                        available_picks = thisUsersTracks[i].available_picks
                                        used_picks = thisUsersTracks[i].used_picks
                                        current_pick = picksObj[i].trackSelection
                                        user_id = thisUsersTracks[i].user_id
                                        putTrackId = picksObj[i].trackId
                                    }
                                    console.log('this is the i number times')
                                    console.log(available_picks)
                                    console.log(used_picks)
                                    console.log(current_pick)
                                    console.log(user_id)
                                    console.log(putTrackId)
                                }
    
    
    
                                let colorTrack = document.getElementById(picksObj[i].trackId)
                                let noDuplicates = document.getElementsByClassName('successfulPick')
                                let noDuplicatesId =[]
    
                                if(noDuplicates.length>0) {
                                    for(k=0; k<noDuplicates.length; k++) {
                                        noDuplicatesId.push(parseInt(noDuplicates[k].id))
                                    }
                                }
    
                                console.log('NO DUPLICATES')
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
                                    } 
    
    
    
                                } else {
                                    used_picks.push(current_pick)
                                    available_picks = available_picks.filter(item => item !== current_pick)
                                    console.log('submitted!!!!')
                                    finishedCheck++
                                    //colorTrack.classList.toggle('successfulPick')
                                    makePick(available_picks, used_picks, current_pick, user_id, putTrackId)
                                }
                            }
    
                        } 

                        if(finishedCheck >= picksObj.length) {
                            //location.href = "../league-page.html"
                        } 
                    }
                } else {
                    //location.href = "../league-page.html"
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
    let colorHelp = document.getElementsByClassName("tempPick")
    let coloredTrack
    for(x=0; x<colorHelp.length; x++) {
        coloredTrack = colorHelp[x].parentNode.parentNode;
        coloredTrack.classList.add('successfulPick')
    }
}

function submitPicks() {

}

async function leagueUserTableHandler() {

    let headerHelp = document.getElementsByTagName('header')[0]
    console.log(headerHelp)
    let currentWeekDiv = document.createElement('div')
    let currentWeekH1 = document.createElement('h1')
    let currentWeek = localStorage.getItem('thisWeek')
    currentWeekH1.innerHTML = `Week ${currentWeek}`
    currentWeekDiv.appendChild(currentWeekH1)
    headerHelp.appendChild(currentWeekDiv)

    fetch('/api/users').then(function(response) {
        if (response.ok) {
            response.json().then(function (data) {

                console.log(data)
                let largestPickLength = 0
                //find the picks length
                for(p=0; p<data.length; p++) {
                    let pickTester = data[p].tracks.length
                    if (pickTester >= largestPickLength) {
                        largestPickLength = pickTester
                    }
                }
                //let orderUsersArr = 

                let viewUsersTable = document.getElementById('leagueMain')

                let mainTable = document.createElement('table')
                mainTable.className = 'table table-striped'
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

                let sixthScope = document.createElement('th')
                sixthScope.setAttribute('scope', 'col')
                sixthScope.setAttribute('colspan', largestPickLength)
                sixthScope.innerText = 'Current Picks'

                trHead.appendChild(firstScope)
                trHead.appendChild(secondScope)
                trHead.appendChild(thirdScope)
                trHead.appendChild(fourthScope)
                trHead.appendChild(fifthScope)
                trHead.appendChild(sixthScope)
                tHead.appendChild(trHead)
                mainTable.appendChild(tHead)

                console.log(mainTable)

                let tBody = document.createElement('tbody')

                for (i=0; i<data.length; i++) {
                    let eliminated = false;
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
                    if(tdTracks.innerText === '0') {
                        eliminated = true
                    }
                    let tdSubmitted = document.createElement('td')
                    let submitted = 'No'

                    console.log(data[i])
                    let trackChecker = parseInt(currentWeek);
                    trackChecker++
                    let trackValidatorHelp = 0
                    for(t=0; t<data[i].tracks.length; t++) {
                        console.log(trackChecker)
                        console.log(data[i].tracks[t].used_picks.length)
                        if(data[i].tracks[t].used_picks.length >= trackChecker) {
                            trackValidatorHelp++
                        }
                        if(trackValidatorHelp === data[i].tracks.length) {
                            submitted = 'Yes'
                        }
                    }

                    tdSubmitted.innerText = submitted

                    tr.appendChild(tdFirst)
                    tr.appendChild(tdLast)
                    tr.appendChild(tdTracks)
                    tr.appendChild(tdSubmitted)
                    tr.setAttribute('colspan', largestPickLength)
                    if(eliminated === true) {
                        tr.className = 'eliminated'
                    }

                    tBody.appendChild(tr)

                    for(x=0; x<largestPickLength; x++) {
                        try {
                            console.log(data)
                            let tdTeamName = document.createElement('td')
                            tdTeamName.innerText = data[i].tracks[x].current_pick
                            tdTeamName.className = 'teamNames'
/*                             let displayLogoLink = displayTeamLogo(tdTeamName)
                            console.log(displayLogoLink) */
                            //th.innerText = i+2
                            //tr.appendChild(th)
                            tr.appendChild(tdTeamName)
                            tBody.appendChild(tr)
                        }
                        catch(err) {
                            let tdTeamName = document.createElement('td')
                            //tdTeamName.innerText = '&nbsp;'
                            tr.appendChild(tdTeamName)
                            tBody.appendChild(tr)
                        }

                    }
                }

                mainTable.appendChild(tBody)

                viewUsersTable.appendChild(mainTable)

            })
        } else {
            alert('Sorry, could not connect to database')
        }
    })
}

let actualAdminPass = 'hitheretatethisisfun'

function adminHandler() {
    let adminPassword = document.getElementById('adminPasswordInput').value.trim()
    console.log(adminPassword)
    console.log(actualAdminPass)
    if(adminPassword === actualAdminPass) {
        location.href = "../admin.html"
    } else {
        alert('Sorry, you are not invited to this party')
    }
}

//make it async
async function deleteTracksAdmin() {

    let altFormResults = document.getElementsByName('track')
    let deleteUserForm = document.getElementsByName('user')

    var checkedTracks = 0;
    for(i=0; i<altFormResults.length; i++) {
        if(altFormResults[i].checked) {
            checkedTracks++
            let deleteId = parseInt(altFormResults[i].id)
            let response = await fetch(`api/tracks/${deleteId}`, {
                method: 'delete'
            })
            if (response.ok) {
                console.log('it worked')
            }
            else {
                alert(response.statusText)
            }
        }
    }

    for(j=0; j<deleteUserForm.length; j++) {
        if(deleteUserForm[j].checked) {
            let deleteUsername = deleteUserForm[j].id
            let response = await fetch(`api/users/username/${deleteUsername}`, {
                method: 'delete'
            })
            if (response.ok) {
                console.log('it worked')
            }
            else {
                alert(response.statusText)
            }
        }
    }

    location.reload()
}


async function createTrack(user_id) {
    let available_picks = nflArray2.map(getTeamNames)
    console.log(available_picks)
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

async function checkIfPicked() {

}

async function forcePicks() {

    fetch('/api/users').then(function(response) {
        if (response.ok) {
            response.json().then(function (data) {
                let currentWeek = localStorage.getItem('thisWeek')

                console.log(data)

                for (i=0; i<data.length; i++) {

                    let submitted = 'Yes'
                    let trackChecker = parseInt(currentWeek);
                    trackChecker++

                    for(t=0; t<data[i].tracks.length; t++) {
                        console.log(data[i].tracks[t].used_picks.length)
                        console.log(data[i].username)
                        if(data[i].tracks[t].used_picks.length < trackChecker) {
                            submitted = 'No'
                        }
                        console.log(submitted)
                    }

                    if(submitted === 'No') {
                        if(data[i].tracks.length > 0) {
                            for(x=0; x < data[i].tracks.length; x++) {
                                let putTrackId = data[i].tracks[x].id
                                let randomPicker = Math.floor(Math.random() * data[i].tracks[x].available_picks.length)
                                console.log('create function')
                                let randomPick = data[i].tracks[x].available_picks[randomPicker]
                                console.log(randomPick)
                                let used_picks = data[i].tracks[x].used_picks
                                used_picks.push(randomPick)
                                let available_picks = data[i].tracks[x].available_picks
                                available_picks = available_picks.filter(item => item !== randomPick)
                                let user_id = data[i].id
                                makePick(available_picks, used_picks, randomPick, user_id, putTrackId)
                            }
                        }
                    }
                }
            })
        } else {
            alert('Could not connect')
        }
    })
}

function timeToForce() {
    let currentMoment = new Date()

    let checkMatchupDay = currentMoment.getUTCDay()

    console.log('check day for force')

    console.log(checkMatchupDay)

    //Utah is -7 or -6 UTC depending on daylight savings FYI

    if((checkMatchupDay >= 5)) {
        console.log('You Snooze You Loose')
        //forcePicks()
    }
}
//3600000
setInterval(timeToForce, 3600000)

async function displayTeamLogo() {
    fetch(`/api/teams/`).then(function(response) {
        if(response.ok) {
            response.json().then(function(data) {
                console.log(data)
                
                let logo
                let allTeams = document.getElementsByClassName('teamNames')
                for(i=0; i<allTeams.length; i++) {
                    let image = document.createElement('img')
                    image.classList = 'teamLogos rounded mx-auto d-block'
                    for(x=0; x<data.length; x++) {
                        if(allTeams[i].innerText === data[x].team_name) {
                            logo = data[x].team_logo
                            image.src = logo
                            allTeams[i].innerHTML = ""
                            allTeams[i].appendChild(image)
                        }
                    }
                }
                console.log(allTeams)
            })
        } else {
            alert('Could Not Connect')
        }
    })
}