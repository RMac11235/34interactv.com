/* Community boards for 34interactv.com, backed by Firebase Auth + Firestore.
   Modular SDK 13.4.0 from the Firebase gstatic CDN.
   Score is computed client-side from the votes subcollection (one vote per user).
   Leaderboard writes are not allowed from this web app; see FIREBASE-BOARDS.md. */
import { initializeApp } from 'https://www.gstatic.com/firebasejs/13.4.0/firebase-app.js';
import {
  getAuth, onAuthStateChanged, signInWithPopup, GoogleAuthProvider,
  signInWithEmailAndPassword, createUserWithEmailAndPassword,
  sendPasswordResetEmail, signOut, updateProfile
} from 'https://www.gstatic.com/firebasejs/13.4.0/firebase-auth.js';
import {
  getFirestore, collection, doc, addDoc, getDocs, setDoc, deleteDoc,
  serverTimestamp, query, orderBy, limit
} from 'https://www.gstatic.com/firebasejs/13.4.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: 'AIzaSyCSLMS1sb2o4eCkUBsoQbIcILJ7ygtd4Aw',
  authDomain: 'interactv-d20a3.firebaseapp.com',
  projectId: 'interactv-d20a3',
  storageBucket: 'interactv-d20a3.firebasestorage.app',
  messagingSenderId: '849441131278',
  appId: '1:849441131278:web:32fead265405675b93a55f'
};

const TITLE_MAX = 80;
const BODY_MAX = 2000;
const NAME_MAX = 40;
const SCORE_LIMIT = 50;

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const google = new GoogleAuthProvider();
google.setCustomParameters({ prompt: 'select_account' });

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function displayName(user) {
  if (!user) return '';
  const n = (user.displayName || '').trim();
  if (n) return n.slice(0, NAME_MAX);
  const email = user.email || '';
  return (email.split('@')[0] || 'Player').slice(0, NAME_MAX);
}

function postsPath(kind, id) {
  return kind === 'message'
    ? collection(db, 'games', id, 'messages')
    : collection(db, 'apps', id, 'feedback');
}

function votesPath(kind, id, postId) {
  return collection(db, kind === 'message' ? 'games' : 'apps', id, kind === 'message' ? 'messages' : 'feedback', postId, 'votes');
}

function setStatus(el, msg, isError) {
  if (!el) return;
  el.textContent = msg || '';
  el.classList.toggle('is-error', !!isError && !!msg);
}

function authFormHtml() {
  return `
    <div class="fb-auth">
      <p class="fb-auth-status"></p>
      <div class="fb-auth-signedout">
        <p><button type="button" class="btn fb-google">Continue with Google</button>
           <button type="button" class="btn ghost fb-toggle-email">Email sign-in</button></p>
        <form class="fb-email-form" hidden>
          <p><label>Display name (for new accounts)<br>
            <input class="fb-name" type="text" name="name" maxlength="${NAME_MAX}" autocomplete="nickname"></label></p>
          <p><label>Email<br>
            <input class="fb-email" type="email" name="email" required autocomplete="username"></label></p>
          <p><label>Password (6 or more characters)<br>
            <input class="fb-pass" type="password" name="password" minlength="6" required autocomplete="current-password"></label></p>
          <p><button type="submit" class="btn fb-signin">Sign in</button>
             <button type="button" class="btn ghost fb-signup">Create account</button>
             <button type="button" class="btn ghost fb-reset">Reset password</button></p>
        </form>
      </div>
      <div class="fb-auth-signedin" hidden>
        <p>Signed in as <strong class="fb-who"></strong>
           <button type="button" class="btn ghost fb-signout">Sign out</button></p>
      </div>
      <p class="fb-msg small" role="status"></p>
    </div>`;
}

