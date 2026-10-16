# Mindset Bucket

Build a bucket of minds together. A mindset is a number and a fish in a lake.
Number 212 lives at `/i/212`. Outside, nobody has a name: only numbers travel.

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

Only profiles (`/i/{number}`), the sign-in pages and the 404 page are public.
Everything else (current, lake, school, me, create, `/a/{alias}`) sits behind
a sign-in wall: signed-out visitors see a short pitch, the reading scheme and a
button to enter. The wall is client-side; Firestore rules stay the source of
truth for what can be read.

The page title doubles as a breadcrumb in the header (`Mindset Bucket › current`),
with the EN/TR switch on the right. The brand mark is a mint line-drawn bucket
with two fish ([`public/assets/logo.svg`](public/assets/logo.svg)).

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

Getting into a school is a handshake of three small steps, all enforced by
Firestore rules (no Cloud Functions):

1. **Tail.** A swims after B (`tails/{A}_{B}`). B sees A on their current.
   Nothing else is revealed and nobody is notified.
2. **Glint.** If A swims after B, B can shine **one closed field** for A
   (`glints/{B}_{A}`): a verbatim copy of that closed text. A can read it for
   seven days, and only the rules' clock decides when it ends.
3. **School request.** A answers with a request (`schoolRequests/{A}_{B}`) and
   a sealed pledge of one of A's own closed fields (`seals/{A}_{B}`). B can read
   the pledge only after accepting. When B accepts, both memberships appear
   (`schools/{uid}/members/{other}`).

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
use it.

## Local

```bash
npm install
npm run check        # syntax, unit tests, i18n parity, rules allowlists
npm run serve        # hosting emulator on http://127.0.0.1:5055
npm run test:rules   # Firestore rules against the emulator (needs Java)
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
