import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  getAuth,
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
  getDoc,
  onAuthStateChanged,
  sendPasswordResetEmail,
  serverTimestamp,
  setDoc,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  userDoc: (uid) => doc(db, 'players', uid),
};

window.VoltFirebase = api;
window.dispatchEvent(new CustomEvent('volt-firebase-ready', { detail: api }));

const gate = document.querySelector('#authGate');
const form = document.querySelector('#authForm');
const nameField = document.querySelector('#authNameField');
const nameInput = document.querySelector('#authName');
const emailInput = document.querySelector('#authEmail');
const passwordInput = document.querySelector('#authPassword');
const submitButton = document.querySelector('#authSubmit');
const modeButton = document.querySelector('#authMode');
const resetButton = document.querySelector('#authReset');
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
  setStatus('');
}
function authError(error) {
  const messages = {
    'auth/invalid-credential': 'Hibás e-mail vagy jelszó.',
    'auth/email-already-in-use': 'Ez az e-mail már használatban van.',
    'auth/weak-password': 'A jelszó legalább 6 karakter legyen.',
    'auth/invalid-email': 'Érvénytelen e-mail-cím.',
    'auth/too-many-requests': 'Túl sok próbálkozás. Próbáld meg később.',
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
    gameState: null,
  }, { merge: true });
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
    } else await signInWithEmailAndPassword(auth, email, password);
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
    }, { merge: true });
    setSyncStatus('Firebase-szinkronizáció aktív');
    if (snapshot.exists() && snapshot.data().gameState) {
      localStorage.setItem('voltmarket-save', JSON.stringify(snapshot.data().gameState));
      if (!sessionStorage.getItem('volt-cloud-restored')) {
        sessionStorage.setItem('volt-cloud-restored', '1');
        window.location.reload();
      }
    }
  } catch (error) { console.warn('Player profile sync failed', error); }
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
    level: Number(event.detail.level || 1),
    xp: Number(event.detail.xp || 0),
    balance: Number(event.detail.balance || 0),
    updatedAt: serverTimestamp(),
  }, { merge: true }).then(() => setSyncStatus('Felhőbe mentve')).catch((error) => { setSyncStatus('Felhőmentés sikertelen'); console.warn('Cloud save failed', error); }), 500);
});
