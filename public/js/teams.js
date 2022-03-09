let nflArray = [
    "49ers",
    "Bears",
    "Bengals",
    "Bills",
    "Broncos",
    "Browns",
    "Cardinals",
    "Chargers",
    "Chiefs",
    "Colts",
    "Cowboys",
    "Dolphins",
    "Eagles",
    "Falcons",
    "Giants",
    "Jaguars",
    "Jets",
    "Lions",
    "Packers",
    "Panthers",
    "Patriots",
    "Raiders",
    "Rams",
    "Ravens",
    "Redskins",
    "Saints",
    "Seahawks",
    "Steelers",
    "Buccaneers",
    "Texans",
    "Titans",
    "Vikings"]

function matchup() {
    
    var matchups = []
    let rejects = [];

    while(matchups.length < 16) {
        let chooser = Math.floor(Math.random() * nflArray.length)
        let chooser2 = Math.floor(Math.random() * nflArray.length)

        if(rejects.includes(chooser) || rejects.includes(chooser2)) {
            console.log(rejects)
        } else {
            let firstTeam = nflArray[chooser];
            let secondTeam = nflArray[chooser2];
            matchups.push(`${firstTeam} vs. ${secondTeam}`);
            rejects.push(chooser)
            rejects.push(chooser2)
        }
    }

    let container = document.getElementById('gameMatchups')
    container.innerHTML = "";

    for (let i=0; i < matchups.length; i++) {
        let individualMatchup = document.createElement('div');
        individualMatchup.innerText = matchups[i];
        container.appendChild(individualMatchup)
    }
}