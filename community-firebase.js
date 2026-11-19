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

// UI strings. The page's <html lang> picks the language (en, es, ko); English is the fallback.
const STRINGS = {
  en: {
    google: 'Continue with Google', emailSignin: 'Email sign-in', nameLabel: 'Display name (for new accounts)',
    email: 'Email', password: 'Password (6 or more characters)', signIn: 'Sign in', createAccount: 'Create account',
    resetPassword: 'Reset password', signedInAs: 'Signed in as', signOut: 'Sign out',
    msgSubject: 'Subject (required)', fbTitle: 'Suggestion title', msgBody: 'Your message', fbBody: 'Describe the idea or problem',
    postMessage: 'Post message', postSuggestion: 'Post suggestion', openingGoogle: 'Opening Google sign-in…',
    needEmailPass: 'Enter an email and a password of at least 6 characters.', needName: 'Choose a display name for your account.',
    resetFirst: 'Enter your email first, then click Reset password.', resetSent: 'Password reset email sent, if that account exists.',
    cancelled: 'Sign-in was cancelled.', popupBlocked: 'The sign-in popup was blocked. Allow popups and try again.',
    badDomain: 'This domain is not yet authorized for Firebase sign-in.', emailInUse: 'That email already has an account. Sign in instead.',
    badEmail: 'That email address is not valid.', badLogin: 'Email or password is not correct.',
    weakPass: 'Use a password of at least 6 characters.', tooMany: 'Too many attempts. Wait a moment and try again.',
    denied: 'That action is not allowed.', generic: 'Something went wrong. Try again.', someone: 'Someone',
    noPosts: 'No posts yet. Sign in to be the first.', votes: 'Votes', upvote: 'Upvote', downvote: 'Downvote', up: 'Up', down: 'Down',
    deleteMine: 'Delete my post', confirmDelete: 'Delete this post?',
    lengths: (t, b) => `Title must be 1–${t} characters and the body 1–${b}.`, posting: 'Posting…', posted: 'Posted.',
    loadingScores: 'Loading scores…', noScores: 'No scores posted from the game yet.', player: 'Player',
    rank: 'Rank', score: 'Score', when: 'When', locale: 'en-US', tz: ' ET'
  },
  es: {
    google: 'Continuar con Google', emailSignin: 'Iniciar sesión con email', nameLabel: 'Nombre visible (para cuentas nuevas)',
    email: 'Email', password: 'Contraseña (6 caracteres o más)', signIn: 'Iniciar sesión', createAccount: 'Crear cuenta',
    resetPassword: 'Restablecer contraseña', signedInAs: 'Sesión iniciada como', signOut: 'Cerrar sesión',
    msgSubject: 'Asunto (obligatorio)', fbTitle: 'Título de la sugerencia', msgBody: 'Tu mensaje', fbBody: 'Describe la idea o el problema',
    postMessage: 'Publicar mensaje', postSuggestion: 'Publicar sugerencia', openingGoogle: 'Abriendo el inicio de sesión de Google…',
    needEmailPass: 'Escribe un email y una contraseña de al menos 6 caracteres.', needName: 'Elige un nombre visible para tu cuenta.',
    resetFirst: 'Primero escribe tu email y luego haz clic en Restablecer contraseña.', resetSent: 'Si esa cuenta existe, enviamos un email para restablecer la contraseña.',
    cancelled: 'Se canceló el inicio de sesión.', popupBlocked: 'Se bloqueó la ventana de inicio de sesión. Permite las ventanas emergentes e inténtalo de nuevo.',
    badDomain: 'Este dominio todavía no está autorizado para iniciar sesión con Firebase.', emailInUse: 'Ese email ya tiene una cuenta. Inicia sesión.',
    badEmail: 'Esa dirección de email no es válida.', badLogin: 'El email o la contraseña no son correctos.',
    weakPass: 'Usa una contraseña de al menos 6 caracteres.', tooMany: 'Demasiados intentos. Espera un momento e inténtalo de nuevo.',
    denied: 'Esa acción no está permitida.', generic: 'Algo salió mal. Inténtalo de nuevo.', someone: 'Alguien',
    noPosts: 'Todavía no hay publicaciones. Inicia sesión y sé el primero.', votes: 'Votos', upvote: 'Votar a favor', downvote: 'Votar en contra', up: 'A favor', down: 'En contra',
    deleteMine: 'Eliminar mi publicación', confirmDelete: '¿Eliminar esta publicación?',
    lengths: (t, b) => `El título debe tener de 1 a ${t} caracteres y el texto de 1 a ${b}.`, posting: 'Publicando…', posted: 'Publicado.',
    loadingScores: 'Cargando puntuaciones…', noScores: 'El juego todavía no ha publicado puntuaciones.', player: 'Jugador',
    rank: 'Puesto', score: 'Puntuación', when: 'Fecha', locale: 'es-US', tz: ' (hora del Este de EE. UU.)'
  },
  ko: {
    google: 'Google로 계속하기', emailSignin: '이메일로 로그인', nameLabel: '표시 이름(새 계정용)',
    email: '이메일', password: '비밀번호(6자 이상)', signIn: '로그인', createAccount: '계정 만들기',
    resetPassword: '비밀번호 재설정', signedInAs: '로그인 계정:', signOut: '로그아웃',
    msgSubject: '제목(필수)', fbTitle: '제안 제목', msgBody: '메시지', fbBody: '아이디어나 문제를 설명해 주세요',
    postMessage: '메시지 올리기', postSuggestion: '제안 올리기', openingGoogle: 'Google 로그인을 여는 중…',
    needEmailPass: '이메일과 6자 이상의 비밀번호를 입력하세요.', needName: '계정에 사용할 표시 이름을 정하세요.',
    resetFirst: '먼저 이메일을 입력한 다음 비밀번호 재설정을 클릭하세요.', resetSent: '해당 계정이 있으면 비밀번호 재설정 이메일을 보냈습니다.',
    cancelled: '로그인이 취소되었습니다.', popupBlocked: '로그인 팝업이 차단되었습니다. 팝업을 허용하고 다시 시도하세요.',
    badDomain: '이 도메인은 아직 Firebase 로그인이 허용되지 않았습니다.', emailInUse: '이미 계정이 있는 이메일입니다. 로그인하세요.',
    badEmail: '올바른 이메일 주소가 아닙니다.', badLogin: '이메일 또는 비밀번호가 올바르지 않습니다.',
    weakPass: '6자 이상의 비밀번호를 사용하세요.', tooMany: '시도 횟수가 너무 많습니다. 잠시 후 다시 시도하세요.',
    denied: '허용되지 않는 작업입니다.', generic: '문제가 발생했습니다. 다시 시도하세요.', someone: '익명',
    noPosts: '아직 게시글이 없습니다. 로그인해서 첫 글을 남겨 보세요.', votes: '투표', upvote: '추천', downvote: '비추천', up: '추천', down: '비추천',
    deleteMine: '내 글 삭제', confirmDelete: '이 글을 삭제할까요?',
    lengths: (t, b) => `제목은 1~${t}자, 본문은 1~${b}자여야 합니다.`, posting: '올리는 중…', posted: '게시되었습니다.',
    loadingScores: '점수를 불러오는 중…', noScores: '아직 게임에서 올라온 점수가 없습니다.', player: '플레이어',
    rank: '순위', score: '점수', when: '날짜', locale: 'ko-KR', tz: ' (미국 동부 시간)'
  }
};
const LANG = (document.documentElement.lang || 'en').slice(0, 2).toLowerCase();
const T = STRINGS[LANG] || STRINGS.en;

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
        <p><button type="button" class="btn fb-google">${T.google}</button>
           <button type="button" class="btn ghost fb-toggle-email">${T.emailSignin}</button></p>
        <form class="fb-email-form" hidden>
          <p><label>${T.nameLabel}<br>
            <input class="fb-name" type="text" name="name" maxlength="${NAME_MAX}" autocomplete="nickname"></label></p>
          <p><label>${T.email}<br>
            <input class="fb-email" type="email" name="email" required autocomplete="username"></label></p>
          <p><label>${T.password}<br>
            <input class="fb-pass" type="password" name="password" minlength="6" required autocomplete="current-password"></label></p>
          <p><button type="submit" class="btn fb-signin">${T.signIn}</button>
             <button type="button" class="btn ghost fb-signup">${T.createAccount}</button>
             <button type="button" class="btn ghost fb-reset">${T.resetPassword}</button></p>
        </form>
      </div>
      <div class="fb-auth-signedin" hidden>
        <p>${T.signedInAs} <strong class="fb-who"></strong>
           <button type="button" class="btn ghost fb-signout">${T.signOut}</button></p>
      </div>
      <p class="fb-msg small" role="status"></p>
    </div>`;
}

function composeHtml(kind) {
  const titlePh = kind === 'message' ? T.msgSubject : T.fbTitle;
  const bodyPh = kind === 'message' ? T.msgBody : T.fbBody;
  const submit = kind === 'message' ? T.postMessage : T.postSuggestion;
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
    setStatus(msg, T.openingGoogle);
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
      setStatus(msg, T.needEmailPass, true);
      return;
    }
    if (!name) {
      setStatus(msg, T.needName, true);
      return;
    }
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(cred.user, { displayName: name });
      // onAuthStateChanged already fired before the profile had a name; refresh the header now.
      try { await cred.user.reload(); } catch (_) { /* keep the name we just set */ }
      if (who) who.textContent = displayName(auth.currentUser) || name;
      if (onChange) onChange(auth.currentUser);
    } catch (e) {
      setStatus(msg, friendlyError(e), true);
    }
  });
  root.querySelector('.fb-reset').addEventListener('click', async () => {
    const email = root.querySelector('.fb-email').value.trim();
    if (!email) {
      setStatus(msg, T.resetFirst, true);
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      setStatus(msg, T.resetSent);
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
    return T.cancelled;
  }
  if (code === 'auth/popup-blocked') return T.popupBlocked;
  if (code === 'auth/unauthorized-domain') {
    return T.badDomain;
  }
  if (code === 'auth/email-already-in-use') return T.emailInUse;
  if (code === 'auth/invalid-email') return T.badEmail;
  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
    return T.badLogin;
  }
  if (code === 'auth/weak-password') return T.weakPass;
  if (code === 'auth/too-many-requests') return T.tooMany;
  if (code === 'permission-denied') return T.denied;
  return (e && e.message) ? e.message : T.generic;
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
      authorName: data.authorName || T.someone,
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
    listEl.innerHTML = `<p class="small">${esc(T.noPosts)}</p>`;
    return;
  }
  const uid = user ? user.uid : '';
  listEl.innerHTML = posts.map((p) => {
    const mine = uid && p.votes[uid];
    const when = p.createdAt
      ? p.createdAt.toLocaleString(T.locale, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/New_York' }) + T.tz
      : '';
    return `<article class="fb-post" data-id="${esc(p.id)}">
      <div class="fb-votes" aria-label="${esc(T.votes)}">
        <button type="button" class="fb-up${mine === 1 ? ' is-on' : ''}" aria-pressed="${mine === 1}" aria-label="${esc(T.upvote)}" ${uid ? '' : 'disabled'}>${esc(T.up)}</button>
        <p class="fb-score">${p.score}</p>
        <button type="button" class="fb-down${mine === -1 ? ' is-on' : ''}" aria-pressed="${mine === -1}" aria-label="${esc(T.downvote)}" ${uid ? '' : 'disabled'}>${esc(T.down)}</button>
      </div>
      <div class="fb-bodyblock">
        <h3>${esc(p.title)}</h3>
        <p class="fb-meta small">${esc(p.authorName)}${when ? ' · ' + esc(when) : ''}</p>
        <p class="fb-text">${esc(p.body)}</p>
        ${uid && uid === p.authorUid ? `<p><button type="button" class="btn ghost fb-delete">${esc(T.deleteMine)}</button></p>` : ''}
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
      if (!confirm(T.confirmDelete)) return;
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
      setStatus(cmsg, T.lengths(TITLE_MAX, BODY_MAX), true);
      return;
    }
    setStatus(cmsg, T.posting);
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
      setStatus(cmsg, T.posted);
      await refreshBoard(listEl, kind, id, user);
    } catch (e) {
      setStatus(cmsg, friendlyError(e), true);
    }
  });
}

