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
Everything else (flow, hunt, me, create, net, tribe, `/a/{alias}`) sits behind
a sign-in wall: signed-out visitors see a short pitch, the reading scheme and a
button to enter. The wall is client-side; Firestore rules stay the source of
truth for what can be read.

The page title doubles as a breadcrumb in the header (`Mindset Bucket › flow`),
with the EN/TR switch on the right. The brand mark is a mint line-drawn bucket
with two fish ([`public/assets/logo.svg`](public/assets/logo.svg)).

## Screens

When signed in, the game bar at the bottom has three buttons, left to right:

- **flow** (bucket): your tribe and your net first, then recent changes across
  the lake.
- **hunt** (angler, the big one): the lake. Each fish is a mind placed by two
  open readings. The panel narrows the scale with ranges and demographic
  filters; the lake zooms to what is left. Tap a fish to hook it or invite it.
  The Bucket tab shows aggregate distributions.
- **me** (jumping fish): your number, alias, history consent, reading, closed
  texts, net, tribe and account.

**Create** (`/new`) is a three-step wizard (open texts, closed texts, alias and
details) with a "how to read" guide for each lens, plus suggestions for
demographics drawn from what you wrote.

### Profile as a calling card

A profile is the card you would hand to everyone you meet: a short **headline**
("retired traveller") and a one-paragraph **blurb**, both derived in the browser
from the open texts ([`public/assets/reading.js`](public/assets/reading.js)),
with badges, a small radar and the demographics you chose to show. The full
reading (radar, bars, texts, timeline) opens in a sheet. Nearby fish and the
tribe sit below in tabs; only mutual members can see a tribe.

## Social layer

- **Hook** adds a fish to your **net**. It works like a bookmark: no approval,
  nobody is notified, only you see the list.
- **Alias** is required to publish: 3-20 lowercase letters, digits or `_`. It is
  never public. Only your tribe sees it. `mindhunter` is reserved for number 1.
- **Tribe** is mutual. You can invite a fish only if you know its alias; rules
  check the alias against the invited number without exposing it. Members see
  each other's alias.
- **History**: every publish stores a version of the open side. The owner picks
  who can watch it: only me (default), my tribe, or everyone. Profiles show a
  timeline with a scrubber when allowed.

## Privacy

Texts are scanned in the browser ([`public/assets/privacy.js`](public/assets/privacy.js))
before reading and publishing. Emails, phone numbers, Turkish ID numbers, IBANs
and card numbers block publishing. Links, `@handles` and what looks like a full
name show a warning.

## Demographics

All optional. Age range, gender and country show on the profile and drive Hunt
filters and charts. City is stored on the private document and only feeds
aggregate counts; places with fewer than five people are hidden. Accounts are
for people aged 18 and over.

## Data

| Collection | Who reads | Holds |
| --- | --- | --- |
| `mindsets/{number}` | everyone if published, owner always | open texts, open readings, headline, blurb, bucket, age range, gender, country, history level |
| `mindsets/{number}/versions/{id}` | owner; tribe or everyone per history level | past open texts, readings, headline and blurb |
| `privateMindsets/{number}` | owner | closed texts, closed readings, city |
| `aliases/{alias}`, `aliasOf/{number}` | owner, tribe | alias |
| `follows/{uid}/items/{number}` | owner | net |
| `tribeRequests/{from}_{to}` | both sides | pending invites |
| `tribes/{uid}/members/{uid}` | owner and tribe | accepted members |
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
