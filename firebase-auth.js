import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js';
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  getAuth,
  reload,
} from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js';
import {
  doc,
  getDoc,
  getFirestore,
  serverTimestamp,
  setDoc,
  collection,
  getDocs,
} from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const api = {
  app,
  auth,
  db,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  getDoc,
  onAuthStateChanged,
  sendPasswordResetEmail,
  serverTimestamp,
  setDoc,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  reload,
  userDoc: (uid) => doc(db, 'players', uid),
};

window.VoltFirebase = api;
window.dispatchEvent(new CustomEvent('volt-firebase-ready', { detail: api }));

const gate = document.querySelector('#authGate');
const isAuthPage = /(^|\/)auth\.html$/.test(window.location.pathname);
const form = document.querySelector('#authForm');
const nameField = document.querySelector('#authNameField');
const nameInput = document.querySelector('#authName');
const emailInput = document.querySelector('#authEmail');
const passwordInput = document.querySelector('#authPassword');
const submitButton = document.querySelector('#authSubmit');
const modeButton = document.querySelector('#authMode');
const resetButton = document.querySelector('#authReset');
const verifyButton = document.querySelector('#authVerify');
const status = document.querySelector('#authStatus');
const logoutButton = document.querySelector('#logoutButton');
const accountName = document.querySelector('#accountName');
const accountEmail = document.querySelector('#accountEmail');
const cloudSyncStatus = document.querySelector('#cloudSyncStatus');
const accountNameInput = document.querySelector('#accountNameInput');
const accountNameSave = document.querySelector('#accountNameSave');
const adminPanel = document.querySelector('#adminPanel');
const adminLoadPlayers = document.querySelector('#adminLoadPlayers');
const adminPlayers = document.querySelector('#adminPlayers');
const ADMIN_EMAIL = 'martin.roszoly2002@gmail.com';
let registerMode = false;
let syncTimer;