async function mountLeaderboard(el) {
  const game = el.getAttribute('data-game');
  if (!game) return;
  el.innerHTML = `<p class="small fb-lb-status">${esc(T.loadingScores)}</p><div class="fb-lb-table"></div>`;
  const status = el.querySelector('.fb-lb-status');
  const table = el.querySelector('.fb-lb-table');
  try {
    const q = query(collection(db, 'games', game, 'scores'), orderBy('score', 'desc'), limit(SCORE_LIMIT));
    const snap = await getDocs(q);
    if (snap.empty) {
      setStatus(status, T.noScores);
      table.innerHTML = '';
      return;
    }
    setStatus(status, '');
    const rows = snap.docs.map((d, i) => {
      const x = d.data();
      const name = x.displayName || T.player;
      const score = typeof x.score === 'number' ? x.score : '—';
      const when = x.createdAt && x.createdAt.toDate
        ? x.createdAt.toDate().toLocaleString(T.locale, { dateStyle: 'medium', timeZone: 'America/New_York' }) + T.tz
        : '';
      const mode = x.mode ? ` · ${x.mode}` : '';
      return `<tr><td>${i + 1}</td><td>${esc(name)}</td><td>${esc(score)}</td><td class="small">${esc(when)}${esc(mode)}</td></tr>`;
    }).join('');
    table.innerHTML = `<table><thead><tr><th>${esc(T.rank)}</th><th>${esc(T.player)}</th><th>${esc(T.score)}</th><th>${esc(T.when)}</th></tr></thead><tbody>${rows}</tbody></table>`;
  } catch (e) {
    // Permission or empty project before rules are published: keep the page usable.
    setStatus(status, friendlyError(e), true);
  }
}

document.querySelectorAll('[data-fb-board]').forEach(mountBoard);
document.querySelectorAll('[data-fb-leaderboard]').forEach(mountLeaderboard);
