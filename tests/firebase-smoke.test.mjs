import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (name) => readFile(new URL(name, root), 'utf8');

test('Firebase web configuration is present', async () => {
  const config = await read('firebase-config.js');
  assert.match(config, /projectId:\s*'voltmarket-17bbc'/);
  assert.match(config, /appId:/);
});

test('Firebase auth module is wired into the page', async () => {
  const html = await read('index.html');
  const auth = await read('firebase-auth.js');
  assert.match(html, /firebase-auth\.js/);
  assert.match(auth, /createUserWithEmailAndPassword/);
  assert.match(auth, /onAuthStateChanged/);
  assert.match(auth, /volt-state-changed/);
});

test('Firestore rules protect player documents', async () => {
  const rules = await read('firestore.rules');
  assert.match(rules, /match \/players\/\{userId\}/);
  assert.match(rules, /request\.auth\.uid == userId/);
  assert.match(rules, /martin\.roszoly2002@gmail\.com/);
});

test('auth keeps normal, deleted, and banned profiles on separate paths', async () => {
  const auth = await read('firebase-auth.js');
  const authHtml = await read('auth.html');
  assert.match(auth, /profile\.data\(\)\?\.profileDeleted === true/);
  assert.match(auth, /if \(!profile\.exists\(\)\) await persistNewPlayer/);
  assert.match(auth, /volt-banned-login/);
  assert.match(authHtml, /A profilodat töröltük/);
  assert.match(authHtml, /deletedProfileName/);
  assert.doesNotMatch(authHtml, /deletedProfilePassword/);
});