function setStatus(message = '') { if (status) status.textContent = message; }
function setSyncStatus(message) { if (cloudSyncStatus) cloudSyncStatus.textContent = message; }
function setMode(next) {
  registerMode = next;
  nameField.hidden = !registerMode;
  nameInput.required = registerMode;
  submitButton.textContent = registerMode ? 'Regisztráció' : 'Belépés';
  modeButton.textContent = registerMode ? 'Már van profilom' : 'Új profil létrehozása';
  resetButton.hidden = registerMode;
  if (verifyButton) verifyButton.hidden = registerMode;
  setStatus('');
}
function authError(error) {
  const messages = {
    'auth/invalid-credential': 'Hibás e-mail vagy jelszó.',
    'auth/email-already-in-use': 'Ez az e-mail már használatban van.',
    'auth/weak-password': 'A jelszó legalább 6 karakter legyen.',
    'auth/invalid-email': 'Érvénytelen e-mail-cím.',
    'auth/too-many-requests': 'Túl sok próbálkozás. Próbáld meg később.',
    'auth/user-not-found': 'Hibás e-mail vagy jelszó.',
  };
  return messages[error?.code] || 'A művelet nem sikerült. Ellenőrizd az adatokat.';
}
async function persistNewPlayer(user) {
  await setDoc(doc(db, 'players', user.uid), {
    uid: user.uid,
    email: user.email || '',
    displayName: user.displayName || '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    verificationRequired: true,
    gameState: null,
    workshopState: null,
  }, { merge: true });
}
async function needsEmailVerification(user) {
  if (!user || user.emailVerified) return false;
  try {
    const snapshot = await getDoc(doc(db, 'players', user.uid));
    // Profiles created before the verification flow remain usable. New registrations
    // are marked explicitly and still need to verify once.
    return snapshot.exists() && snapshot.data().verificationRequired === true;
  } catch (error) {
    console.warn('Verification status lookup failed', error);
    return true;
  }
}
form?.addEventListener('submit', async (event) => {
  event.preventDefault(); setStatus(''); submitButton.disabled = true;
  try {
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    if (registerMode) {
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      const displayName = nameInput.value.trim();
      if (displayName) await updateProfile(credential.user, { displayName });
      await persistNewPlayer(credential.user);
      await sendEmailVerification(credential.user);
      setStatus('Megerősítő e-mailt küldtünk. Ellenőrizd a postafiókodat.');
      if (verifyButton) verifyButton.hidden = false;
    } else {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      await reload(credential.user);
      if (await needsEmailVerification(credential.user)) {
        setStatus('A belépéshez előbb erősítsd meg az e-mail-címedet.');
        if (verifyButton) verifyButton.hidden = false;
      } else {
        await setDoc(doc(db, 'players', credential.user.uid), { verificationRequired: false }, { merge: true });
      }
    }
  } catch (error) { setStatus(authError(error)); }
  finally { submitButton.disabled = false; }
});
modeButton?.addEventListener('click', () => setMode(!registerMode));
resetButton?.addEventListener('click', async () => {
  const email = emailInput.value.trim();
  if (!email) return setStatus('Add meg az e-mail-címedet a jelszó-visszaállításhoz.');
  try { await sendPasswordResetEmail(auth, email); setStatus('A visszaállító e-mailt elküldtük.'); }
  catch (error) { setStatus(authError(error)); }
});
logoutButton?.addEventListener('click', async () => {
  logoutButton.disabled = true;
  try { sessionStorage.removeItem('volt-cloud-restored'); await signOut(auth); }
  catch (error) { console.warn('Logout failed', error); logoutButton.disabled = false; }
});
onAuthStateChanged(auth, async (user) => {
  if (user && await needsEmailVerification(user)) {
    if (!isAuthPage) window.location.replace('./auth.html');
    setStatus('A belépéshez erősítsd meg az e-mail-címedet.');
    if (verifyButton) verifyButton.hidden = false;
    return;
  }
  if (user && isAuthPage) {
    window.location.replace('./index.html');
    return;
  }
  if (!user && !isAuthPage) {
    window.location.replace('./auth.html');
    return;
  }
  document.body.classList.toggle('auth-required', !user);
  if (gate) gate.hidden = Boolean(user);
  if (!user) { setMode(false); setSyncStatus('Nincs bejelentkezett fiók'); return; }
  if (adminPanel) adminPanel.hidden = user.email !== ADMIN_EMAIL;
  if (accountName) accountName.textContent = user.displayName || 'VoltMarket játékos';
  if (accountEmail) accountEmail.textContent = user.email || '';
  if (accountNameInput) accountNameInput.value = user.displayName || '';
  try {
    const snapshot = await getDoc(doc(db, 'players', user.uid));
    if (!snapshot.exists()) await persistNewPlayer(user);
    await setDoc(doc(db, 'players', user.uid), {
      uid: user.uid,
      email: user.email || '',
      displayName: user.displayName || '',
      lastLoginAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      verificationRequired: false,
    }, { merge: true });
    setSyncStatus('Firebase-szinkronizáció aktív');
    await loadLeaderboard();
    if (snapshot.exists() && snapshot.data().gameState) {
      localStorage.setItem('voltmarket-save', JSON.stringify(snapshot.data().gameState));
      if (snapshot.data().workshopState) localStorage.setItem('voltmarket-workshop', JSON.stringify(snapshot.data().workshopState));
      if (!sessionStorage.getItem('volt-cloud-restored')) {
        sessionStorage.setItem('volt-cloud-restored', '1');
        window.location.reload();
      }
    }
  } catch (error) { console.warn('Player profile sync failed', error); }
});
verifyButton?.addEventListener('click', async () => {
  try {
    if (!auth.currentUser) {
      const email = emailInput.value.trim();
      const password = passwordInput.value;
      if (!email || !password) return setStatus('Add meg az e-mail-címedet és a jelszavadat.');
      await signInWithEmailAndPassword(auth, email, password);
    }
    await sendEmailVerification(auth.currentUser);
    setStatus('Az új megerősítő e-mailt elküldtük. Nézd meg a Spam/Promóciók mappát is.');
  }
  catch (error) { setStatus(authError(error)); }
});
accountNameSave?.addEventListener('click', async () => {
  const user = auth.currentUser;
  const name = accountNameInput.value.trim();
  if (!user || !name) return;
  accountNameSave.disabled = true;
  try {
    await updateProfile(user, { displayName: name });
    await setDoc(doc(db, 'players', user.uid), { displayName: name, updatedAt: serverTimestamp() }, { merge: true });
    if (accountName) accountName.textContent = name;
    setSyncStatus('Profil frissítve');
  } catch (error) { setSyncStatus('Profilmentés sikertelen'); console.warn('Profile update failed', error); }
  finally { accountNameSave.disabled = false; }
});
adminLoadPlayers?.addEventListener('click', async () => {
  if (auth.currentUser?.email !== ADMIN_EMAIL) return;
  adminLoadPlayers.disabled = true;
  try {
    const snapshot = await getDocs(collection(db, 'players'));
    adminPlayers.innerHTML = snapshot.docs.map((item) => {
      const player = item.data();
      return `<div class="admin-player"><strong>${player.displayName || 'Névtelen'}</strong><span>${player.email || '—'}</span><span>${player.level || 1}. szint</span><span>${player.xp || 0} XP</span><span>${player.balance || 0} CR</span></div>`;
    }).join('') || '<p>Nincs még játékosprofil.</p>';
  } catch (error) { adminPlayers.textContent = 'A játékoslista nem tölthető be.'; console.warn('Admin player list failed', error); }
  finally { adminLoadPlayers.disabled = false; }
});
document.body.classList.add('auth-required');

