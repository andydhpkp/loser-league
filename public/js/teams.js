



    // You can already set Homescore > Awayscore to do what you want with the outcome of the game. If null than nothing, if tie than loss for both


//add logic so logged in users who have made their picks go straight to league view

//add button to originally create teams
//add button to manually check matchup




//Maybe do the espn one just for Monday night? Seems easier to have the random time update
/* async function finalScores() {
    fetch(`http://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard`).then(function(response) {
        if(response.ok) {
            response.json().then(function(data) {
                console.log(data)
                for(i=0; i<data.events)
            })
        }
    })
} */

async function finalScores() {
    fetch('https://pacific-anchorage-21728.herokuapp.com/https://fixturedownload.com/feed/json/nfl-2022').then(function(response) {
        if(response.ok) {
            response.json().then(function(data) {
                console.log(data)
                let currentWeek = getWeek(data)
                let thisWeeksGames = [];
                let thisWeeksGamesCheckerMonday = [];
                let makeSureMondayGameIsDone = currentWeek - 1;
                let MondayGameFinished = true
                if(makeSureMondayGameIsDone > 0) {
                    for(c=0; c<data.length; c++) {
                        if (data[c].RoundNumber === makeSureMondayGameIsDone) {
                            thisWeeksGamesCheckerMonday.push(data[c])
                        }
                    }
                    let lastGame = thisWeeksGamesCheckerMonday[Object.keys(thisWeeksGamesCheckerMonday)[Object.keys(thisWeeksGamesCheckerMonday).length -1]]
                    console.log(lastGame)
                    if(lastGame.AwayTeamScore == null) {
                        MondayGameNotFinished = true
                    }
                }
                for(w=0; w<data.length; w++) {
                    if (data[w].RoundNumber === currentWeek) {
                        thisWeeksGames.push(data[w])
                    }
                }
                console.log(thisWeeksGames)
                let textPicks = document.getElementsByClassName('teamNames')
                console.log(textPicks)

                for(i=0; i<textPicks.length; i++) {
                    let didTheyLoseTeamName = textPicks[i].children[0].innerText
                    console.log(didTheyLoseTeamName)
                    for(x=0; x<thisWeeksGames.length; x++) {
                        let notNull = true
                        let specificMatchup = []
                        if(Object.values(thisWeeksGames[x]).indexOf(didTheyLoseTeamName) > -1) {
                            specificMatchup.push(thisWeeksGames[x].AwayTeam, thisWeeksGames[x].AwayTeamScore, thisWeeksGames[x].HomeTeam, thisWeeksGames[x].HomeTeamScore)
                            if(Object.values(specificMatchup).indexOf(null) > -1) {
                                notNull = false
                            }
                            if(notNull) {
                                if(didTheyLoseTeamName === specificMatchup[0]) {
                                    if(specificMatchup[1] < specificMatchup[3]) {
                                        //console.log(didTheyLoseTeamName + ' lost')
                                        textPicks[i].classList = 'winner teamNames'
                                    } else {
                                        //console.log(didTheyLoseTeamName + ' won')
                                        textPicks[i].classList = 'loser teamNames'
                                    }
                                }
                                if(didTheyLoseTeamName === specificMatchup[2]) {
                                    if(specificMatchup[1] > specificMatchup[3]) {
                                        //console.log(didTheyLoseTeamName + ' lost')
                                        textPicks[i].classList = 'winner teamNames'
                                    } else {
                                        //console.log(didTheyLoseTeamName + ' won')
                                        textPicks[i].classList = 'loser teamNames'
                                    }
                                }
                            }

                        }

                    }
                }

                let totalWinners = document.getElementsByClassName('winner')
                let totalLosers = document.getElementsByClassName('loser')

                if((totalWinners.length + totalLosers.length) === textPicks.length) {
                    for(l=0; l<totalLosers.length; l++) {
                        let deleteTrackId = parseInt(totalLosers[l].children[1].innerText)
                        deleteTrack(deleteTrackId)
                    }
                    //THIS IS A BANDAID UNTIL YOU SEE HOW ESPN UPDATES RECORDS BY TUESDAY
                    for(p=0; p<thisWeeksGames.length; p++){
                        if(thisWeeksGames[p].AwayTeamScore > thisWeeksGames[p].HomeTeamScore) {
                            postWinnerRecord(thisWeeksGames[p].AwayTeam, [1,0])
                            postLoserRecord(thisWeeksGames[p].HomeTeam, [0,1])
                        }
                        if(thisWeeksGames[p].HomeTeamScore > thisWeeksGames[p].AwayTeamScore) {
                            postWinnerRecord(thisWeeksGames[p].HomeTeam, [1,0])
                            postLoserRecord(thisWeeksGames[p].AwayTeam, [0,1])
                        }
                        if(thisWeeksGames[p].AwayTeamScore === thisWeeksGames[p].HomeTeamScore) {
                            postLoserRecord(thisWeeksGames[p].AwayTeam, [0,1])
                            postLoserRecord(thisWeeksGames[p].HomeTeam, [0,1])
                        }
                    }
                }
                
            })
        }
    })
}

