# Winner crowns

Winner crowns summarize a User's complete League Season win history. The
stored `user_record` remains the source of truth; `crown_type` is derived by the
User model and is not a database column.

## Crown type format

The type records the number of solo and tied wins:

| Win history | `crown_type` |
| --- | --- |
| No wins | `null` |
| One solo win | `solo_1` |
| Two solo wins | `solo_2` |
| One tied win | `tied_1` |
| One solo and one tied win | `solo_1_tied_1` |

The classifier produces a deterministic type for every career combination.
The league table renders a crown only when that exact type has artwork:

| `crown_type` | Asset |
| --- | --- |
| `solo_1` | `first_time_solo_winner_crown.png` |
| `tied_1` | `first_time_tie_crown_2_people.png` |

The “2 people” asset name describes the current tied-winner artwork. The win
record stores only whether a win was tied, not the total number of co-winners.

## Adding a crown

When artwork for a new career combination is ready:

1. Add the image under `public/css/assets/crowns/`.
2. Add the exact `crown_type` and accessible description to
   `CROWN_INFO_BY_TYPE` in `public/js/utilityFunctions.js`.
3. Add a browser unit test for the mapping. The User classifier needs a new
   rule only if the crown depends on a fact not represented by solo and tied
   win counts.

`PUT /api/users/:id/add-win` records an annual win through `User.addWin()`. It
requires a four-digit integer `year`; `won_with_tie` defaults to `false` and,
when supplied, must be a Boolean. Repeated annual submissions are idempotent,
and a tied submission may upgrade—but not downgrade—that year's record.

The route's existing authorization behavior is unchanged. Server-side admin
authorization and admin controls for recording or correcting wins are required
follow-up work before exposing new controls.
