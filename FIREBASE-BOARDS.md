# Firebase boards for 34interactv.com

Web app: Firebase project `interactv-d20a3` (Spark). Auth is Email/Password and Google. The site reads and writes Firestore from `community-firebase.js` (modular SDK 13.4.0). Score on a post is the sum of its `votes` documents, computed in the browser. The web app never writes leaderboard scores.

`community.js` (giscus) is unchanged and still works if a page loads it. App pages on this branch load `community-firebase.js` instead.

## Collections

### Feedback (every app)

`apps/{appId}/feedback/{postId}`

`appId` must be one of: `glydekeys`, `vaultdrill`, `anchorline`, `truckworth`, `vigil`, `brewworth`, `washworth`, `knowncallers`, `plumbline`, `pegasus`, `skylease`.

| Field | Type | Rules |
| --- | --- | --- |
| `title` | string | 1–80 characters |
| `body` | string | 1–2000 characters |
| `authorUid` | string | must equal the signed-in user's uid |
| `authorName` | string | 1–40 characters |
| `createdAt` | timestamp | must be a server timestamp; set with `serverTimestamp()` |

Authors may delete their own posts. No one may edit a post.

`apps/{appId}/feedback/{postId}/votes/{uid}`

| Field | Type | Rules |
| --- | --- | --- |
| `value` | number | exactly `1` or `-1` |

The document id `{uid}` must be the signed-in user's uid (one vote per user per post). A second write overwrites the same document. Deleting the vote document clears that user's vote. The site does not store a denormalized score.

### Game message boards (Plumbline, Pegasus, Skylease only)

Same post and vote shape as feedback, under:

`games/{gameId}/messages/{postId}`
`games/{gameId}/messages/{postId}/votes/{uid}`

`gameId` must be `plumbline`, `pegasus`, or `skylease`.

### Leaderboards (games only; read-only from the web)

`games/{gameId}/scores/{scoreId}`

The website only lists the top 50 by `score` descending. **All client writes are denied** by `firestore.rules`.

To publish a score later, use the [Firebase Admin SDK](https://firebase.google.com/docs/admin/setup) from a trusted game server or Cloud Function (the Admin SDK bypasses security rules). Do not open web-client writes. A later rule change for the game apps can be added here if scores should come straight from the authenticated player, with App Check.

Document shape the site already displays (extra fields are ignored):

| Field | Type | Meaning |
| --- | --- | --- |
| `score` | number | The player's score (higher is better). Required for ranking. |
| `displayName` | string | Name shown on the board. |
| `uid` | string | The player's Firebase Auth uid, when they have one. |
| `createdAt` | timestamp | When the game submitted the score. Shown as a date. |
| `mode` | string | Optional, e.g. `campaign`, `daily`. Shown next to the date if present. |
| `level` or other fields | any | Optional; reserved for the games. Not shown yet. |

`gameId` must be `plumbline`, `pegasus`, or `skylease`. Use a new document id per submitted score (do not overwrite someone else's document).

## Publishing rules

Until rules are published, Firestore stays in production deny-all, so the live boards cannot read or write.

1. Open the Firebase console for project **interactv-d20a3**.
2. Go to **Build → Firestore Database → Rules** (https://console.firebase.google.com/project/interactv-d20a3/firestore/rules).
3. Replace the editor contents with the text of `firestore.rules` from this repo and click **Publish**.

Or, signed in as `developer@34interactv.com` with the Firebase CLI:

```
firebase deploy --only firestore:rules,firestore:indexes --project interactv-d20a3
```

`firestore.indexes.json` is empty; single-field indexes (including `score` descending) are created automatically.

## Local rules tests

From this directory, with Node.js:

```
npm exec --yes --package firebase-tools --package firebase --package @firebase/rules-unit-testing -- firebase emulators:exec --only firestore --project demo-interactv "node firestore.rules.test.mjs"
```

No Firebase login is required for the emulator.
