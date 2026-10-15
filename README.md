# mindset

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

## Screens

The game bar at the bottom has three buttons, left to right:

- **Flow** (bucket): your tribe and your net first, then recent changes across
  the lake.
- **Hunt** (fisherman, the big one): the lake. Each fish is a mind placed by two
  open readings. The panel narrows the scale with ranges and demographic
  filters; the lake zooms to what is left. Tap a fish to hook it or invite it.
  The Bucket tab shows aggregate distributions.
- **Me** (jumping fish): your number, alias, history consent, reading, closed
  texts, net, tribe and account.

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
| `mindsets/{number}` | everyone if published, owner always | open texts, open readings, bucket, age range, gender, country, history level |
| `mindsets/{number}/versions/{id}` | owner; tribe or everyone per history level | past open texts and readings |
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

## Local

```bash
npm install
npm run check        # syntax, unit tests, i18n parity, rules allowlists
npm run serve        # hosting emulator on http://127.0.0.1:5055
npm run test:rules   # Firestore rules against the emulator (needs Java)
```

## Deploy

Pushing to `main` deploys hosting, rules and indexes through GitHub Actions
(Workload Identity, service account `github-actions-deployer`). Firebase project
`collective-bucket`, hosting site `cbucket-mindset`, target `mindset`.

Live: https://mindsetbucket.com (https://mindset.collectivebucket.com and
https://www.mindsetbucket.com redirect here)
