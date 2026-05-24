/**
 * Example Node script to set custom claim `admin:true` for a user.
 * Usage: node set-admin-claim.js <uid>
 * Requires: serviceAccountKey.json (Firebase Admin SDK service account)
 */
const admin = require('firebase-admin');
const fs = require('fs');

if (!fs.existsSync('./serviceAccountKey.json')) {
  console.error('serviceAccountKey.json not found. Place your service account key in project root.');
  process.exit(1);
}

admin.initializeApp({ credential: admin.credential.cert(require('./serviceAccountKey.json')) });

const uid = process.argv[2];
if (!uid) { console.error('Provide uid as first arg'); process.exit(1); }

admin.auth().setCustomUserClaims(uid, { admin: true }).then(() => {
  console.log('Custom claim set for', uid);
  process.exit(0);
}).catch(err => { console.error(err); process.exit(1); });
