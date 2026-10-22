# Mindset Bucket

Build a bucket of minds together. A mindset is a number and a fish in a lake.
Number 212 lives at `/i/212`. `/fish/212` opens the same card. Outside, nobody has a name: only numbers travel.

What is public is not a test result. Three open texts (right now, what I hold
true, how I tell my story) appear on the profile as written. Four open readings
(in charge, together, clear code, turns out fine) estimate how close those texts
sit to fixed anchor sentences. Three closed texts (what I don't say out loud,
desire, the side I'm ashamed of) and the four readings derived from them stay
with their owner. They never reach lists, distributions, versions or profiles.

Scoring runs in the browser with `multilingual-e5-small`. Text is never sent to
a model or a server. The codebook, including the academic construct names,
anchors and calibration, is in [`public/assets/lens-v2.js`](public/assets/lens-v2.js).

The interface is English by default with a Turkish option
([`public/assets/i18n.js`](public/assets/i18n.js)). People can write in either
language: every anchor exists in English and Turkish, and a pole is the mean of
both.

## Access

Profiles (`/i/{number}`, and `/fish/{number}` which redirects there), the sign-in pages, the theme gallery (`/theme`) and the 404 page are public. The
home page (`/`) is also public when signed out: a short landing, a number
lookup that opens `/i/{n}`, and `/about` for the manifesto. Everything else (current, lake,
school, me, create, `/a/{alias}`) sits behind a sign-in wall. The wall is
client-side; Firestore rules stay the source of truth for what can be read.

### Why the landing works

A number box on the home page lets a non-member open a calling card someone
handed them. The depth of that card is what asks them to join. In the wild the
ask becomes "what's your mindset number?" or "here's my link" — the ICQ-number
nostalgia keeps it playful; the manifesto underneath keeps the weight.

The page title doubles as a breadcrumb in the header (`Mindset Bucket › current`
in English, `Zihin Kovası › akıntı` in Turkish), with the EN/TR switch and a
menu of the footer links on the right. The brand mark is a mint line-drawn bucket
with one fish leaping out ([`public/assets/logo.svg`](public/assets/logo.svg)).

## Screens

When signed in, the game bar at the bottom has four buttons, left to right:

- **current** (`/`): fish on your tail and fish on your trail, school requests
  waiting for you, then recent changes across the lake.
- **lake** (`/lake`, the big one): each fish is a mind placed by two open
  readings. The panel narrows the scale with ranges and demographic filters;
  the lake zooms to what is left. Tap a fish to swim after it. The Bucket tab
  shows aggregate distributions.
- **school** (`/school`): the fish you swim with, and the requests waiting.
- **me**: your number, alias, history consent, reading, closed texts, school
  and account.

Old paths (`/hunt`, `/tribe`, `/following`, `/flow`) redirect.

**Create** (`/new`) is a three-step wizard (open texts, closed texts, alias and
details) with a "how to read" guide for each lens, plus suggestions for
demographics drawn from what you wrote.

### Profile as a calling card

A profile is the card you would hand to everyone you meet: a short **headline**
("retired traveller") and a one-paragraph **blurb**, both derived in the browser
from the open texts ([`public/assets/reading.js`](public/assets/reading.js)),
with badges, a small radar and the demographics you chose to show. The full
reading (radar, bars, texts, timeline) opens in a sheet. Nearby fish and the
school sit below in tabs; only members can see a school.

## Social layer

Words: the **lake** is everyone, a **current** is what moves around you, a
**school** is the fish you chose, and **me** is you. A fish **swims after**
another (its *tail* and *trail*); nobody hunts or hooks anyone.

Getting into a school is a handshake, enforced by Firestore rules (no Cloud
Functions). A swims after B. B may shine one closed field for seven days. A
answers with a sealed pledge and a request. B accepts, and both memberships
appear. Either side can step away before a school exists: that drops the tail
both ways and the scale they shone, and tells the other side. Counters on
**current** and **school** mark what is new. The pair diagram, the branches,
and which tab clears which counter are in [`docs/handshake.md`](docs/handshake.md).

After that, closed texts never open fully: only the one field each side
showed persists, and the school sees the other's **alias** plus the full
eight-axis radar (the four closed readings are copied, scores only, to
`deepReadings/{number}`). There is no real-name field; the alias is the only
name anyone ever sees, and only inside a school.

- **Alias** is required to publish: 3-20 lowercase letters, digits or `_`. It
  is never public. `firstfish` is reserved for number 1.
- **History**: every publish stores a version of the open side. The owner picks
  who can watch it: only me (default), my school, or everyone. Profiles show a
  timeline with a scrubber when allowed.

## Root and simulation

**Root** is the owner of mindset 1 (`firstfish`). Root alone can open `/root`
(a full-width danger button on the me preferences tab, absent from the game bar).
It shows lake counts (fish, tails, scales, requests, schools) and the handshake
funnel, and runs the simulation. Opening the screen lists published mindsets,
tails, requests, school memberships and glints. Closed texts and deep readings
are not part of that paint. A cycle reads them only for the test fish that might
shine, pledge or be scored, plus root's own deep reading. Real fish stay closed.
Writes go out in batches of about 400. After a cycle the counts are painted from
the plan; the lake is not read again. Root cannot read real fish's closed texts
or readings; the rules let it read only test fish's, and list every glint so the
screen and the hourly tick share one query.

**Test fish** have no Auth account. Their owner uid is `sim{N}` (`seed: true` on
the public document), and root writes for them: the rules accept a write "from"
`sim{N}` only when the signed-in user is root. Nobody else can act for a test
fish.

One click on **Run one cycle** moves every handshake one stage. Stages run
newest-first against the world as it stood when the cycle began, so a pair
never skips ahead (swim after, shine a scale, ask to join, accept take four
cycles):

1. Test fish answer requests: accept a match, decline the rest.
2. Test fish that were shown a scale and match ask to join, sealing one of
   their own closed fields.
3. Test fish shine one closed field for everyone who swims after them.
4. Test fish swim after the nearest fish not on their tail yet. Real fish are
   never approached, except root when "may swim after root" is on.

*Nearby* means the open scores sit within a radius of each other. A *match* is
100 minus the mean gap over every shared open and closed score. Settings (tails
per cycle, tail cap, shine chance, threshold, radius, seed, root) live in
`sim/state`; cycle logs in `simTicks/{n}`. The seed plus the cycle number make a
cycle reproducible. **Reset simulation** clears every pair touching a test fish
and returns to cycle 0; the fish stay. The engine is
[`public/assets/sim.js`](public/assets/sim.js); adding test fish to the lake is a
separate step.

## Privacy

Texts are scanned in the browser ([`public/assets/privacy.js`](public/assets/privacy.js))
before reading and publishing. Emails, phone numbers, Turkish ID numbers, IBANs
and card numbers block publishing. Links, `@handles` and what looks like a full
name show a warning.

## Demographics

All optional. Age range, gender and country show on the profile and drive lake
filters and charts. City is stored on the private document and only feeds
aggregate counts; places with fewer than five people are hidden. Accounts are
for people aged 18 and over.

## Data

| Collection | Who reads | Holds |
| --- | --- | --- |
| `mindsets/{number}` | everyone if published, owner always | open texts, open readings, headline, blurb, bucket, age range, gender, country, history level |
| `mindsets/{number}/versions/{id}` | owner; school or everyone per history level | past open texts, readings, headline and blurb |
| `privateMindsets/{number}` | owner | closed texts, closed readings, city |
| `aliases/{alias}`, `aliasOf/{number}` | owner, school | alias |
| `deepReadings/{number}` | owner, school | the four closed scores, never texts |
| `tails/{from}_{to}` | both sides | who swims after whom |
| `glints/{from}_{to}` | owner; receiver for seven days or as a school | one shown closed field |
| `seals/{from}_{to}` | owner; receiver once in a school | the sealed pledge |
| `schoolRequests/{from}_{to}` | both sides | pending requests |
| `schools/{uid}/members/{uid}` | owner and school | accepted members |
| `signals/{id}` | the recipient | one-shot notices: `requestDeclined`, `requestWithdrawn`, `joinPassed`, `distanced` |
| `sim/state`, `simTicks/{n}` | root | simulation settings, cycle number and log |
| `stats/public` | everyone | histogram counts per axis, age range, gender, country, city |

Rules live in [`firestore.rules`](firestore.rules). The project shares one
Firestore database with other Collective Bucket apps, so the file keeps their
`ads` and `trips` rules first and unchanged.

## Sign-in

Accounts use Firebase Auth inside the app (email and password, password reset,
Google). They are shared with other Collective Bucket apps on the same Firebase
project.

## Design

Static HTML and vanilla JS, no build step. Line drawings with ink for text and
structure; the accent is mint (`--accent` and its soft, mid, strong, deep and
pastel variations in [`public/assets/styles.css`](public/assets/styles.css)).
Hover, active, selected and focus states, primary buttons and chart fills all
use it. Reused texts, icons and buttons are listed at `/theme`
([`public/theme.html`](public/theme.html)) for anyone working on the interface.

## Local

```bash
npm install
npm run check        # syntax, unit tests, i18n parity, rules allowlists
npm run serve        # hosting emulator on http://127.0.0.1:5055
npm run test:rules   # Firestore rules and the simulation against the emulator (needs Java)
```

Scripts in [`scripts/`](scripts):

- `check.js`: syntax check of every asset, then the unit tests.
- `stamp-assets.js`: cache-busts asset URLs; CI runs it before deploy.
- `wipe-except.js [number ...]`: deletes all mindset data and Auth users except
  the listed numbers (default `1`). Needs a fresh `firebase-tools` login. Never
  touches `ads/` or `trips/`.
- `seed-accounts.js`: creates 100 Turkish demo mindsets (`seed: true`,
  `{N}@ms.com`). Not run in production; clean up with `wipe-except.js`.

## Deploy

Pushing to `main` deploys hosting, rules and indexes through GitHub Actions
(Workload Identity, service account `github-actions-deployer`). Firebase project
`collective-bucket`, hosting site `cbucket-mindset`, target `mindset`.

Live: https://mindsetbucket.com (https://mindset.collectivebucket.com and
https://www.mindsetbucket.com redirect here)