function composeHtml(kind) {
  const titlePh = kind === 'message' ? 'Subject (required)' : 'Suggestion title';
  const bodyPh = kind === 'message' ? 'Your message' : 'Describe the idea or problem';
  const submit = kind === 'message' ? 'Post message' : 'Post suggestion';
  return `
    <form class="fb-compose" hidden>
      <p><label>${esc(titlePh)} <span class="fb-count" data-for="title"></span><br>
        <input class="fb-title" type="text" name="title" required maxlength="${TITLE_MAX}"></label></p>
      <p><label>${esc(bodyPh)} <span class="fb-count" data-for="body"></span><br>
        <textarea class="fb-body" name="body" required maxlength="${BODY_MAX}" rows="4"></textarea></label></p>
      <p><button type="submit" class="btn">${esc(submit)}</button></p>
      <p class="fb-msg small" role="status"></p>
    </form>`;
}

function bindAuth(root, onChange) {
  const signedOut = root.querySelector('.fb-auth-signedout');
  const signedIn = root.querySelector('.fb-auth-signedin');
  const who = root.querySelector('.fb-who');
  const emailForm = root.querySelector('.fb-email-form');
  const msg = root.querySelector('.fb-auth .fb-msg');

  root.querySelector('.fb-toggle-email').addEventListener('click', () => {
    emailForm.hidden = !emailForm.hidden;
  });
  root.querySelector('.fb-google').addEventListener('click', async () => {
    setStatus(msg, 'Opening Google sign-in…');
    try {
      await signInWithPopup(auth, google);
      setStatus(msg, '');
    } catch (e) {
      setStatus(msg, friendlyError(e), true);
    }
  });
  root.querySelector('.fb-signout').addEventListener('click', () => signOut(auth));

  emailForm.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const email = root.querySelector('.fb-email').value.trim();
    const password = root.querySelector('.fb-pass').value;
    setStatus(msg, '');
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (e) {
      setStatus(msg, friendlyError(e), true);
    }
  });
  root.querySelector('.fb-signup').addEventListener('click', async () => {
    const email = root.querySelector('.fb-email').value.trim();
    const password = root.querySelector('.fb-pass').value;
    const name = root.querySelector('.fb-name').value.trim().slice(0, NAME_MAX);
    setStatus(msg, '');
    if (!email || password.length < 6) {
      setStatus(msg, 'Enter an email and a password of at least 6 characters.', true);
      return;
    }
    if (!name) {
      setStatus(msg, 'Choose a display name for your account.', true);
      return;
    }
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(cred.user, { displayName: name });
    } catch (e) {
      setStatus(msg, friendlyError(e), true);
    }
  });
  root.querySelector('.fb-reset').addEventListener('click', async () => {
    const email = root.querySelector('.fb-email').value.trim();
    if (!email) {
      setStatus(msg, 'Enter your email first, then click Reset password.', true);
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      setStatus(msg, 'Password reset email sent, if that account exists.');
    } catch (e) {
      setStatus(msg, friendlyError(e), true);
    }
  });

  return onAuthStateChanged(auth, (user) => {
    const in_ = !!user;
    signedOut.hidden = in_;
    signedIn.hidden = !in_;
    if (who) who.textContent = displayName(user);
    const compose = root.querySelector('.fb-compose');
    if (compose) compose.hidden = !in_;
    if (onChange) onChange(user);
  });
}

function friendlyError(e) {
  const code = e && e.code ? e.code : '';
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
    return 'Sign-in was cancelled.';
  }
  if (code === 'auth/popup-blocked') return 'The sign-in popup was blocked. Allow popups and try again.';
  if (code === 'auth/unauthorized-domain') {
    return 'This domain is not yet authorized for Firebase sign-in.';
  }
  if (code === 'auth/email-already-in-use') return 'That email already has an account. Sign in instead.';
  if (code === 'auth/invalid-email') return 'That email address is not valid.';
  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
    return 'Email or password is not correct.';
  }
  if (code === 'auth/weak-password') return 'Use a password of at least 6 characters.';
  if (code === 'auth/too-many-requests') return 'Too many attempts. Wait a moment and try again.';
  if (code === 'permission-denied') return 'That action is not allowed.';
  return (e && e.message) ? e.message : 'Something went wrong. Try again.';
}

