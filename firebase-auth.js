import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js';
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  updatePassword,
  deleteUser,
  getAuth,
  reload,
} from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js';
import {
  doc,
  getDoc,
  getFirestore,
  serverTimestamp,
  setDoc,
  addDoc,
  query,
  where,
  arrayUnion,
  collection,
  getDocs,
  deleteDoc,
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
  addDoc,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  updatePassword,
  deleteUser,
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
const headerPlayerNameValue = document.querySelector('#headerPlayerNameValue');
const accountEmail = document.querySelector('#accountEmail');
const cloudSyncStatus = document.querySelector('#cloudSyncStatus');
const accountNameInput = document.querySelector('#accountNameInput');
const accountNameSave = document.querySelector('#accountNameSave');
const adminPanel = document.querySelector('#adminPanel');
const adminLoadPlayers = document.querySelector('#adminLoadPlayers');
const adminPlayers = document.querySelector('#adminPlayers');
const supportPanel = document.querySelector('#supportPanel');
const supportButton = document.querySelector('#supportButton');
const supportMessageInput = document.querySelector('#supportMessageInput');
const supportStatus = document.querySelector('#supportStatus');
const supportChatModal = document.querySelector('#supportChatModal');
const supportChatClose = document.querySelector('#supportChatClose');
const supportChatMessages = document.querySelector('#supportChatMessages');
const supportChatInput = document.querySelector('#supportChatInput');
const supportChatSend = document.querySelector('#supportChatSend');
const bannedModal = document.querySelector('#bannedModal');
const bannedModalClose = document.querySelector('#bannedModalClose');
let supportChatTargetUid = null;
const supportUnreadByUid = new Map();
const supportMessageTime = value => Number(value?.toMillis?.() || value || 0);
const accountDeleteButton = document.querySelector('#accountDeleteButton');
const ADMIN_EMAIL = 'martin.roszoly2002@gmail.com';
let registerMode = false;
let syncTimer;
let authRedirectTimer;
let remoteStateTimer;

function activatePlayerStorage(uid, notify = false) {
  if (uid) {
    window.VoltStorage?.primeLegacy(uid);
    window.VoltStorage?.setUser(uid);
  } else window.VoltStorage?.setUser('guest');
  if (notify) window.dispatchEvent(new CustomEvent('volt-user-changed', { detail: { uid: uid || 'guest' } }));
}

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
    'auth/operation-not-allowed': 'A regisztráció e-maillel jelenleg nincs engedélyezve a Firebase-ben.',
    'auth/network-request-failed': 'Hálózati hiba történt. Ellenőrizd az internetkapcsolatot.',
    'auth/missing-password': 'Add meg a jelszavadat.',
  };
  return messages[error?.code] || 'A művelet nem sikerült. Ellenőrizd az adatokat.';
}
async function persistNewPlayer(user, displayNameOverride = null) {
  await setDoc(doc(db, 'players', user.uid), {
    uid: user.uid,
    email: user.email || '',
    displayName: displayNameOverride ?? user.displayName ?? '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    verificationRequired: true,
    profileDeleted: false,
    gameState: null,
    workshopState: null,
    level: 1,
    xp: 0,
    balance: 0,
    score: 0,
    rankPointAdjustment: 0,
    adminOverride: null,
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
async function isEmailBanned(email, uid = '') {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized || normalized === ADMIN_EMAIL) return false;
  try {
    const direct = await getDoc(doc(db, 'bannedEmails', normalized));
    if (direct.exists()) return true;
  } catch (error) { console.warn('Direct ban lookup failed', error); }
  try {
    if (uid) {
      const player = await getDoc(doc(db, 'players', uid));
      if (player.data()?.banned === true) return true;
    }
  } catch (error) { console.warn('Player ban lookup failed', error); }
  // Fallback registry lives on the admin's own document. It remains writable
  // even when the optional bannedEmails collection rule has not propagated.
  try {
    const admins = await getDocs(query(collection(db, 'players'), where('email', '==', ADMIN_EMAIL)));
    return admins.docs.some(item => Array.isArray(item.data()?.bannedEmails) && item.data().bannedEmails.map(value => String(value).toLowerCase()).includes(normalized));
  } catch (error) { console.warn('Admin ban registry lookup failed', error); return false; }
}
form?.addEventListener('submit', async (event) => {
  event.preventDefault(); setStatus(''); submitButton.disabled = true;
  try {
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    if (registerMode) {
      // A tiltólista ellenőrzése nem blokkolhatja a regisztrációt akkor sem,
      // ha a Firestore-szabályok még propagálódnak vagy átmenetileg nem érhetők el.
      if (await isEmailBanned(email)) {
        setStatus('Ezzel az e-mail-címmel nem lehet új profilt létrehozni.');
        return;
      }
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
        // Do not recreate a profile deleted by the admin during sign-in.
        // Its missing document triggers the mandatory new name/password flow.
        const existingProfile = await getDoc(doc(db, 'players', credential.user.uid));
        if (existingProfile.exists()) {
          await setDoc(existingProfile.ref, { verificationRequired: false }, { merge: true });
        }
      }
    }
  } catch (error) {
    if (registerMode && error?.code === 'auth/email-already-in-use') {
      setStatus('Ehhez az e-mailhez már tartozik fiók. Válts Belépés módra; törölt profil esetén belépés után új játékosnevet és új jelszót kell megadnod.');
    } else setStatus(authError(error));
  }
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
  try { sessionStorage.removeItem('volt-cloud-restored-user'); await signOut(auth); }
  catch (error) { console.warn('Logout failed', error); logoutButton.disabled = false; }
});
onAuthStateChanged(auth, async (user) => {
  clearTimeout(authRedirectTimer);
  clearInterval(remoteStateTimer);
  if (!user) activatePlayerStorage(null, true);
  if (user?.email && await isEmailBanned(user.email, user.uid)) {
    await signOut(auth);
    if (isAuthPage) { setStatus('Ez az e-mail-cím bannolva van, a fiók nem használható.'); if (bannedModal) bannedModal.hidden = false; }
    return;
  }
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
    authRedirectTimer = setTimeout(() => window.location.replace('./auth.html'), 1200);
  }
  document.body.classList.toggle('auth-required', !user);
  if (gate) gate.hidden = Boolean(user);
  if (!user) { setMode(false); setSyncStatus('Nincs bejelentkezett fiók'); return; }
  const isAdmin = user.email?.toLowerCase() === ADMIN_EMAIL;
  if (adminPanel) adminPanel.hidden = !isAdmin;
  if (supportPanel) supportPanel.hidden = false;
  const displayName = isAdmin ? 'VoltMarketAdmin' : (user.displayName || 'VoltMarket játékos');
  if (accountName) accountName.textContent = displayName;
  if (headerPlayerNameValue) headerPlayerNameValue.textContent = displayName;
  if (accountEmail) accountEmail.textContent = user.email || '';
  if (accountNameInput) accountNameInput.value = user.displayName || '';
  try {
    // Switch the browser-local namespace before reading or restoring cloud data.
    // This prevents the previous account's save from being used while a new
    // account is loading on the same device.
    activatePlayerStorage(user.uid);
    const snapshot = await getDoc(doc(db, 'players', user.uid));
    const profileWasDeleted = !snapshot.exists() || snapshot.data()?.profileDeleted === true;
    if (snapshot.data()?.banned) {
      await signOut(auth);
      if (isAuthPage) { setStatus('Sajnáljuk, ezt az e-mail-címet letiltottuk.'); if (bannedModal) bannedModal.hidden = false; }
      return;
    }
    if (profileWasDeleted) {
      const freshName = window.prompt('A profil törölve lett. Add meg újra a játékosnevedet:')?.trim();
      if (!freshName) {
        await signOut(auth);
        setSyncStatus('A belépéshez új játékosnevet kell megadnod.');
        return;
      }
      const freshPassword = window.prompt('Adj meg egy új jelszót (legalább 6 karakter):') || '';
      if (freshPassword.length < 6) {
        await signOut(auth);
        setSyncStatus('A belépéshez legalább 6 karakteres új jelszó szükséges.');
        return;
      }
      await updateProfile(user, { displayName: freshName });
      await updatePassword(user, freshPassword);
      await persistNewPlayer(user, freshName);
      // A deleted profile must start cleanly and must never inherit another
      // account's or the deleted profile's browser-local save.
      window.VoltStorage?.remove('voltmarket-save');
      window.VoltStorage?.remove('voltmarket-workshop');
    }
    const cloudName = snapshot.data()?.displayName?.trim() || '';
    if (!isAdmin && cloudName && cloudName !== user.displayName) await updateProfile(user, { displayName: cloudName });
    const effectiveDisplayName = isAdmin ? 'VoltMarketAdmin' : (cloudName || user.displayName || 'VoltMarket játékos');
    if (accountName) accountName.textContent = effectiveDisplayName;
    if (headerPlayerNameValue) headerPlayerNameValue.textContent = effectiveDisplayName;
    await setDoc(doc(db, 'players', user.uid), {
      uid: user.uid,
      email: user.email || '',
      displayName: effectiveDisplayName,
      lastLoginAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      verificationRequired: false,
    }, { merge: true });
    setSyncStatus('Firebase-szinkronizáció aktív');
    await loadLeaderboard();
    if (snapshot.exists() && snapshot.data().gameState) {
      const restoredGameState = { ...snapshot.data().gameState };
      const adminOverride = snapshot.data().adminOverride;
      // An admin edit is authoritative on the next login. Once the player
      // makes a normal game save, the override is cleared below.
      if (adminOverride && Number.isFinite(Number(adminOverride.level))) restoredGameState.level = Math.max(1, Math.round(Number(adminOverride.level)));
      if (adminOverride && Number.isFinite(Number(adminOverride.balance))) restoredGameState.balance = Math.max(0, Math.round(Number(adminOverride.balance)));
      if (adminOverride && Number.isFinite(Number(adminOverride.xp))) restoredGameState.xp = Math.max(0, Math.round(Number(adminOverride.xp)));
      window.VoltStorage?.set('voltmarket-save', JSON.stringify(restoredGameState));
      if (snapshot.data().workshopState) window.VoltStorage?.set('voltmarket-workshop', JSON.stringify(snapshot.data().workshopState));
      if (adminOverride) {
        await setDoc(doc(db, 'players', user.uid), {
          gameState: restoredGameState,
          level: Number(restoredGameState.level || 1),
          balance: Number(restoredGameState.balance || 0),
          xp: Number(restoredGameState.xp || 0),
          adminOverride: null,
          updatedAt: serverTimestamp()
        }, { merge: true });
      }
    }
    activatePlayerStorage(user.uid, true);
    // Do not poll and reload an already-open game in the background. Reloading
    // while the player is working is disruptive and can make the page appear
    // to refresh by itself. Cloud changes are picked up on the next login or
    // by a deliberate browser refresh.
  } catch (error) { console.warn('Player profile sync failed', error); }
});
bannedModalClose?.addEventListener('click', () => { if (bannedModal) bannedModal.hidden = true; });
bannedModal?.addEventListener('click', event => { if (event.target === bannedModal) bannedModal.hidden = true; });
async function loadSupportChat() {
  const user = auth.currentUser;
  if (!user || !supportChatMessages) return;
  const threadUid = supportChatTargetUid || user.uid;
  const adminIsReading = user.email?.toLowerCase() === ADMIN_EMAIL && Boolean(supportChatTargetUid);
  try {
    let messages = [];
    try {
      const snapshot = await getDocs(query(collection(db, 'supportMessages'), where('uid', '==', threadUid)));
      messages = snapshot.docs.map(item => item.data());
      if (adminIsReading) {
        const unreadDocs = snapshot.docs.filter(item => item.data().sender === 'player' && item.data().status === 'new');
        try {
          await Promise.all(unreadDocs.map(item => setDoc(item.ref, { status: 'read', readAt: serverTimestamp() }, { merge: true })));
          messages = messages.map(item => item.sender === 'player' && item.status === 'new' ? { ...item, status: 'read' } : item);
        } catch (readStatusError) { console.warn('Support read status update failed; using admin read marker', readStatusError); }
      }
    } catch (collectionError) {
      const profile = await getDoc(doc(db, 'players', threadUid));
      messages = Array.isArray(profile.data()?.supportMessages) ? profile.data().supportMessages : [];
      if (adminIsReading && messages.some(item => item.sender === 'player' && item.status === 'new')) {
        messages = messages.map(item => item.sender === 'player' && item.status === 'new' ? { ...item, status: 'read', readAt: Date.now() } : item);
        await setDoc(doc(db, 'players', threadUid), { supportMessages: messages, updatedAt: serverTimestamp() }, { merge: true });
      }
    }
    messages.sort((a, b) => Number(a.createdAt || a.createdAt?.toMillis?.() || 0) - Number(b.createdAt || b.createdAt?.toMillis?.() || 0));
    supportChatMessages.innerHTML = messages.length ? messages.map(item => `<div class="support-chat-bubble ${item.sender === 'admin' ? 'is-admin' : 'is-player'}"><p>${escapeHtml(item.message || '')}</p><small>${item.sender === 'admin' ? 'VoltMarket Support' : 'Te'}</small></div>`).join('') : '<p class="support-chat-empty">Írj az adminnak, és itt folytathatjátok a beszélgetést.</p>';
    supportChatMessages.scrollTop = supportChatMessages.scrollHeight;
    if (adminIsReading) {
      try {
        const adminRef = doc(db, 'players', user.uid);
        const adminProfile = await getDoc(adminRef);
        const currentMarkers = adminProfile.data()?.supportReadAtByUid || {};
        await setDoc(adminRef, { supportReadAtByUid: { ...currentMarkers, [threadUid]: Date.now() }, updatedAt: serverTimestamp() }, { merge: true });
      } catch (markerError) { console.warn('Support read marker could not be saved', markerError); }
      supportUnreadByUid.delete(threadUid);
      document.querySelector(`[data-admin-uid="${CSS.escape(threadUid)}"] .support-unread`)?.remove();
    }
  } catch (error) { console.warn('Support chat load failed', error); supportChatMessages.textContent = 'A Support-chat nem tölthető be.'; }
}
function closeSupportChat() { if (!supportChatModal) return; supportChatModal.hidden = true; document.body.classList.remove('support-chat-open'); }
supportButton?.addEventListener('click', async () => { supportChatTargetUid = null; supportChatModal.hidden = false; document.body.classList.add('support-chat-open'); await loadSupportChat(); supportChatInput?.focus(); });
supportChatClose?.addEventListener('click', closeSupportChat);
supportChatModal?.addEventListener('click', event => { if (event.target === supportChatModal) closeSupportChat(); });
supportChatSend?.addEventListener('click', async () => {
  const user = auth.currentUser;
  const message = supportChatInput?.value.trim() || '';
  if (!user || !message) return;
  supportChatSend.disabled = true;
  try {
    const isAdminReply = user.email?.toLowerCase() === ADMIN_EMAIL && supportChatTargetUid;
    const payload = { uid: supportChatTargetUid || user.uid, playerName: isAdminReply ? 'VoltMarketAdmin' : (user.displayName || 'Névtelen játékos'), email: isAdminReply ? ADMIN_EMAIL : (user.email || ''), message, sender: isAdminReply ? 'admin' : 'player', createdAt: Date.now(), status: isAdminReply ? 'read' : 'new' };
    try { await addDoc(collection(db, 'supportMessages'), { ...payload, createdAt: serverTimestamp() }); }
    catch (collectionError) { await setDoc(doc(db, 'players', payload.uid), { supportMessages: arrayUnion(payload), updatedAt: serverTimestamp() }, { merge: true }); }
    supportChatInput.value = '';
    await loadSupportChat();
  } catch (error) { console.warn('Support chat send failed', error); }
  finally { supportChatSend.disabled = false; }
});
supportChatInput?.addEventListener('keydown', event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); supportChatSend?.click(); } });
accountDeleteButton?.addEventListener('click', async () => {
  const user = auth.currentUser;
  if (!user || !confirm('Véglegesen törlöd a saját VoltMarket-profilodat és bejelentkezési fiókodat?')) return;
  accountDeleteButton.disabled = true;
  try {
    await deleteDoc(doc(db, 'players', user.uid));
    await deleteUser(user);
    window.VoltStorage?.remove('voltmarket-save');
    window.VoltStorage?.remove('voltmarket-workshop');
    sessionStorage.removeItem('volt-cloud-restored-user');
    window.location.replace('./auth.html');
  } catch (error) {
    console.warn('Account deletion failed', error);
    setSyncStatus(error?.code === 'auth/requires-recent-login' ? 'A törléshez jelentkezz be újra, majd próbáld ismét.' : 'A profil törlése sikertelen.');
    accountDeleteButton.disabled = false;
  }
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
    if (headerPlayerNameValue) headerPlayerNameValue.textContent = name;
    setSyncStatus('Profil frissítve');
  } catch (error) { setSyncStatus('Profilmentés sikertelen'); console.warn('Profile update failed', error); }
  finally { accountNameSave.disabled = false; }
});
adminLoadPlayers?.addEventListener('click', async () => {
  if (auth.currentUser?.email !== ADMIN_EMAIL) return;
  adminLoadPlayers.disabled = true;
  try {
    const snapshot = await getDocs(collection(db, 'players'));
    const adminProfile = snapshot.docs.find(item => item.id === auth.currentUser.uid)?.data() || {};
    const supportReadAtByUid = adminProfile.supportReadAtByUid || {};
    supportUnreadByUid.clear();
    try {
      const supportSnapshot = await getDocs(collection(db, 'supportMessages'));
      supportSnapshot.docs
        .map(item => item.data())
        .filter(item => item.status === 'new' && item.sender === 'player' && supportMessageTime(item.createdAt) > Number(supportReadAtByUid[item.uid] || 0))
        .forEach(item => supportUnreadByUid.set(item.uid, (supportUnreadByUid.get(item.uid) || 0) + 1));
    } catch (supportError) {
      console.warn('Support unread count could not be loaded', supportError);
      snapshot.docs.flatMap(item => Array.isArray(item.data().supportMessages) ? item.data().supportMessages : [])
        .filter(item => item.status === 'new' && item.sender === 'player' && supportMessageTime(item.createdAt) > Number(supportReadAtByUid[item.uid] || 0))
        .forEach(item => supportUnreadByUid.set(item.uid, (supportUnreadByUid.get(item.uid) || 0) + 1));
    }
    const adminProfile = snapshot.docs.find(item => item.id === auth.currentUser.uid)?.data() || {};
    const bannedEmails = new Set((Array.isArray(adminProfile.bannedEmails) ? adminProfile.bannedEmails : []).map(value => String(value).trim().toLowerCase()));
    adminPlayers.innerHTML = snapshot.docs.filter(item => {
      const player = item.data();
      return player.profileDeleted !== true && player.banned !== true && !bannedEmails.has(String(player.email || '').trim().toLowerCase());
    }).map((item) => {
      const player = item.data();
      const game = player.gameState && typeof player.gameState === 'object' ? player.gameState : {};
      const name = escapeHtml(player.email?.toLowerCase() === ADMIN_EMAIL ? 'VoltMarketAdmin' : (player.displayName || 'Névtelen'));
      const email = escapeHtml(player.email || '');
      const unread = supportUnreadByUid.get(item.id) || 0;
      return `<div class="admin-player" data-admin-uid="${escapeHtml(item.id)}" data-admin-email="${email}" data-admin-name="${name}"><div class="admin-player-main"><strong>${name}</strong><small>${email || 'E-mail nélkül'}</small></div><label>Név<input class="admin-name" value="${name}" maxlength="40"></label><label>Szint<input class="admin-level" type="number" min="1" max="999" value="${Math.max(1, finite(game.level, finite(player.level, 1)))}"></label><label>Kredit<input class="admin-balance" type="number" min="0" value="${Math.max(0, finite(game.balance, finite(player.balance)))}"></label><label>Rangpont<input class="admin-rank-points" type="number" min="0" value="${rankStats(player).score}"></label><span class="admin-player-actions"><button class="small-btn admin-support-player" type="button">💬 Support${unread ? `<b class="support-unread">${unread}</b>` : ''}</button><button class="small-btn admin-save-player" type="button">Mentés</button><button class="small-btn danger admin-delete-player" type="button">Profil törlése</button><button class="small-btn danger admin-ban-player" type="button">Bannolás</button></span></div>`;
    }).join('') || '<p>Nincs még játékosprofil.</p>';
  } catch (error) { adminPlayers.textContent = 'A játékoslista nem tölthető be.'; console.warn('Admin player list failed', error); }
  finally { adminLoadPlayers.disabled = false; }
});

