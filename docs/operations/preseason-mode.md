# Preseason test mode

Use **Manage Week and League Season → Enable Preseason** to run normal Loser
League workflows against live preseason games. The preview identifies the
earliest unfinished preseason week and the current Tracks that will be
permanently deleted. Users and winner history are preserved.

Each preseason week is an independent Pick round. Games already underway stay
visible but are disabled. The Pick and one-time automatic-Pick deadline is the
earliest remaining kickoff. Closing a week skips later weeks that are already
complete. After the final preseason week, the application waits for the admin.

Preseason also serves as a complete buyback testing ground. A Track currently
eliminated by a Wrong Pick from any preseason week may receive the User's one
buyback decision for that preseason session. The offer and Manage Buybacks
admin actions have no kickoff deadline in preseason, including after the final
preseason week closes. An unresolved offer blocks Picks until the User declines
or shared admin resolves it. Regular-season buybacks remain Week 1 to Week 2
only and retain the Week 2 deadline.

Use **Start Regular Season** at any time during preseason. Confirmation deletes
all temporary Tracks and gameplay state, then activates regular Week 1. After a
late cutover, enrollment stays open through Week 1 and only unstarted games
accept Picks. Tracks created after the one-time automatic Pick require a User
or shared-admin Pick.

Both transitions are non-undoable and transactional. Failed schedule
validation leaves all data unchanged. Minimal aggregate admin audit entries
remain available.