async function loadPosts(kind, id) {
  const snap = await getDocs(postsPath(kind, id));
  const posts = [];
  for (const d of snap.docs) {
    const data = d.data();
    const vsnap = await getDocs(votesPath(kind, id, d.id));
    const votes = {};
    let score = 0;
    vsnap.forEach((v) => {
      const val = v.data().value;
      if (val === 1 || val === -1) {
        votes[v.id] = val;
        score += val;
      }
    });
    posts.push({
      id: d.id,
      title: data.title || '',
      body: data.body || '',
      authorUid: data.authorUid || '',
      authorName: data.authorName || 'Someone',
      createdAt: data.createdAt && data.createdAt.toDate ? data.createdAt.toDate() : null,
      score,
      votes
    });
  }
  posts.sort((a, b) => b.score - a.score || ((b.createdAt || 0) - (a.createdAt || 0)));
  return posts;
}

function renderPosts(listEl, posts, user, kind, id) {
  if (!posts.length) {
    listEl.innerHTML = '<p class="small">No posts yet. Sign in to be the first.</p>';
    return;
  }
  const uid = user ? user.uid : '';
  listEl.innerHTML = posts.map((p) => {
    const mine = uid && p.votes[uid];
    const when = p.createdAt
      ? p.createdAt.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/New_York' }) + ' ET'
      : '';
    return `<article class="fb-post" data-id="${esc(p.id)}">
      <div class="fb-votes" aria-label="Votes">
        <button type="button" class="fb-up${mine === 1 ? ' is-on' : ''}" aria-pressed="${mine === 1}" aria-label="Upvote" ${uid ? '' : 'disabled'}>Up</button>
        <p class="fb-score">${p.score}</p>
        <button type="button" class="fb-down${mine === -1 ? ' is-on' : ''}" aria-pressed="${mine === -1}" aria-label="Downvote" ${uid ? '' : 'disabled'}>Down</button>
      </div>
      <div class="fb-bodyblock">
        <h3>${esc(p.title)}</h3>
        <p class="fb-meta small">${esc(p.authorName)}${when ? ' · ' + esc(when) : ''}</p>
        <p class="fb-text">${esc(p.body)}</p>
        ${uid && uid === p.authorUid ? '<p><button type="button" class="btn ghost fb-delete">Delete my post</button></p>' : ''}
      </div>
    </article>`;
  }).join('');

  listEl.querySelectorAll('.fb-post').forEach((art) => {
    const postId = art.getAttribute('data-id');
    const post = posts.find((x) => x.id === postId);
    art.querySelector('.fb-up').addEventListener('click', () => vote(kind, id, post, 1, user, listEl));
    art.querySelector('.fb-down').addEventListener('click', () => vote(kind, id, post, -1, user, listEl));
    const del = art.querySelector('.fb-delete');
    if (del) del.addEventListener('click', async () => {
      if (!confirm('Delete this post?')) return;
      try {
        const col = kind === 'message' ? ['games', id, 'messages'] : ['apps', id, 'feedback'];
        await deleteDoc(doc(db, ...col, postId));
        await refreshBoard(listEl, kind, id, user);
      } catch (e) {
        alert(friendlyError(e));
      }
    });
  });
}

async function vote(kind, id, post, value, user, listEl) {
  if (!user) return;
  const col = kind === 'message' ? ['games', id, 'messages'] : ['apps', id, 'feedback'];
  const ref = doc(db, ...col, post.id, 'votes', user.uid);
  try {
    if (post.votes[user.uid] === value) await deleteDoc(ref);
    else await setDoc(ref, { value });
    await refreshBoard(listEl, kind, id, user);
  } catch (e) {
    alert(friendlyError(e));
  }
}

