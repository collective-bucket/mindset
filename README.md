# mindset

A mindset is a shareable catalog number. Number 212 lives at `/i/212`; if its
owner picks a public alias, it also lives at `/a/<alias>`.

What is public is not a test result. Three open texts (right now, what I hold
true, how I tell my story) appear on the profile as written. Four open readings
(in charge, together, clear code, turns out fine) estimate how close those texts
sit to fixed anchor sentences. Three closed texts (what I don't say out loud,
desire, the side I'm ashamed of) and the four readings derived from them stay
with their owner. They never reach lists, distributions or profiles.

Scoring runs in the browser with `multilingual-e5-small`. Text is never sent to
a model or a server. The codebook, including the academic construct names,
anchors and calibration, is in [`public/assets/lens-v2.js`](public/assets/lens-v2.js).

The interface is English by default with a Turkish option
([`public/assets/i18n.js`](public/assets/i18n.js)). People can write in either
language: every anchor exists in English and Turkish, and a pole is the mean of
both.

## Social layer

- **Follow** works like a bookmark. No approval, nobody is notified, and only you
  can see the list.
- **Tribe** is mutual. You invite someone from their profile; they accept. Members
  see each other's tribe-only alias and can read each other's tribe list.
- **Alias** is optional: 3-20 lowercase letters, digits or `_`. Visibility is
  either everyone or tribe only; the tribe always sees it.
- **Similar** and **suggestions** use the open-reading bucket and its neighbors,
  optionally narrowed by country or age range, then rank by score distance.

## Demographics

All optional. Age range, gender and country show on the profile and drive
Explore filters and charts. City is stored on the private document and only
feeds aggregate counts; Explore hides cities with fewer than five people.
Accounts are for people aged 18 and over.

## Data

| Collection | Who reads | Holds |
| --- | --- | --- |
| `mindsets/{number}` | everyone if published, owner always | open texts, open readings, bucket, age range, gender, country, public alias |
| `privateMindsets/{number}` | owner | closed texts, closed readings, city |
| `aliases/{alias}`, `aliasOf/{number}` | everyone if public, owner, tribe | alias, visibility |
| `follows/{uid}/items/{number}` | owner | bookmarks |
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

Live: https://mindset.collectivebucket.com
