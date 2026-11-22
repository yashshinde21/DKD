import 'dotenv/config';

import {initializeApp, cert, getApps} from 'firebase-admin/app';
import {getFirestore} from 'firebase-admin/firestore';

const credentialsBase64 =
  process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;

if (!credentialsBase64) {
  throw new Error('Firebase credentials are missing.');
}

const serviceAccount = JSON.parse(
  Buffer.from(credentialsBase64, 'base64').toString('utf8'),
);

const firebaseApp =
  getApps().length > 0
    ? getApps()[0]
    : initializeApp({
        credential: cert(serviceAccount),
      });

const db = getFirestore(firebaseApp);

export {db};
