# Agent notes

Update this file when the handshake, notices, Firestore rules for those
collections, profile actions, or the deploy path change. The diagram people read is
[docs/handshake.md](docs/handshake.md). This file is the short version so the
next session does not revive a stale assumption.

## Handshake

Three steps, pair id `{from}_{to}`:

1. `tails/{A}_{B}` — A swims after B.
2. `glints/{B}_{A}` — B shines one closed field. Live for 7 days (`expiresAt`)
   and only while A still trails B. Root may list every glint, so the root
   screen and the hourly tick read scales in one query.
3. `schoolRequests/{A}_{B}` plus `seals/{A}_{B}` — A pledges one closed field.
   B reads the seal only after accept. Accept writes both
   `schools/{uid}/members/{other}` with the same `since`.

A pul broadcast writes `callShows/{uid}` with one closed field. Others can read
it only until `endsAt`. Replying writes the request and seal without a tail or
a pairwise glint, and copies `shownField` / `shownText` from that live show.
Accept also writes `glints/{broadcaster}_{replier}` from the copy. The profile
handshake is unchanged.

Step away (`social.distance`) is not a member action. It untails, dismisses
their tail, withdraws the scale this side shone, then writes `signals` kind
`distanced` to the other uid. It does not remove a request or a seal.

`passJoin` writes `joinPassed`. Nothing in the UI calls it. Notices fold
`joinPassed` into the `requestWithdrawn` channel.

## Notices

`public/assets/notices.js`. Seen stamps live in `localStorage`
`mindset.notices.{uid}`. A count is events whose stamp is not the seen stamp.
Opening a tab marks only that channel seen. Signal channels also delete the
signal docs.

- Current game bar: `onTail`, `trailGlint`, `requestWithdrawn`, `distanced`.
- School game bar: `schoolRequest`, `schoolMember`, `requestDeclined`.
- On my tail tab: `onTail` + `requestWithdrawn` + `distanced`.
- My trail tab: `trailGlint` only. Passed glints use
  `mindset.passedGlints.{uid}`.
- School tabs: incoming = `schoolRequest`, members = `schoolMember`,
  outgoing = `requestDeclined`.

Signal kinds the rules allow: `requestDeclined`, `requestWithdrawn`,
`joinPassed`, `distanced`.

## Profile actions

`#ritual` and `.actions-primary` are the first children of `#pane-surface`
only. Other profile tabs do not show them. Closing the green note sets
`ritualClosed` for that page view; reload shows it again. Distance is shown
when you are not a member and the handshake is open (`theyTail` or a live
glint either way), in the branch that is not an incoming or outgoing request.
`#tail` has no tooltip. No session opens `/register?next=/i/{number}`. A
signed-in account with no mindset opens `/me`.

## Root reads

Opening `/root` lists published mindsets, tails, school requests, the members
collection group and glints. It does not read `privateMindsets` or `deepReadings`.
A cycle uses `sim.readsForTick`: closed texts only for sims that might shine or
pledge, deep scores only for sims (and root) in a match. A real fish's deep
reading stays unread. Writes are committed in batches of about 400. After the
cycle the screen paints from the plan and does not load the lake again.

`isRoot()` shows the denied wall only on a permission error or when mindset 1
belongs to someone else. Quota and other failures surface on the page notice,
keeping the Firestore sentence.

`scripts/sim-tick.js` runs the same cycle. Creates use `currentDocument.exists:
false`. A query error row throws instead of looking like an empty lake.
`.github/workflows/sim-hourly.yml` fires only from the default branch, and only
when `ROOT_EMAIL` and `ROOT_PASSWORD` are set. It is not on `main` until that
file is pushed.

## Deploy

"yayınla" means, from the repo root: `npm run check && npm run stamp && npm run deploy`.
That deploys hosting target `mindset` to `collective-bucket`. Firestore rules
and indexes are deployed only from collective-bucket/firestore
(`rules/20-mindset.rules`); a rule change here is a PR there. Pushing `main` does the same through GitHub Actions.
The test site is hosting target `mindset-test` (`cbucket-mindset-test`,
https://test.mindsetbucket.com). `npm run deploy:test` and a push to
`simulation` publish only that hosting site. "yayınla" is still production.
README and `docs/` are not on the hosting site (`public/` only).

`firebase` is not on the shell PATH. It is the local `firebase-tools`
devDependency, so `npm run deploy` finds it and a bare `firebase` does not
(`zsh: command not found`). Reauth with `npx firebase login --reauth` in this
repo. Do not tell the user to run a global `firebase`.

When credentials expire, deploy prints `Your credentials are no longer valid`
and nothing is published. A stamp that already ran only changes local `?v=`
query strings. After the user finishes reauth, run the deploy again. Do not
start `login --reauth` from the agent; it needs their browser.