window.addEventListener('volt-state-changed', (event) => {
  const user = auth.currentUser;
  if (!user || !event.detail) return;
  setSyncStatus('Mentés a felhőbe…');
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => setDoc(doc(db, 'players', user.uid), {
    uid: user.uid,
    email: user.email || '',
    displayName: user.displayName || '',
    gameState: event.detail,
    workshopState: (() => { try { return JSON.parse(localStorage.getItem('voltmarket-workshop') || 'null'); } catch { return null; } })(),
    level: Number(event.detail.level || 1),
    xp: Number(event.detail.xp || 0),
    balance: Number(event.detail.balance || 0),
    score: Number(event.detail.balance || 0) + Number(event.detail.level || 1) * 10000 + Number(event.detail.xp || 0),
    updatedAt: serverTimestamp(),
  }, { merge: true }).then(() => setSyncStatus('Felhőbe mentve')).catch((error) => { setSyncStatus('Felhőmentés sikertelen'); console.warn('Cloud save failed', error); }), 500);
  setTimeout(loadLeaderboard, 700);
});
window.addEventListener('volt-workshop-changed', (event) => {
  const user = auth.currentUser;
  if (!user || !event.detail) return;
  setDoc(doc(db, 'players', user.uid), { workshopState: event.detail, updatedAt: serverTimestamp() }, { merge: true })
    .then(() => { setSyncStatus('Felhőbe mentve'); setTimeout(loadLeaderboard, 700); })
    .catch(error => { setSyncStatus('Felhőmentés sikertelen'); console.warn('Workshop cloud save failed', error); });
});