async function postWinnerRecord(winnerId, team_record) {
    const response = await fetch(`/api/teams/team/${winnerId}`, {
        method: 'PUT',
        body: JSON.stringify({
            team_record
        }),
        headers: { 'Content-Type': 'application/json' }
    })
    if(response.ok) {
        console.log('RECORD UPDATED')
    } else {
        alert(response.statusText)
    }
}

async function postLoserRecord(loserId, team_record) {
    const response = await fetch(`/api/teams/team/${loserId}`, {
        method: 'PUT',
        body: JSON.stringify({
            team_record
        }),
        headers: { 'Content-Type': 'application/json' }
    })
    if(response.ok) {
        console.log('RECORD UPDATED')
    } else {
        alert(response.statusText)
    }
}

async function getTeam(teamId) {
    const response = await fetch(`/api/teams/${teamId}`, {})
    if(response.ok) {
        response.json().then(function(data) {
            console.log(data)
            let teamName = data.team_name
            console.log(teamName)
            return teamName
        })
    } else {
        alert(response.statusText)
    }
}

async function loseTrack(loserTeam) {

    let allTracks;
    fetch('/api/tracks').then(function(response) {
        if(response.ok) {
            response.json().then(function(data) {
                allTracks = data
                for (i=0; i<allTracks.length; i++) {
                    if(allTracks[i].current_pick === loserTeam) {
                        let deleteId = allTracks[i].id
                        deleteTrack(deleteId)
                    }
                }
            })
        }
    })
}