async function deletePlayerSupportMessages(uid, email) {
  const messageDocs = new Map();
  let queryFailed = false;
  const filters = [where('uid', '==', uid)];
  if (email) filters.push(where('email', '==', email));

  for (const filter of filters) {
    try {
      const snapshot = await getDocs(query(collection(db, 'supportMessages'), filter));
      snapshot.docs.forEach(item => messageDocs.set(item.id, item));
    } catch (error) {
      queryFailed = true;
      console.warn('Support message lookup failed during ban', error);
    }
  }

  let deleteFailed = false;
  await Promise.all([...messageDocs.values()].map(async item => {
    try { await deleteDoc(item.ref); }
    catch (error) {
      deleteFailed = true;
      console.warn('Support message deletion failed during ban', error);
    }
  }));

  supportUnreadByUid.delete(uid);
  return { failed: queryFailed || deleteFailed };
}

adminPlayers?.addEventListener('click', async (event) => {
  const row = event.target.closest('[data-admin-uid]');
  if (!row || auth.currentUser?.email !== ADMIN_EMAIL) return;
  if (event.target.closest('.admin-support-player')) {
    supportChatTargetUid = row.dataset.adminUid;
    supportChatModal.hidden = false;
    document.body.classList.add('support-chat-open');
    await loadSupportChat();
    supportChatInput?.focus();
    return;
  }
  const targetRef = doc(db, 'players', row.dataset.adminUid);
  if (event.target.closest('.admin-save-player')) {
    const name = row.querySelector('.admin-name')?.value.trim() || 'Névtelen';
    const levelInput = Number(row.querySelector('.admin-level')?.value);
    const balanceInput = Number(row.querySelector('.admin-balance')?.value);
    const rankPointsInput = Number(row.querySelector('.admin-rank-points')?.value);
    if (!Number.isFinite(levelInput) || !Number.isFinite(balanceInput) || !Number.isFinite(rankPointsInput)) {
      toast('A szint, kredit és rangpont mezőben érvényes számnak kell lennie.');
      return;
    }
    const level = Math.min(999, Math.max(1, Math.round(levelInput)));
    const balance = Math.max(0, Math.round(balanceInput));
    const rankPoints = Math.max(0, Math.round(rankPointsInput));
    try {
      const snapshot = await getDoc(targetRef);
      const current = snapshot.exists() ? snapshot.data() : {};
      // A level can be lowered to any valid level. Reset XP on an admin level
      // change so the normal progression loop cannot immediately level it back
      // up from stale XP stored in the previous game state.
      const gameState = { ...(current.gameState || {}), level, balance, xp: 0 };
      const baseScore = baseRankScore({ ...current, gameState });
      const rankPointAdjustment = rankPoints - baseScore;
      await setDoc(targetRef, {
        displayName: name,
        level,
        balance,
        xp: 0,
        gameState,
        score: rankPoints,
        rankPointAdjustment,
        adminOverride: { level, balance, xp: 0, updatedAt: Date.now() },
        updatedAt: serverTimestamp()
      }, { merge: true });
      const saved = await getDoc(targetRef);
      const savedState = saved.data()?.gameState || {};
      if (Number(savedState.level) !== level || Number(savedState.balance) !== balance || rankStats(saved.data()).score !== rankPoints) throw new Error('Admin state verification failed');
      if (targetRef.id === auth.currentUser.uid) {
        window.VoltStorage?.set('voltmarket-save', JSON.stringify(gameState));
        window.dispatchEvent(new CustomEvent('volt-user-changed', { detail: { uid: targetRef.id } }));
        sessionStorage.setItem('volt-cloud-restored-user', auth.currentUser.uid);
        setSyncStatus('Saját profil frissítve.');
        toast('A saját játékosprofilod frissítve.');
        return;
      }
      setSyncStatus('Játékosprofil frissítve'); await loadLeaderboard(); toast('A játékos profilja frissítve.');
    } catch (error) { console.warn('Admin player update failed', error); toast('A játékos profilja nem frissíthető.'); }
  }
  if (event.target.closest('.admin-delete-player')) {
    if (!confirm('Törlöd ennek a játékosnak a mentett VoltMarket-profilját? A következő belépéskor új játékosnevet és új jelszót kell megadnia.')) return;
    try {
      await setDoc(targetRef, {
        profileDeleted: true,
        deletedAt: serverTimestamp(),
        deletedBy: auth.currentUser.email,
        displayName: '',
        gameState: null,
        workshopState: null,
        level: 1,
        xp: 0,
        balance: 0,
        score: 0,
        rankPointAdjustment: 0,
        adminOverride: null,
        supportMessages: [],
        updatedAt: serverTimestamp()
      }, { merge: true });
      row.remove();
      await loadLeaderboard();
      toast('A profil törölve. Következő belépéskor új név és új jelszó kötelező.');
    }
    catch (error) { console.warn('Admin player delete failed', error); toast('A játékos profilja nem törölhető.'); }
  }
  if (event.target.closest('.admin-ban-player')) {
    const emailFromRow = (row.dataset.adminEmail || row.querySelector('.admin-player-main small')?.textContent || '').trim().toLowerCase();
    let email = emailFromRow;
    try {
      const current = await getDoc(targetRef);
      email = String(current.data()?.email || emailFromRow).trim().toLowerCase();
    } catch (error) { console.warn('Could not read canonical player email', error); }
    if (email === ADMIN_EMAIL) return toast('Az adminfiók nem bannolható.');
    if (!email || !confirm(`Bannolod a(z) ${email} címet? Ezzel később sem lehet új profilt regisztrálni.`)) return;
    try {
      const banRecord = { email, uid: row.dataset.adminUid, bannedAt: Date.now(), bannedBy: auth.currentUser.email };
      let registrySaved = false;
      let directSaved = false;
      let playerFlagSaved = false;
      try {
        const adminRef = doc(db, 'players', auth.currentUser.uid);
        const adminSnapshot = await getDoc(adminRef);
        const currentBans = Array.isArray(adminSnapshot.data()?.bannedEmails) ? adminSnapshot.data().bannedEmails : [];
        await setDoc(adminRef, { bannedEmails: [...new Set([...currentBans.map(value => String(value).trim().toLowerCase()), email])], updatedAt: serverTimestamp() }, { merge: true });
        registrySaved = true;
      } catch (registryError) { console.warn('Admin ban registry write failed', registryError); }
      try { await setDoc(doc(db, 'bannedEmails', email), banRecord, { merge: true }); directSaved = true; }
      catch (banRecordError) { console.warn('Banned e-mail collection write failed; using registry fallback', banRecordError); }
      const messageCleanup = await deletePlayerSupportMessages(row.dataset.adminUid, email);
      // Keep a tombstone on the target profile as an additional fallback and
      // remove legacy messages stored directly in the player document.
      try { await setDoc(targetRef, { banned: true, bannedAt: serverTimestamp(), bannedBy: auth.currentUser.email, supportMessages: [] }, { merge: true }); playerFlagSaved = true; }
      catch (playerFlagError) { console.warn('Player ban flag write failed; registry fallback remains active', playerFlagError); }
      if (!registrySaved && !directSaved && !playerFlagSaved) throw new Error('No ban record could be written');
      row.remove();
      await loadLeaderboard();
      if (messageCleanup.failed) toast('A profil bannolva, de néhány Support-üzenet nem volt törölhető.');
      else toast('A profil bannolva, a Support-üzenetei törölve.');
    } catch (error) { console.warn('Admin player ban failed', error); toast('A bannolás sikertelen.'); }
  }
});
document.body.classList.add('auth-required');

