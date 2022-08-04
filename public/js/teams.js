

function getMatchups() {

    var nflScoreApi = "https://pacific-anchorage-21728.herokuapp.com/https://fixturedownload.com/feed/json/nfl-2022";
    fetch(nflScoreApi)
        .then(function(response) {
            if (response.ok) {
                response.json().then(function(data) {
                    console.log(data)

                    //AFTER A WEEK SEE IF THIS TURNS TO AN ARRAY

                    let weekNumber = data
                    console.log('========')
                    console.log(weekNumber)
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






let nflArray2 = [
    {
        teamName: "49ers",
        teamLogo: '../css/assets/san-francisco-49ers-logo.png',
        teamRecord: '1-1'
    },
    {
        teamName: "Cardinals",
        teamLogo: '../css/assets/arizona-cardinals-logo.png',
        teamRecord: '1-1'
    },
    {
        teamName: "Falcons",
        teamLogo: '../css/assets/atlanta-falcons-logo.png',
        teamRecord: '1-1'
    },
    {
        teamName: "Ravens",
        teamLogo: '../css/assets/baltimore-ravens-logo.png',
        teamRecord: '1-1'
    },
    {
        teamName: "Bills",
        teamLogo: '../css/assets/buffalo-bills-logo.png',
        teamRecord: '1-1'
    },
    {
        teamName: "Eagles",
        teamLogo: '../css/assets/philadelphia-eagles-logo.png',
        teamRecord: '1-1'
    },
    {
        teamName: "Panthers",
        teamLogo: '../css/assets/carolina-panthers-logo.png',
        teamRecord: '1-1'
    },
    {
        teamName: "Bears",
        teamLogo: '../css/assets/chicago-bears-logo.png',
        teamRecord: '1-1'
    },
    {
        teamName: "Bengals",
        teamLogo: '../css/assets/cincinnati-bengals-logo.png',
        teamRecord: '1-1'
    },
    {
        teamName: "Browns",
        teamLogo: '../css/assets/cleveland-browns-logo.png',
        teamRecord: '1-1'
    },
    {
        teamName: "Cowboys",
        teamLogo: '../css/assets/dallas-cowboys-logo.png',
        teamRecord: '1-1'
    },
    {
        teamName: "Broncos",
        teamLogo: '../css/assets/denver-broncos-logo.png',
        teamRecord: '1-1'
    },
    {
        teamName: "Lions",
        teamLogo: '../css/assets/detroit-lions-logo.png',
        teamRecord: '1-1'
    },
    {
        teamName: "Packers",
        teamLogo: '../css/assets/green-bay-packers-logo.png',
        teamRecord: '1-1'
    },
    {
        teamName: "Texans",
        teamLogo: '../css/assets/houston-texans-logo.png',
        teamRecord: '1-1'
    },
    {
        teamName: "Colts",
        teamLogo: '../css/assets/indianapolis-colts-logo.png',
        teamRecord: '1-1'
    },
    {
        teamName: "Jaguars",
        teamLogo: '../css/assets/jacksonville-jaguars-logo.png',
        teamRecord: '1-1'
    },
    {
        teamName: "Chiefs",
        teamLogo: '../css/assets/kansas-city-chiefs-logo.png',
        teamRecord: '1-1'
    },
    {
        teamName: "Chargers",
        teamLogo: '../css/assets/los-angeles-chargers-logo.png',
        teamRecord: '1-1'
    },
    {
        teamName: "Dolphins",
        teamLogo: '../css/assets/miami-dolphins-logo.png',
        teamRecord: '1-1'
    },
    {
        teamName: "Vikings",
        teamLogo: '../css/assets/minnesota-vikings-logo.png',
        teamRecord: '1-1'
    },
    {
        teamName: "Patriots",
        teamLogo: '../css/assets/new-england-patriots-logo.png',
        teamRecord: '1-1'
    },
    {
        teamName: "Saints",
        teamLogo: '../css/assets/new-orleans-saints-logo.png',
        teamRecord: '1-1'
    },
    {
        teamName: "Giants",
        teamLogo: '../css/assets/new-york-giants-logo.png',
        teamRecord: '1-1'
    },
    {
        teamName: "Jets",
        teamLogo: '../css/assets/new-york-jets-logo.png',
        teamRecord: '1-1'
    },
    {
        teamName: "Raiders",
        teamLogo: '../css/assets/oakland-raiders-logo.png',
        teamRecord: '1-1'
    },
    {
        teamName: "Steelers",
        teamLogo: '../css/assets/pittsburgh-steelers-logo.png',
        teamRecord: '1-1'
    },
    {
        teamName: "Rams",
        teamLogo: '../css/assets/Rams-icon.png',
        teamRecord: '1-1'
    },
    {
        teamName: "Seahawks",
        teamLogo: '../css/assets/seattle-seahawks-logo.png',
        teamRecord: '1-1'
    },
    {
        teamName: "Buccaneers",
        teamLogo: '../css/assets/tampa-bay-buccaneers-logo.png',
        teamRecord: '1-1'
    },
    {
        teamName: "Titans",
        teamLogo: '../css/assets/tennessee-titans-logo.png',
        teamRecord: '1-1'
    },
    {
        teamName: "Commanders",
        teamLogo: '../css/assets/Washington-Commanders-icon.png',
        teamRecord: '1-1'
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

function matchup(totalTracks, trackIds, used_picks) {

    let containerNumber = totalTracks
    let container = document.getElementById('gameMatchups')
    let main = document.getElementById('games')
    let secondSubmitPicksBtn = document.createElement('button')
    secondSubmitPicksBtn.setAttribute('class', 'btn btn-primary testerBtn')
    secondSubmitPicksBtn.setAttribute('onclick', 'getBodyForPicks()')
    secondSubmitPicksBtn.innerText = 'Submit Picks'
    container.innerHTML = "";

        let matchups = []
        let rejects = [];
        let logos = [];
        let info = [];
    
        while(matchups.length < 32) {
            let chooser = Math.floor(Math.random() * nflArray2.length)
            let chooser2 = Math.floor(Math.random() * nflArray2.length)
    
            if(rejects.includes(chooser) || rejects.includes(chooser2) || chooser === chooser2) {
    
            } else {
                let firstTeam = nflArray2[chooser].teamName;
                let firstTeamLogo = nflArray2[chooser].teamLogo;
                let firstTeamRecord = nflArray2[chooser].teamRecord;
                let secondTeam = nflArray2[chooser2].teamName;
                let secondTeamLogo = nflArray2[chooser2].teamLogo;
                let secondTeamRecord = nflArray2[chooser2].teamRecord;
                matchups.push(firstTeam);
                matchups.push(secondTeam);
                info.push(firstTeamRecord);
                info.push(secondTeamRecord)
                logos.push(firstTeamLogo);
                logos.push(secondTeamLogo)
                rejects.push(chooser)
                rejects.push(chooser2)
            }
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
}