async function refreshBoard(listEl, kind, id, user) {
  listEl.setAttribute('aria-busy', 'true');
  try {
    const posts = await loadPosts(kind, id);
    renderPosts(listEl, posts, user, kind, id);
  } catch (e) {
    listEl.innerHTML = `<p class="small is-error">${esc(friendlyError(e))}</p>`;
  } finally {
    listEl.removeAttribute('aria-busy');
  }
}

function mountBoard(el) {
  const kind = el.getAttribute('data-fb-board'); // feedback | message
  const id = el.getAttribute('data-app') || el.getAttribute('data-game');
  if (!kind || !id) return;
  el.innerHTML = authFormHtml() + composeHtml(kind) + '<div class="fb-list"></div>';
  const listEl = el.querySelector('.fb-list');
  const compose = el.querySelector('.fb-compose');
  const cmsg = compose.querySelector('.fb-msg');
  const title = el.querySelector('.fb-title');
  const body = el.querySelector('.fb-body');

  function counts() {
    el.querySelectorAll('.fb-count').forEach((s) => {
      const which = s.getAttribute('data-for');
      const max = which === 'title' ? TITLE_MAX : BODY_MAX;
      const n = (which === 'title' ? title.value : body.value).length;
      s.textContent = `(${n}/${max})`;
    });
  }
  title.addEventListener('input', counts);
  body.addEventListener('input', counts);
  counts();

  let user = null;
  bindAuth(el, (u) => {
    user = u;
    refreshBoard(listEl, kind, id, user);
  });

  compose.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    if (!user) return;
    const t = title.value.trim();
    const b = body.value.trim();
    if (t.length < 1 || t.length > TITLE_MAX || b.length < 1 || b.length > BODY_MAX) {
      setStatus(cmsg, `Title must be 1–${TITLE_MAX} characters and the body 1–${BODY_MAX}.`, true);
      return;
    }
    setStatus(cmsg, 'Posting…');
    try {
      await addDoc(postsPath(kind, id), {
        title: t,
        body: b,
        authorUid: user.uid,
        authorName: displayName(user),
        createdAt: serverTimestamp()
      });
      title.value = '';
      body.value = '';
      counts();
      setStatus(cmsg, 'Posted.');
      await refreshBoard(listEl, kind, id, user);
    } catch (e) {
      setStatus(cmsg, friendlyError(e), true);
    }
  });
}

async function mountLeaderboard(el) {
  const game = el.getAttribute('data-game');
  if (!game) return;
  el.innerHTML = '<p class="small fb-lb-status">Loading scores…</p><div class="fb-lb-table"></div>';
  const status = el.querySelector('.fb-lb-status');
  const table = el.querySelector('.fb-lb-table');
  try {
    const q = query(collection(db, 'games', game, 'scores'), orderBy('score', 'desc'), limit(SCORE_LIMIT));
    const snap = await getDocs(q);
    if (snap.empty) {
      setStatus(status, 'No scores posted from the game yet.');
      table.innerHTML = '';
      return;
    }
    setStatus(status, '');
    const rows = snap.docs.map((d, i) => {
      const x = d.data();
      const name = x.displayName || 'Player';
      const score = typeof x.score === 'number' ? x.score : '—';
      const when = x.createdAt && x.createdAt.toDate
        ? x.createdAt.toDate().toLocaleString('en-US', { dateStyle: 'medium', timeZone: 'America/New_York' }) + ' ET'
        : '';
      const mode = x.mode ? ` · ${x.mode}` : '';
      return `<tr><td>${i + 1}</td><td>${esc(name)}</td><td>${esc(score)}</td><td class="small">${esc(when)}${esc(mode)}</td></tr>`;
    }).join('');
    table.innerHTML = `<table><thead><tr><th>Rank</th><th>Player</th><th>Score</th><th>When</th></tr></thead><tbody>${rows}</tbody></table>`;
  } catch (e) {
    // Permission or empty project before rules are published: keep the page usable.
    setStatus(status, friendlyError(e), true);
  }
}

document.querySelectorAll('[data-fb-board]').forEach(mountBoard);
document.querySelectorAll('[data-fb-leaderboard]').forEach(mountLeaderboard);