window.addEventListener('volt-state-changed', (event) => {
  const user = auth.currentUser;
  if (!user || !event.detail) return;
  setSyncStatus('Mentés a felhőbe…');
  clearTimeout(syncTimer);
  syncTimer = setTimeout(async () => {
    try {
      const playerRef = doc(db, 'players', user.uid);
      const current = await getDoc(playerRef);
      if (current.data()?.profileDeleted === true) {
        clearTimeout(syncTimer);
        await signOut(auth);
        window.location.replace('./auth.html');
        return;
      }
      const override = current.data()?.adminOverride;
      const nextState = { ...event.detail };
      // If an older tab sends its stale state after an admin edit, preserve the
      // freshly edited values once, then clear the override normally.
      if (override && Number.isFinite(Number(override.level))) nextState.level = Math.max(1, Math.round(Number(override.level)));
      if (override && Number.isFinite(Number(override.balance))) nextState.balance = Math.max(0, Math.round(Number(override.balance)));
      if (override && Number.isFinite(Number(override.xp))) nextState.xp = Math.max(0, Math.round(Number(override.xp)));
      await setDoc(playerRef, {
        uid: user.uid,
        email: user.email || '',
        displayName: user.displayName || '',
        gameState: nextState,
        adminOverride: null,
        workshopState: (() => { try { return JSON.parse(window.VoltStorage?.get('voltmarket-workshop') || 'null'); } catch { return null; } })(),
        level: Number(nextState.level || 1),
        xp: Number(nextState.xp || 0),
        balance: Number(nextState.balance || 0),
        score: Number(nextState.balance || 0) + Number(nextState.level || 1) * 10000 + Number(nextState.xp || 0),
        updatedAt: serverTimestamp(),
      }, { merge: true });
      setSyncStatus('Felhőbe mentve');
    } catch (error) { setSyncStatus('Felhőmentés sikertelen'); console.warn('Cloud save failed', error); }
  }, 500);
  setTimeout(loadLeaderboard, 700);
});
window.addEventListener('volt-game-reset', async (event) => {
  const user = auth.currentUser;
  const gameState = event.detail?.gameState;
  if (!user || !gameState) return;
  clearTimeout(syncTimer);
  setSyncStatus('Játékállás törlése a felhőből…');
  try {
    await setDoc(doc(db, 'players', user.uid), {
      uid: user.uid,
      email: user.email || '',
      displayName: user.displayName || '',
      gameState,
      workshopState: null,
      level: Number(gameState.level || 1),
      xp: Number(gameState.xp || 0),
      balance: Number(gameState.balance || 0),
      score: 0,
      adminOverride: null,
      resetAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }, { merge: true });
    setSyncStatus('A játék újrakezdve és a felhőmentés törölve.');
    await loadLeaderboard();
  } catch (error) {
    setSyncStatus('A felhőmentés törlése sikertelen.');
    console.warn('Cloud reset failed', error);
  }
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
const publicPlayerName = player => player.email?.toLowerCase() === ADMIN_EMAIL ? 'VoltMarketAdmin' : (player.displayName || 'Névtelen játékos');
function rankStats(player) {
  const game = player.gameState && typeof player.gameState === 'object' ? player.gameState : {};
  const workshop = player.workshopState && typeof player.workshopState === 'object' ? player.workshopState : {};
  const balance = finite(game.balance, finite(player.balance));
  const level = Math.max(1, finite(game.level, finite(player.level, 1)));
  const xp = Math.max(0, finite(game.xp, finite(player.xp)));
  const owned = Array.isArray(game.owned) ? game.owned.length : 0;
  const finished = Array.isArray(workshop.finished) ? workshop.finished.length : (Array.isArray(game.history) ? game.history.filter(item => finite(item?.amount) > 0).length : 0);
  const score = Math.max(0, baseRankScore(player) + Math.round(finite(player.rankPointAdjustment)));
  return { balance, level, xp, owned, finished, score, game, workshop };
}
function baseRankScore(player) {
  const game = player.gameState && typeof player.gameState === 'object' ? player.gameState : {};
  const workshop = player.workshopState && typeof player.workshopState === 'object' ? player.workshopState : {};
  const level = Math.max(1, finite(game.level, finite(player.level, 1)));
  const xp = Math.max(0, finite(game.xp, finite(player.xp)));
  const owned = Array.isArray(game.owned) ? game.owned.length : 0;
  const finished = Array.isArray(workshop.finished) ? workshop.finished.length : (Array.isArray(game.history) ? game.history.filter(item => finite(item?.amount) > 0).length : 0);
  const history = Array.isArray(game.history) ? game.history : [];
  const earnedCredits = history.reduce((sum, item) => sum + Math.max(0, finite(item?.amount)), 0);
  return Math.max(0, Math.floor(earnedCredits / 1000) + Math.max(0, level - 1) * 100 + Math.floor(xp / 10) + owned * 25 + finished * 50);
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
  const stores = [[workshop.storeOwned, '🏪', 'Alapüzlet'], [workshop.franchiseOwned, '🏢', 'Franchise üzlet'], [workshop.flagshipOwned, '🚀', 'Prémium üzlet']].filter(item => item[0]);
  const equipmentNames = { phone: ['📱', 'Telefon'], laptop: ['💻', 'Laptop'], monitor: ['🖥️', 'Monitor'], pc: ['🧰', 'Gamer PC'], headset: ['🎧', 'Fejhallgató'], glasses: ['🥽', 'XR szemüveg'], mic: ['🎙️', 'Mikrofon'], keyboard: ['⌨️', 'Billentyűzet'], mouse: ['🖱️', 'Egér'], smart: ['🔴', 'Okosközpont'], chair: ['🪑', 'Gamer szék'], consoleStation: ['🎮', 'Konzolállomás'], vrToolkit: ['🥽', 'VR kalibrátor'], racingRig: ['🏎️', 'Kormánytesztelő'], controller: ['🕹️', 'Kontroller'] };
  const equipmentChips = equipment.length ? equipment.map(id => { const item = equipmentNames[id] || ['◆', id]; return `<span class="business-chip">${item[0]} ${escapeHtml(item[1])}</span>`; }).join('') : '<span class="business-muted">Még nincs felszerelés</span>';
  const storeChips = stores.length ? stores.map(item => `<span class="business-chip">${item[1]} ${item[2]}</span>`).join('') : '<span class="business-muted">Még csak az alapüzlet épül</span>';
  const name = escapeHtml(publicPlayerName(player));
  businessModalContent.innerHTML = `<div class="business-profile-kicker">VOLTMarket üzleti profil</div><h2 id="playerBusinessTitle">${name} üzlete</h2><p class="business-profile-intro">Gyors áttekintés arról, hol tart ez a játékos a fejlesztésben.</p><div class="business-profile-stats"><div><span>🏆 HELYEZÉS</span><strong>#${player.rank || '–'}</strong></div><div><span>⚡ SZINT</span><strong>${stats.level}</strong></div><div><span>◈ KREDIT</span><strong>${stats.balance.toLocaleString('hu-HU')} CR</strong></div><div><span>✦ XP</span><strong>${stats.xp.toLocaleString('hu-HU')}</strong></div></div><div class="business-profile-grid"><article><span class="eyebrow">🧰 FELSZERELÉS</span><div class="business-chip-list">${equipmentChips}</div><div class="business-progress-line"><span>Előrehaladás</span><strong>${equipment.length} eszköz · ${stats.finished} teljesített eredmény</strong></div></article><article><span class="eyebrow">🏭 MŰHELY</span><div class="business-progress-list"><div><span>🔧</span><strong>${projects} aktív projekt</strong></div><div><span>📦</span><strong>${finished} kész termék</strong></div><div><span>👥</span><strong>${employees} alap munkatárs · ${technicians} technikus</strong></div></div></article><article class="business-profile-wide"><span class="eyebrow">🏪 ÜZLETEK ÉS FEJLESZTÉS</span><div class="business-chip-list">${storeChips}</div></article></div>`;
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
    const players = snapshot.docs.map(item => ({ ...item.data(), uid: item.id })).filter(player => !player.profileDeleted && !player.banned).sort((a, b) => rankStats(b).score - rankStats(a).score || rankStats(b).level - rankStats(a).level || String(a.displayName || '').localeCompare(String(b.displayName || ''), 'hu'));
    leaderboardPlayers = new Map(players.map((player, index) => [player.uid, { ...player, rank: index + 1 }]));
    const playerButton = (player, index, className = '') => `<button type="button" class="${className}" data-player-profile="${escapeHtml(player.uid)}"><span class="leader-rank">${index + 1}</span><strong>${escapeHtml(publicPlayerName(player))}</strong><small>${rankStats(player).score.toLocaleString('hu-HU')} pont</small></button>`;
    leaderboard.innerHTML = players.length ? `<div class="leaderboard-podium">${players.slice(0, 3).map((player, index) => playerButton(player, index, `leader-card rank-${index + 1}`)).join('')}</div><div class="leaderboard-list">${players.slice(3).map((player, index) => `<button type="button" class="leader-row" data-player-profile="${escapeHtml(player.uid)}"><span>${index + 4}.</span><strong>${escapeHtml(publicPlayerName(player))}</strong><small>${rankStats(player).score.toLocaleString('hu-HU')} pont</small></button>`).join('')}</div>` : '<p class="leaderboard-empty">Még nincs rangsorolt játékos.</p>';
  } catch (error) { leaderboard.innerHTML = '<p class="leaderboard-empty">A ranglista most nem tölthető be.</p>'; console.warn('Leaderboard failed', error); }
}
leaderboard?.addEventListener('click', event => { const target = event.target.closest('[data-player-profile]'); const player = target && leaderboardPlayers.get(target.dataset.playerProfile); if (player) renderBusinessProfile(player); });