async function deleteTrack(deleteId) {
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

async function getAllTracks() {
    const response = await fetch(`/api/tracks`, {})
    if(response.ok) {
        response.json().then(function(data) {
            console.log(data)
            let tracksObj = data
            console.log(tracksObj)
            return tracksObj
        })
    }
}

let nflArray2 = [
    {
        teamName: "San Francisco 49ers",
        teamLogo: '../css/assets/san-francisco-49ers-logo.png',
        teamRecord: [0,0]
    },
    {
        teamName: "Arizona Cardinals",
        teamLogo: '../css/assets/arizona-cardinals-logo.png',
        teamRecord: [0,0]
    },
    {
        teamName: "Atlanta Falcons",
        teamLogo: '../css/assets/atlanta-falcons-logo.png',
        teamRecord: [0,0]
    },
    {
        teamName: "Baltimore Ravens",
        teamLogo: '../css/assets/baltimore-ravens-logo.png',
        teamRecord: [0,0]
    },
    {
        teamName: "Buffalo Bills",
        teamLogo: '../css/assets/buffalo-bills-logo.png',
        teamRecord: [0,0]
    },
    {
        teamName: "Philadelphia Eagles",
        teamLogo: '../css/assets/philadelphia-eagles-logo.png',
        teamRecord: [0,0]
    },
    {
        teamName: "Carolina Panthers",
        teamLogo: '../css/assets/carolina-panthers-logo.png',
        teamRecord: [0,0]
    },
    {
        teamName: "Chicago Bears",
        teamLogo: '../css/assets/chicago-bears-logo.png',
        teamRecord: [0,0]
    },
    {
        teamName: "Cincinnati Bengals",
        teamLogo: '../css/assets/cincinnati-bengals-logo.png',
        teamRecord: [0,0]
    },
    {
        teamName: "Cleveland Browns",
        teamLogo: '../css/assets/cleveland-browns-logo.png',
        teamRecord: [0,0]
    },
    {
        teamName: "Dallas Cowboys",
        teamLogo: '../css/assets/dallas-cowboys-logo.png',
        teamRecord: [0,0]
    },
    {
        teamName: "Denver Broncos",
        teamLogo: '../css/assets/denver-broncos-logo.png',
        teamRecord: [0,0]
    },
    {
        teamName: "Detroit Lions",
        teamLogo: '../css/assets/detroit-lions-logo.png',
        teamRecord: [0,0]
    },
    {
        teamName: "Green Bay Packers",
        teamLogo: '../css/assets/green-bay-packers-logo.png',
        teamRecord: [0,0]
    },
    {
        teamName: "Houston Texans",
        teamLogo: '../css/assets/houston-texans-logo.png',
        teamRecord: [0,0]
    },
    {
        teamName: "Indianapolis Colts",
        teamLogo: '../css/assets/indianapolis-colts-logo.png',
        teamRecord: [0,0]
    },
    {
        teamName: "Jacksonville Jaguars",
        teamLogo: '../css/assets/jacksonville-jaguars-logo.png',
        teamRecord: [0,0]
    },
    {
        teamName: "Kansas City Chiefs",
        teamLogo: '../css/assets/kansas-city-chiefs-logo.png',
        teamRecord: [0,0]
    },
    {
        teamName: "Los Angeles Chargers",
        teamLogo: '../css/assets/los-angeles-chargers-logo.png',
        teamRecord: [0,0]
    },
    {
        teamName: "Miami Dolphins",
        teamLogo: '../css/assets/miami-dolphins-logo.png',
        teamRecord: [0,0]
    },
    {
        teamName: "Minnesota Vikings",
        teamLogo: '../css/assets/minnesota-vikings-logo.png',
        teamRecord: [0,0]
    },
    {
        teamName: "New England Patriots",
        teamLogo: '../css/assets/new-england-patriots-logo.png',
        teamRecord: [0,0]
    },
    {
        teamName: "New Orleans Saints",
        teamLogo: '../css/assets/new-orleans-saints-logo.png',
        teamRecord: [0,0]
    },
    {
        teamName: "New York Giants",
        teamLogo: '../css/assets/new-york-giants-logo.png',
        teamRecord: [0,0]
    },
    {
        teamName: "New York Jets",
        teamLogo: '../css/assets/new-york-jets-logo.png',
        teamRecord: [0,0]
    },
    {
        teamName: "Las Vegas Raiders",
        teamLogo: '../css/assets/oakland-raiders-logo.png',
        teamRecord: [0,0]
    },
    {
        teamName: "Pittsburgh Steelers",
        teamLogo: '../css/assets/pittsburgh-steelers-logo.png',
        teamRecord: [0,0]
    },
    {
        teamName: "Los Angeles Rams",
        teamLogo: '../css/assets/Rams-icon.png',
        teamRecord: [0,0]
    },
    {
        teamName: "Seattle Seahawks",
        teamLogo: '../css/assets/seattle-seahawks-logo.png',
        teamRecord: [0,0]
    },
    {
        teamName: "Tampa Bay Buccaneers",
        teamLogo: '../css/assets/tampa-bay-buccaneers-logo.png',
        teamRecord: [0,0]
    },
    {
        teamName: "Tennessee Titans",
        teamLogo: '../css/assets/tennessee-titans-logo.png',
        teamRecord: [0,0]
    },
    {
        teamName: "Washington Commanders",
        teamLogo: '../css/assets/Washington-Commanders-icon.png',
        teamRecord: [0,0]
    },
]

function getTrackNumber() {

    let username = localStorage.getItem('loggedInUser')
    let currentWeek = localStorage.getItem('thisWeek')
    fetch(`/api/users/username/${username}`).then(function(response) {
        if (response.ok) {
            response.json().then(function(data) {
                let totalTracks = data.tracks.length
                let trackIdArray = []
                for (i=0; i<totalTracks; i++) {
                    trackIdArray.push(data.tracks[i].id)
                }
                let used_picks = []
                console.log(data)
                for (let i = 0; i < totalTracks; i++) {
                    //let tempUsed_picks = []
                    used_picks.push(data.tracks[i].used_picks)
                }
                console.log(used_picks)
                currentWeek++
                let picksCompleteChecker = false
                console.log(trackIdArray)
                if(trackIdArray.length > 0) {
                    console.log(currentWeek)
                    console.log(data.tracks)
                    let picksCompleteHelper = 0
                    for(r=0; r<data.tracks.length; r++) {
                        console.log(data)
                        if(data.tracks[r].used_picks.length >= currentWeek) {
                            picksCompleteHelper++
                        } 
                    }
                    if(picksCompleteHelper === data.tracks.length) {
                        picksCompleteChecker = true
                    }
                }
                if(picksCompleteChecker) {
                    //location.href = "../league-page.html"
                }
                
                matchup(totalTracks, trackIdArray, used_picks)
                if(trackIdArray.length === 0) {
                    let sectionHelp = document.getElementById('games')
                    console.log(sectionHelp)
                    let nothingDiv = document.createElement('div')
                    let nothingMessageH1 = document.createElement('h1')
                    nothingMessageH1.innerHTML = 'It looks like you do not have any tracks... try texting Tate'
                    nothingDiv.appendChild(nothingMessageH1)
                    sectionHelp.appendChild(nothingDiv)
                }
            })
        }
    })
}

function goToLeaguePage() {
    location.href = "../league-page.html"
}

function getWeek(data) {

    let currentWeek;

    let weekSecondsArr = []
    //to figure out actual week number
    for(k=1; k<=18; k++) {

        let weekTempArr = []
        for(j=0; j<data.length; j++) {
            if (data[j].RoundNumber === k) {
                weekTempArr.push(data[j])
            }
        }
        let last = weekTempArr[weekTempArr.length - 1]
        let testDate = last.DateUtc
        let newTestDate = testDate.replace(/-/g, "/")
        let splitDate = newTestDate.split(" ")
        let splitWeekDayArr = splitDate[0].split("/")
        let splitDateArr = splitDate[1].split(":")
        let noZ = splitDateArr[2].split("")
        let hourUTC = parseInt(splitDateArr[0])
        let year = parseInt(splitWeekDayArr[0])
        let month = parseInt(splitWeekDayArr[1])
        let weekDay = parseInt(splitWeekDayArr[2])
        if(month >= 3 || ((month < 11) && (weekDay < 6)) || month <= 10) {
            if(hourUTC < 6) {
                hourUTC = hourUTC + 18
                
                if(weekDay === 1) {
                    
                    if(month === 2 || month === 4 || month === 6 || month === 8 || month === 9 || month === 11 || month === 1) {
                        if(month === 1) {
                            month = 12
                            
                            year = year - 1
                        } else {
                            month = month - 1
                        }
                        weekDay = 31
                    }
                    if(month === 5 || month === 7 || month === 10 || month === 12) {
                        month = month - 1
                        weekDay = 30
                    }
                } else {
                    weekDay = weekDay - 1
                }
            } else {
                hourUTC = hourUTC - 6
            }
        } else {
            if(hourUTC < 7) {
                hourUTC = hourUTC + 17
                
                if(weekDay === 1) {
                    
                    if(month === 2 || month === 4 || month === 6 || month === 8 || month === 9 || month === 11 || month === 1) {
                        if(month === 1) {
                            month = 12
                            
                            year = year - 1
                        } else {
                            month = month - 1
                        }
                        weekDay = 31
                    }
                    if(month === 5 || month === 7 || month === 10 || month === 12) {
                        month = month - 1
                        weekDay = 30
                    }
                } else {
                    weekDay = weekDay - 1
                }
            } else {
                hourUTC = hourUTC - 7
            }
        }
        
        
        let dateString = `${year}/${month}/${weekDay} ${hourUTC.toString()}:${splitDateArr[1]}:${noZ[0]}${noZ[1]}`

        let finalDate = new Date(dateString)

        let finalDaySeconds = new Date(finalDate)

        weekSecondsArr.push(finalDaySeconds.getTime())
    }

    console.log('THIS IS WEEK DATES')
    console.log(weekSecondsArr)


    const currentDate = new Date()

    for(d=0; d<=weekSecondsArr.length; d++) {

        if (currentDate.getTime() <= weekSecondsArr[0]) {
            currentWeek = 1;
        } 

        if (currentDate.getTime() > (weekSecondsArr[d] + 18000000) && currentDate.getTime() < (weekSecondsArr[d+1])) {
            currentWeek = d+2
        }
    }

    localStorage.setItem('thisWeek', 2)

    return currentWeek;
}


function getEndOfGameTime() {
    let currentMoment = new Date()

    let checkMatchupDay = currentMoment.getUTCDay()

    let checkMatchupHour = currentMoment.getUTCHours()

    console.log('check day, then hour')

    console.log(checkMatchupDay)
    console.log(checkMatchupHour)

    //Utah is -7 or -6 UTC depending on daylight savings FYI

    if((checkMatchupDay === 2) && (checkMatchupHour >= 7)) {
        console.log('Checking Mathcup!!')
        //matchupResult()
    }
}
//3600000
setInterval(getEndOfGameTime, 3600000)

async function espnFetchScoreboard() {
    fetch('https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard').then(function(response) {
        if(response.ok) {
            response.json().then(function(data) {
                console.log(data)
            })
        }
    })
}

async function espnFetchTeam() {
    fetch('https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams').then(function(response) {
        if(response.ok) {
            response.json().then(function(data) {
                console.log(data)
            })
        }
    })
}


const matchup = async (totalTracks, trackIds, used_picks) => {
    //const nflObj = await nflArrayFunction()
    let nflObj;
    fetch('https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams').then(function(response) {
        if(response.ok) {
            response.json().then(function(data) {
                nflObj = data
            })
        }
    })

//function matchup(totalTracks, trackIds, used_picks) {

    let containerNumber = totalTracks
    let container = document.getElementById('gameMatchups')
    let main = document.getElementById('games')
    let secondSubmitPicksBtn = document.createElement('button')
    let firstSubmitPicksBtn = document.createElement('button')
    let getLoading = document.getElementById('loading')
    firstSubmitPicksBtn.setAttribute('class', 'btn btn-primary testerBtn')
    firstSubmitPicksBtn.setAttribute('onclick', 'getBodyForPicks()')
    firstSubmitPicksBtn.innerText = 'Submit Picks'
    secondSubmitPicksBtn.setAttribute('class', 'btn btn-primary testerBtn')
    secondSubmitPicksBtn.setAttribute('onclick', 'getBodyForPicks()')
    secondSubmitPicksBtn.innerText = 'Submit Picks'
    let secondLeaguePageBtn = document.createElement('button')
    let firstLeaguePageBtn = document.createElement('button')
    firstLeaguePageBtn.setAttribute('class', 'btn btn-primary testerBtn')
    firstLeaguePageBtn.setAttribute('onclick', 'goToLeaguePage()')
    firstLeaguePageBtn.innerText = 'View The League'
    secondLeaguePageBtn.setAttribute('class', 'btn btn-primary testerBtn')
    secondLeaguePageBtn.setAttribute('onclick', 'goToLeaguePage()')
    secondLeaguePageBtn.innerText = 'View The League'
    container.innerHTML = "";
    //let nflObj = nflArrayFunction()

    var nflScoreApi = "https://pacific-anchorage-21728.herokuapp.com/https://fixturedownload.com/feed/json/nfl-2022";
    fetch(nflScoreApi)
        .then(function(response) {
            if (response.ok) {
                    response.json().then(function(data) {
                        console.log(data)

                        let currentWeek = getWeek(data)

                        let headerHelp = document.getElementsByTagName('header')[0]
                        console.log(headerHelp)
                        let currentWeekDiv = document.createElement('div')
                        let currentWeekH1 = document.createElement('h1')
                        currentWeekH1.innerHTML = `Week ${currentWeek}`
                        currentWeekDiv.appendChild(currentWeekH1)
                        headerHelp.appendChild(currentWeekDiv)

                        let thisWeeksGames = [];

                        for(w=0; w<data.length; w++) {
                            if (data[w].RoundNumber === currentWeek) {
                                thisWeeksGames.push(data[w])
                            }
                        }

                        console.log(thisWeeksGames)
                        
                        let thisWeeksMatchups = [];

                        for (m=0; m<thisWeeksGames.length; m++) {
                            thisWeeksMatchups.push(thisWeeksGames[m].HomeTeam, thisWeeksGames[m].AwayTeam)
                        }

                        let matchupsLogos = []
                        let matchupRecords = []

                        for(l=0; l<(thisWeeksMatchups.length); l++) {

                            //console.log(nflObj)

                            for(x=0; x<nflObj.sports[0].leagues[0].teams.length; x++) {
                                if(thisWeeksMatchups[l] === nflObj.sports[0].leagues[0].teams[x].team.displayName) {
                                    matchupsLogos.push(nflObj.sports[0].leagues[0].teams[x].team.logos[0].href)
                                    matchupRecords.push([0,0])
                                }
                            }
                        }

                        let matchupRecordsFormat = []

                        let matchups = [];
                        let logos = [];
                        let info = [];
                        let chooser = 0

                        for(r=0; r<thisWeeksMatchups.length; r++) {
                            
                            let wins = matchupRecords[r][0].toString()
                            let losses = matchupRecords[r][1].toString()
                            let record = `(${wins} - ${losses})`
                            matchupRecordsFormat.push(record)
                        }

                        console.log(matchups)
                    
                        while(matchups.length < (thisWeeksMatchups.length)) {
                    
                            let firstTeam = thisWeeksMatchups[chooser];
                            let firstTeamLogo = matchupsLogos[chooser];
                            let firstTeamRecord = matchupRecordsFormat[chooser];

                            chooser++;

                            let secondTeam = thisWeeksMatchups[chooser];
                            let secondTeamLogo = matchupsLogos[chooser];
                            let secondTeamRecord = matchupRecordsFormat[chooser];

                            matchups.push(firstTeam);
                            matchups.push(secondTeam);
                            info.push(firstTeamRecord);
                            info.push(secondTeamRecord)
                            logos.push(firstTeamLogo);
                            logos.push(secondTeamLogo)

                            chooser++;
                        }

                        console.log(matchups)
                
                        let extraCountIdHelp = 0;
                
                        for (i = 0; i < containerNumber; i++) {
                    
                        let logoCounter = 0;
                        let trackContainer = document.createElement('div');
                        
                    
                        for (let l=0; l < 16; l++) {
                            
                            let individualMatchup = document.createElement('div');
                            let firstAnchor = document.createElement('a')
                            trackContainer.setAttribute('class', `trackContainer`);
                
                
                            let secondAnchor = document.createElement('a')
                            let vs = document.createElement('h1');
                            let firstTeamDiv = document.createElement('div');
                            let firstTeamName = document.createElement('h2');
                            let firstTeamInfo = document.createElement('h3')
                            firstTeamInfo.className = 'record'
                            let secondTeamDiv = document.createElement('div')
                            let secondTeamName = document.createElement('h2')
                            let secondTeamInfo = document.createElement('h3')
                            secondTeamInfo.className = 'record'
                            let teamLogoFirst = document.createElement('img');
                            let teamLogoSecond = document.createElement('img');
                            firstTeamDiv.setAttribute('id', `${extraCountIdHelp},${matchups[logoCounter]}`)
                            firstTeamDiv.setAttribute('onclick', 'registerClick(this.id)')
                            teamLogoFirst.setAttribute('class', 'teamLogos')
                            teamLogoSecond.setAttribute('class', 'teamLogos')
                            teamLogoFirst.src = logos[logoCounter];
                            firstTeamName.innerText = matchups[logoCounter];
                            firstTeamInfo.innerText = info[logoCounter];
                            //firstAnchor.setAttribute('id', matchups[logoCounter])
                            firstAnchor.appendChild(teamLogoFirst)
                            firstAnchor.appendChild(firstTeamName)
                            firstAnchor.appendChild(firstTeamInfo)
                            firstTeamDiv.appendChild(firstAnchor)
                            logoCounter++;
                            teamLogoSecond.src = logos[logoCounter];
                            secondTeamName.innerText = matchups[logoCounter];
                            secondTeamInfo.innerText = info[logoCounter];
                
                            for(j=0; j<used_picks[i].length; j++) {
                                if(used_picks[i][j] === firstTeamName.innerText) {
                                    firstTeamDiv.classList.toggle('used_pick')
                                }
                                if(used_picks[i][j] === secondTeamName.innerText) {
                                    secondTeamDiv.classList.toggle('used_pick')
                                } 
                            }
                
                            secondTeamDiv.setAttribute('id', `${extraCountIdHelp},${matchups[logoCounter]}`)
                            secondTeamDiv.setAttribute('onclick', 'registerClick(this.id)')
                            //secondAnchor.setAttribute('id', matchups[logoCounter])
                            secondAnchor.appendChild(teamLogoSecond)
                            secondAnchor.appendChild(secondTeamName)
                            secondAnchor.appendChild(secondTeamInfo)
                            secondTeamDiv.appendChild(secondAnchor)
                            logoCounter++;
                            vs.innerText = 'VS'
                            individualMatchup.appendChild(firstTeamDiv);
                            individualMatchup.appendChild(vs);
                            individualMatchup.appendChild(secondTeamDiv);
                            individualMatchup.setAttribute('class', 'individualMatchup')
                            trackContainer.appendChild(individualMatchup)
                        }
                        extraCountIdHelp++;
                        trackContainer.setAttribute('id', trackIds[i]);
                        main.prepend(firstSubmitPicksBtn)
                        main.prepend(firstLeaguePageBtn)
                        container.appendChild(trackContainer)
                        main.appendChild(secondSubmitPicksBtn)
                        main.appendChild(secondLeaguePageBtn)

                        getLoading.remove()

                        getRecords()
                    }
                })
            } else {
                alert('didnt work')
                console.log(nflScoreApi)
            }
        })
        .catch(function (error) {
            console.log('unable to connect')
        })
}

async function getRecords() {
    fetch('https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard').then(function(response) {
        if(response.ok) {
            response.json().then(function(data) {
                let recordHTML = document.getElementsByClassName('record')

                for(i=0; i<recordHTML.length; i++) {
                    for(x=0; x<data.events.length; x++) {
                        for(r=0; r<2; r++) {
                            if(data.events[x].competitions[0].competitors[r].team.displayName === recordHTML[i].previousSibling.innerText) {
                                let record = data.events[x].competitions[0].competitors[r].records[0].summary
                                let splitRecord = record.split('')
                                let finalRecord;
                                if(splitRecord.length > 3) {
                                    finalRecord = `(${splitRecord[0]} - ${splitRecord[2]} - ${splitRecord[4]})`
                                } else {
                                    finalRecord = `(${splitRecord[0]} - ${splitRecord[2]})`
                                }
                                recordHTML[i].innerText = finalRecord
                            }
                        }
                    }
                }

            })
        }
    })
}


async function createTeams() {
    
    for(i=0; i<nflArray2.length; i++) {

        let team_name = nflArray2[i].teamName
        let team_logo = nflArray2[i].teamLogo
        let team_record = nflArray2[i].teamRecord

        const response = await fetch('/api/teams', {
            method: 'post',
            body: JSON.stringify({
                team_name,
                team_logo,
                team_record
            }),
            headers: { 'Content-Type': 'application/json' }
        });
        if (response.ok) {
            console.log('CREATED TEAM')
            console.log(response)
        } else {
            alert(response.statusText)
        }
    }
}

async function doTeamsExist() {
    fetch('/api/teams').then(function(response) {
        if (response.ok) {
            response.json().then(function(data) {
                console.log(data)
                
                if(data.length < 32 || data.length > 32) {
                    console.log('DELETING ALL TEAMS AND RECREATING THEM')
                    deleteAllTeams()
                    createTeams()
                }
            })
        } else {
            alert('did not work')
        }
    })
}

async function deleteAllTeams() {
    let response = await fetch('/api/teams', {
        method: 'delete'
    })
    if (response.ok) {
        console.log('it worked')
    }
    else {
        console.log('It has been working')
    }
}