const leaderboard = document.querySelector('#leaderboard');
const businessModal = document.querySelector('#playerBusinessModal');
const businessModalContent = document.querySelector('#playerBusinessContent');
const businessModalClose = document.querySelector('#playerBusinessClose');
const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
let leaderboardPlayers = new Map();
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
function rankStats(player) {
  const game = player.gameState && typeof player.gameState === 'object' ? player.gameState : {};
  const workshop = player.workshopState && typeof player.workshopState === 'object' ? player.workshopState : {};
  const balance = finite(game.balance, finite(player.balance));
  const level = Math.max(1, finite(game.level, finite(player.level, 1)));
  const xp = Math.max(0, finite(game.xp, finite(player.xp)));
  const owned = Array.isArray(game.owned) ? game.owned.length : 0;
  const finished = Array.isArray(workshop.finished) ? workshop.finished.length : (Array.isArray(game.history) ? game.history.filter(item => finite(item?.amount) > 0).length : 0);
  // Always derive the score from the newest saved gameState instead of trusting
  // an old denormalized score field in Firestore.
  const score = Math.max(0, Math.round(balance + level * 10000 + xp + owned * 5000 + finished * 2500));
  return { balance, level, xp, owned, finished, score, game, workshop };
}
function renderBusinessProfile(player) {
  if (!businessModalContent) return;
  const stats = rankStats(player);
  const game = stats.game;
  const workshop = stats.workshop;
  const equipment = Array.isArray(game.owned) ? game.owned : [];
  const projects = Array.isArray(workshop.projects) ? workshop.projects.length : 0;
  const finished = Array.isArray(workshop.finished) ? workshop.finished.length : stats.finished;
  const employees = Array.isArray(workshop.employees) ? workshop.employees.length : 0;
  const technicians = finite(workshop.repairCrewHired) + finite(workshop.customerCrewHired);
  const stores = [workshop.storeOwned && 'Alapüzlet', workshop.franchiseOwned && 'Franchise üzlet', workshop.flagshipOwned && 'Prémium üzlet'].filter(Boolean);
  const name = escapeHtml(player.displayName || 'Névtelen játékos');
  businessModalContent.innerHTML = `<div class="business-profile-kicker">VOLTMarket üzleti profil</div><h2 id="playerBusinessTitle">${name} üzlete</h2><p class="business-profile-intro">Itt látható röviden, hol tart ez a játékos a fejlesztésben és a bevételben.</p><div class="business-profile-stats"><div><span>HELYEZÉS</span><strong>#${player.rank || '–'}</strong></div><div><span>SZINT</span><strong>${stats.level}</strong></div><div><span>KREDIT</span><strong>${stats.balance.toLocaleString('hu-HU')} CR</strong></div><div><span>XP</span><strong>${stats.xp.toLocaleString('hu-HU')}</strong></div></div><div class="business-profile-grid"><article><span class="eyebrow">FEJLŐDÉS</span><p>${equipment} felszerelés · ${stats.finished} teljesített eredmény</p><p>${projects} aktív projekt · ${finished} kész termék</p></article><article><span class="eyebrow">CSAPAT ÉS ÜZLETEK</span><p>${employees} alap munkatárs · ${technicians} szerviztechnikus</p><p>${stores.length ? stores.join(' · ') : 'Még csak az alapüzlet épül'}</p></article></div>`;
  businessModal.hidden = false;
  businessModal.setAttribute('aria-hidden', 'false');
}
function closeBusinessProfile() {
  if (!businessModal) return;
  businessModal.hidden = true;
  businessModal.setAttribute('aria-hidden', 'true');
}
businessModalClose?.addEventListener('click', closeBusinessProfile);
businessModal?.addEventListener('click', event => { if (event.target === businessModal) closeBusinessProfile(); });
document.addEventListener('keydown', event => { if (event.key === 'Escape') closeBusinessProfile(); });
async function loadLeaderboard() {
  if (!leaderboard || !auth.currentUser) return;
  try {
    const snapshot = await getDocs(collection(db, 'players'));
    const players = snapshot.docs.map(item => ({ ...item.data(), uid: item.id })).sort((a, b) => rankStats(b).score - rankStats(a).score || rankStats(b).level - rankStats(a).level || String(a.displayName || '').localeCompare(String(b.displayName || ''), 'hu'));
    leaderboardPlayers = new Map(players.map((player, index) => [player.uid, { ...player, rank: index + 1 }]));
    const playerButton = (player, index, className = '') => `<button type="button" class="${className}" data-player-profile="${escapeHtml(player.uid)}"><span class="leader-rank">${index + 1}</span><strong>${escapeHtml(player.displayName || 'Névtelen játékos')}</strong><small>${rankStats(player).score.toLocaleString('hu-HU')} pont</small></button>`;
    leaderboard.innerHTML = players.length ? `<div class="leaderboard-podium">${players.slice(0, 3).map((player, index) => playerButton(player, index, `leader-card rank-${index + 1}`)).join('')}</div><div class="leaderboard-list">${players.slice(3).map((player, index) => `<button type="button" class="leader-row" data-player-profile="${escapeHtml(player.uid)}"><span>${index + 4}.</span><strong>${escapeHtml(player.displayName || 'Névtelen játékos')}</strong><small>${rankStats(player).score.toLocaleString('hu-HU')} pont</small></button>`).join('')}</div>` : '<p class="leaderboard-empty">Még nincs rangsorolt játékos.</p>';
  } catch (error) { leaderboard.innerHTML = '<p class="leaderboard-empty">A ranglista most nem tölthető be.</p>'; console.warn('Leaderboard failed', error); }
}
leaderboard?.addEventListener('click', event => { const target = event.target.closest('[data-player-profile]'); const player = target && leaderboardPlayers.get(target.dataset.playerProfile); if (player) renderBusinessProfile(player); });
