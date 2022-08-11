



    // You can already set Homescore > Awayscore to do what you want with the outcome of the game. If null than nothing, if tie than loss for both




function keepingRecords() {
    //find a way to keep track of records so they can be pulled straight from nflarray2
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
                matchup(totalTracks, trackIdArray, used_picks)
            })
        }
    })
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
        let last = weekTempArr.at(-1)

        let finalDaySeconds = new Date(last.DateUtc)

        weekSecondsArr.push(finalDaySeconds.getTime())
    }

    console.log('THIS IS WEEK DATES')
    console.log(weekSecondsArr)


    const currentDate = new Date()

    for(d=0; d<=weekSecondsArr.length; d++) {

        if (currentDate.getTime() <= weekSecondsArr[0]) {
            currentWeek = 1;
        } 

        if (currentDate.getTime() > weekSecondsArr[d] && currentDate.getTime() < (weekSecondsArr[d+1] + 28800000)) {
            currentWeek = d+2
        }
    }

    return currentWeek;

}

function matchup(totalTracks, trackIds, used_picks) {

    let containerNumber = totalTracks
    let container = document.getElementById('gameMatchups')
    let main = document.getElementById('games')
    let secondSubmitPicksBtn = document.createElement('button')
    secondSubmitPicksBtn.setAttribute('class', 'btn btn-primary testerBtn')
    secondSubmitPicksBtn.setAttribute('onclick', 'getBodyForPicks()')
    secondSubmitPicksBtn.innerText = 'Submit Picks'
    container.innerHTML = "";

    var nflScoreApi = "https://pacific-anchorage-21728.herokuapp.com/https://fixturedownload.com/feed/json/nfl-2022";
    fetch(nflScoreApi)
        .then(function(response) {
            if (response.ok) {
                    response.json().then(function(data) {
                        console.log(data)

                        let currentWeek = getWeek(data)

                        let thisWeeksGames = [];

                        for(w=0; w<data.length; w++) {
                            if (data[w].RoundNumber === currentWeek) {
                                thisWeeksGames.push(data[w])
                            }
                        }
                        
                        let thisWeeksMatchups = [];

                        for (m=0; m<thisWeeksGames.length; m++) {
                            thisWeeksMatchups.push(data[m].HomeTeam, data[m].AwayTeam)
                        }

                        let matchupsLogos = []
                        let matchupRecords = []

                        for(l=0; l<(thisWeeksMatchups.length); l++) {

                            for(x=0; x<nflArray2.length; x++) {
                                if(thisWeeksMatchups[l] === nflArray2[x].teamName) {
                                    matchupsLogos.push(nflArray2[x].teamLogo)
                                    matchupRecords.push(nflArray2[x].teamRecord)
                                }
                            }
                        }

                        let matchupRecordsFormat = []

                        let matchups = []
                        let logos = [];
                        let info = [];
                        let chooser = 0

                        for(r=0; r<thisWeeksMatchups.length; r++) {
                            
                            let wins = matchupRecords[r][0].toString()
                            let losses = matchupRecords[r][1].toString()
                            let record = `(${wins} - ${losses})`
                            matchupRecordsFormat.push(record)
                        }
                    
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
                            let secondTeamDiv = document.createElement('div')
                            let secondTeamName = document.createElement('h2')
                            let secondTeamInfo = document.createElement('h3')
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
                        container.appendChild(trackContainer)
                        main.appendChild(secondSubmitPicksBtn)
                    }
                })
            } else {
                alert('didnt work')
                console.log(nflScoreApi)
            }
        })
        .catch(function (error) {
            alert('unable to connect')
        })
}