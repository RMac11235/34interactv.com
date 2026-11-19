import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails
} from '@firebase/rules-unit-testing';
import { doc, getDoc, getDocs, collection, setDoc, addDoc, deleteDoc, updateDoc, serverTimestamp } from 'firebase/firestore';

const root = dirname(fileURLToPath(import.meta.url));
const rules = readFileSync(resolve(root, 'firestore.rules'), 'utf8');

const env = await initializeTestEnvironment({
  projectId: 'demo-interactv',
  firestore: { rules, host: '127.0.0.1', port: 8080 }
});

let passed = 0;
let failed = 0;
async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log('PASS', name);
  } catch (e) {
    failed++;
    console.log('FAIL', name);
    console.log('     ', e && e.message ? e.message : e);
  }
}

const aliceCtx = () => env.authenticatedContext('alice', { email: 'alice@example.com', name: 'Alice' });
const bobCtx = () => env.authenticatedContext('bob', { email: 'bob@example.com', name: 'Bob' });
const anonCtx = () => env.unauthenticatedContext();

function post(over = {}) {
  return {
    title: 'A useful idea',
    body: 'Here is the suggestion in enough detail.',
    authorUid: 'alice',
    authorName: 'Alice',
    createdAt: serverTimestamp(),
    ...over
  };
}

await env.clearFirestore();

await test('anon can read an existing feedback post', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'apps/glydekeys/feedback/p1'), {
      title: 'Seed', body: 'Seed body', authorUid: 'alice', authorName: 'Alice', createdAt: new Date()
    });
  });
  await assertSucceeds(getDoc(doc(anonCtx().firestore(), 'apps/glydekeys/feedback/p1')));
});

await test('anon cannot create a feedback post', async () => {
  await assertFails(addDoc(collection(anonCtx().firestore(), 'apps/glydekeys/feedback'), post({ authorUid: 'anon' })));
});

await test('signed-in user can create a valid feedback post as themselves', async () => {
  await assertSucceeds(addDoc(collection(aliceCtx().firestore(), 'apps/glydekeys/feedback'), post()));
});

await test('signed-in user cannot create a post as someone else', async () => {
  await assertFails(addDoc(collection(aliceCtx().firestore(), 'apps/glydekeys/feedback'), post({ authorUid: 'bob' })));
});

await test('title longer than 80 is rejected', async () => {
  await assertFails(addDoc(collection(aliceCtx().firestore(), 'apps/glydekeys/feedback'), post({ title: 'x'.repeat(81) })));
});

await test('empty body is rejected', async () => {
  await assertFails(addDoc(collection(aliceCtx().firestore(), 'apps/glydekeys/feedback'), post({ body: '' })));
});

await test('body longer than 2000 is rejected', async () => {
  await assertFails(addDoc(collection(aliceCtx().firestore(), 'apps/glydekeys/feedback'), post({ body: 'y'.repeat(2001) })));
});

await test('unknown app id is rejected', async () => {
  await assertFails(addDoc(collection(aliceCtx().firestore(), 'apps/notanapp/feedback'), post()));
});

await test('client-set createdAt (not server timestamp) is rejected', async () => {
  await assertFails(addDoc(collection(aliceCtx().firestore(), 'apps/glydekeys/feedback'), post({ createdAt: new Date('2020-01-01') })));
});

await test('author cannot edit post content', async () => {
  const db = aliceCtx().firestore();
  const ref = doc(db, 'apps/glydekeys/feedback/edit1');
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'apps/glydekeys/feedback/edit1'), {
      title: 'Seed', body: 'Seed body', authorUid: 'alice', authorName: 'Alice', createdAt: new Date()
    });
  });
  await assertFails(updateDoc(ref, { title: 'Changed' }));
});

await test('author can delete their post; other users cannot', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'apps/vigil/feedback/del1'), {
      title: 'Seed', body: 'Seed body', authorUid: 'alice', authorName: 'Alice', createdAt: new Date()
    });
  });
  await assertFails(deleteDoc(doc(bobCtx().firestore(), 'apps/vigil/feedback/del1')));
  await assertSucceeds(deleteDoc(doc(aliceCtx().firestore(), 'apps/vigil/feedback/del1')));
});

await test('user can vote +1 or -1 on their own vote doc', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'apps/truckworth/feedback/v1'), {
      title: 'Seed', body: 'Seed body', authorUid: 'alice', authorName: 'Alice', createdAt: new Date()
    });
  });
  const aliceVote = doc(aliceCtx().firestore(), 'apps/truckworth/feedback/v1/votes/alice');
  await assertSucceeds(setDoc(aliceVote, { value: 1 }));
  await assertSucceeds(setDoc(aliceVote, { value: -1 }));
});

await test('vote value 2 is rejected', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'apps/truckworth/feedback/v2'), {
      title: 'Seed', body: 'Seed body', authorUid: 'alice', authorName: 'Alice', createdAt: new Date()
    });
  });
  await assertFails(setDoc(doc(aliceCtx().firestore(), 'apps/truckworth/feedback/v2/votes/alice'), { value: 2 }));
});

await test('user cannot write another user\'s vote document', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'apps/truckworth/feedback/v3'), {
      title: 'Seed', body: 'Seed body', authorUid: 'alice', authorName: 'Alice', createdAt: new Date()
    });
  });
  await assertFails(setDoc(doc(aliceCtx().firestore(), 'apps/truckworth/feedback/v3/votes/bob'), { value: 1 }));
});

await test('anon can read votes', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'apps/truckworth/feedback/v4/votes/alice'), { value: 1 });
  });
  await assertSucceeds(getDoc(doc(anonCtx().firestore(), 'apps/truckworth/feedback/v4/votes/alice')));
});

await test('signed-in user can post on a game message board', async () => {
  await assertSucceeds(addDoc(collection(aliceCtx().firestore(), 'games/plumbline/messages'), post({ title: 'Tip', body: 'Drop it on the line.' })));
});

await test('message board rejected for a non-game app id', async () => {
  await assertFails(addDoc(collection(aliceCtx().firestore(), 'games/vigil/messages'), post()));
});

await test('anon can read leaderboard scores', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'games/pegasus/scores/s1'), {
      score: 9000, displayName: 'Ace', uid: 'player1', createdAt: new Date(), mode: 'campaign'
    });
  });
  await assertSucceeds(getDoc(doc(anonCtx().firestore(), 'games/pegasus/scores/s1')));
  await assertSucceeds(getDocs(collection(anonCtx().firestore(), 'games/pegasus/scores')));
});

await test('signed-in web user cannot create, update, or delete a score', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'games/skylease/scores/s2'), {
      score: 10, displayName: 'Bob', uid: 'bob', createdAt: new Date()
    });
  });
  await assertFails(setDoc(doc(aliceCtx().firestore(), 'games/skylease/scores/s3'), {
    score: 99, displayName: 'Alice', uid: 'alice', createdAt: serverTimestamp()
  }));
  await assertFails(updateDoc(doc(aliceCtx().firestore(), 'games/skylease/scores/s2'), { score: 11 }));
  await assertFails(deleteDoc(doc(aliceCtx().firestore(), 'games/skylease/scores/s2')));
  await assertFails(setDoc(doc(anonCtx().firestore(), 'games/skylease/scores/s4'), {
    score: 1, displayName: 'X', uid: 'x', createdAt: serverTimestamp()
  }));
});

await env.cleanup();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
