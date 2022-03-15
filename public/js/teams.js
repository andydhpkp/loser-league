let nflArray2 = [
    {
        teamName: "49ers",
        teamLogo: '../css/assets/san-francisco-49ers-logo.png'
    },
    {
        teamName: "Cardinals",
        teamLogo: '../css/assets/arizona-cardinals-logo.png'
    },
    {
        teamName: "Falcons",
        teamLogo: '../css/assets/atlanta-falcons-logo.png'
    },
    {
        teamName: "Ravens",
        teamLogo: '../css/assets/baltimore-ravens-logo.png'
    },
    {
        teamName: "Bills",
        teamLogo: '../css/assets/buffalo-bills-logo.png'
    },
    {
        teamName: "Eagles",
        teamLogo: '../css/assets/philadelphia-eagles-logo.png'
    },
    {
        teamName: "Panthers",
        teamLogo: '../css/assets/carolina-panthers-logo.png'
    },
    {
        teamName: "Bears",
        teamLogo: '../css/assets/chicago-bears-logo.png'
    },
    {
        teamName: "Bengals",
        teamLogo: '../css/assets/cincinnati-bengals-logo.png'
    },
    {
        teamName: "Browns",
        teamLogo: '../css/assets/cleveland-browns-logo.png'
    },
    {
        teamName: "Cowboys",
        teamLogo: '../css/assets/dallas-cowboys-logo.png'
    },
    {
        teamName: "Broncos",
        teamLogo: '../css/assets/denver-broncos-logo.png'
    },
    {
        teamName: "Lions",
        teamLogo: '../css/assets/detroit-lions-logo.png'
    },
    {
        teamName: "Packers",
        teamLogo: '../css/assets/green-bay-packers-logo.png'
    },
    {
        teamName: "Texans",
        teamLogo: '../css/assets/houston-texans-logo.png'
    },
    {
        teamName: "Colts",
        teamLogo: '../css/assets/indianapolis-colts-logo.png'
    },
    {
        teamName: "Jaguars",
        teamLogo: '../css/assets/jacksonville-jaguars-logo.png'
    },
    {
        teamName: "Chiefs",
        teamLogo: '../css/assets/kansas-city-chiefs-logo.png'
    },
    {
        teamName: "Chargers",
        teamLogo: '../css/assets/los-angeles-chargers-logo.png'
    },
    {
        teamName: "Dolphins",
        teamLogo: '../css/assets/miami-dolphins-logo.png'
    },
    {
        teamName: "Vikings",
        teamLogo: '../css/assets/minnesota-vikings-logo.png'
    },
    {
        teamName: "Patriots",
        teamLogo: '../css/assets/new-england-patriots-logo.png'
    },
    {
        teamName: "Saints",
        teamLogo: '../css/assets/new-orleans-saints-logo.png'
    },
    {
        teamName: "Giants",
        teamLogo: '../css/assets/new-york-giants-logo.png'
    },
    {
        teamName: "Jets",
        teamLogo: '../css/assets/new-york-jets-logo.png'
    },
    {
        teamName: "Raiders",
        teamLogo: '../css/assets/oakland-raiders-logo.png'
    },
    {
        teamName: "Steelers",
        teamLogo: '../css/assets/pittsburgh-steelers-logo.png'
    },
    {
        teamName: "Rams",
        teamLogo: '../css/assets/Rams-icon.png'
    },
    {
        teamName: "Seahawks",
        teamLogo: '../css/assets/seattle-seahawks-logo.png'
    },
    {
        teamName: "Buccaneers",
        teamLogo: '../css/assets/tampa-bay-buccaneers-logo.png'
    },
    {
        teamName: "Titans",
        teamLogo: '../css/assets/tennessee-titans-logo.png'
    },
    {
        teamName: "Commanders",
        teamLogo: '../css/assets/Washington-Commanders-icon.png'
    },
]

function matchup() {
    
    var matchups = []
    let rejects = [];
    let logos = [];

    while(matchups.length < 16) {
        let chooser = Math.floor(Math.random() * nflArray2.length)
        let chooser2 = Math.floor(Math.random() * nflArray2.length)

        if(rejects.includes(chooser) || rejects.includes(chooser2) || chooser === chooser2) {

        } else {
            let firstTeam = nflArray2[chooser].teamName;
            let firstTeamLogo = nflArray2[chooser].teamLogo;
            let secondTeam = nflArray2[chooser2].teamName;
            let secondTeamLogo = nflArray2[chooser2].teamLogo;
            matchups.push(`${firstTeam} vs. ${secondTeam}`);
            logos.push(firstTeamLogo);
            logos.push(secondTeamLogo)
            rejects.push(chooser)
            rejects.push(chooser2)
        }
    }

    let container = document.getElementById('gameMatchups')
    container.innerHTML = "";
    let logoCounter = 0;

    for (let i=0; i < matchups.length; i++) {
        let individualMatchup = document.createElement('div');
        let teamLogoFirst = document.createElement('img');
        let teamLogoSecond = document.createElement('img');
        teamLogoFirst.setAttribute('class', 'teamLogos')
        teamLogoSecond.setAttribute('class', 'teamLogos')
        teamLogoFirst.src = logos[logoCounter];
        logoCounter++;
        teamLogoSecond.src = logos[logoCounter];
        logoCounter++;
        individualMatchup.innerText = matchups[i];
        individualMatchup.prepend(teamLogoFirst);
        individualMatchup.appendChild(teamLogoSecond);
        individualMatchup.setAttribute('class', 'individualMatchup')
        container.appendChild(individualMatchup)
    }
    console.log(nflArray2)
}
