# Loser League

Loser League is an NFL elimination-pick game in which Users manage one or more
independent Tracks through a League Season.

## Language

**User**:
A person with a login identity who participates in Loser League and owns one
or more Tracks. The product does not distinguish a player from a user account.
_Avoid_: Player, account holder

**Track**:
One independent entry owned by a User for a League Season. A Track has its
own pick history and elimination state, so eliminating one Track does not
eliminate the User's other Tracks.
_Avoid_: League, entry, team

**League Season**:
The single annual Loser League competition aligned with that year's NFL
season. It contains all participating Users and their Tracks.
_Avoid_: NFL Season, league

**Wrong Pick**:
A Pick whose selected NFL Team does not lose its scheduled game. A tied game
also makes the Pick a Wrong Pick.
_Avoid_: Bad pick, failed pick

**Pick**:
A Track's selection of one NFL Team for one weekly round, predicting that the
team will lose. A Track cannot select the same NFL Team more than once in a
League Season, while different Tracks owned by the same User choose
independently.
_Avoid_: Bet, vote

**Eliminated Track**:
A Track that has recorded a Wrong Pick and no longer continues in the current
League Season.
_Avoid_: Dead Track, eliminated User
