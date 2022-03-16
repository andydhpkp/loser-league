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

function matchup() {
    
    var matchups = []
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
        console.log('matchups ' + matchups + ' info ' + info + ' logos ' + logos + ' rejects ' + rejects)
    }

    let container = document.getElementById('gameMatchups')
    container.innerHTML = "";
    let logoCounter = 0;

    for (let i=0; i < 16; i++) {
        let individualMatchup = document.createElement('div');
        let vs = document.createElement('h1');
        let firstTeamDiv = document.createElement('div');
        let firstTeamName = document.createElement('h2');
        let firstTeamInfo = document.createElement('h3')
        let secondTeamDiv = document.createElement('div')
        let secondTeamName = document.createElement('h2')
        let secondTeamInfo = document.createElement('h3')
        let teamLogoFirst = document.createElement('img');
        let teamLogoSecond = document.createElement('img');
        teamLogoFirst.setAttribute('class', 'teamLogos')
        teamLogoSecond.setAttribute('class', 'teamLogos')
        teamLogoFirst.src = logos[logoCounter];
        firstTeamName.innerText = matchups[logoCounter];
        firstTeamInfo.innerText = info[logoCounter];
        firstTeamDiv.appendChild(teamLogoFirst)
        firstTeamDiv.appendChild(firstTeamName)
        firstTeamDiv.appendChild(firstTeamInfo)
        logoCounter++;
        teamLogoSecond.src = logos[logoCounter];
        secondTeamName.innerText = matchups[logoCounter];
        secondTeamInfo.innerText = info[logoCounter];
        secondTeamDiv.appendChild(teamLogoSecond)
        secondTeamDiv.appendChild(secondTeamName)
        secondTeamDiv.appendChild(secondTeamInfo)
        logoCounter++;
        vs.innerText = 'VS'
        individualMatchup.appendChild(firstTeamDiv);
        individualMatchup.appendChild(vs);
        individualMatchup.appendChild(secondTeamDiv);
        individualMatchup.setAttribute('class', 'individualMatchup')
        container.appendChild(individualMatchup)
    }
    console.log(nflArray2)
}
