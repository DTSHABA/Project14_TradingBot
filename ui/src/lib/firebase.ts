import { initializeApp, type FirebaseOptions } from 'firebase/app';
import { getAuth, GoogleAuthProvider, connectAuthEmulator } from 'firebase/auth';
import firebaseConfigJson from './firebase-config.json';

// Build Firebase config from JSON file or environment variables (env vars take precedence)
const buildFirebaseConfig = (): FirebaseOptions => {
  // Check if environment variables are provided (for production overrides)
  const envConfig: Partial<FirebaseOptions> = {};
  
  if (import.meta.env.VITE_FIREBASE_API_KEY) {
    envConfig.apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
  }
  if (import.meta.env.VITE_FIREBASE_AUTH_DOMAIN) {
    envConfig.authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN;
  }
  if (import.meta.env.VITE_FIREBASE_PROJECT_ID) {
    envConfig.projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
  }
  if (import.meta.env.VITE_FIREBASE_STORAGE_BUCKET) {
    envConfig.storageBucket = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET;
  }
  if (import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID) {
    envConfig.messagingSenderId = import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID;
  }
  if (import.meta.env.VITE_FIREBASE_APP_ID) {
    envConfig.appId = import.meta.env.VITE_FIREBASE_APP_ID;
  }
  if (import.meta.env.VITE_FIREBASE_MEASUREMENT_ID) {
    envConfig.measurementId = import.meta.env.VITE_FIREBASE_MEASUREMENT_ID;
  }

  // Merge: environment variables override JSON file
  const config: FirebaseOptions = {
    ...firebaseConfigJson,
    ...envConfig,
  } as FirebaseOptions;

  // Validate required fields
  if (!config.apiKey || config.apiKey === 'demo-api-key' || config.apiKey.includes('demo')) {
    console.error('❌ Firebase API key is missing or invalid!');
    console.error('Please update ui/src/lib/firebase-config.json with your Firebase config from Firebase Console.');
    throw new Error('Invalid Firebase API key. Please configure Firebase in firebase-config.json or via environment variables.');
  }

  if (!config.projectId || config.projectId === 'demo-project') {
    console.error('❌ Firebase project ID is missing or invalid!');
    throw new Error('Invalid Firebase project ID. Please configure Firebase in firebase-config.json or via environment variables.');
  }

  console.log(`✅ Firebase initialized with project: ${config.projectId}`);
  if (envConfig.apiKey) {
    console.log('📝 Using Firebase config from environment variables');
  } else {
    console.log('📝 Using Firebase config from firebase-config.json');
  }

  return config;
};

const firebaseConfig = buildFirebaseConfig();

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Connect to Firebase Auth emulator only when explicitly enabled
if (import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true') {
  try {
    const firebaseAuthPort = import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_PORT || '9099';
    const emulatorUrl = `http://localhost:${firebaseAuthPort}`;
    connectAuthEmulator(auth, emulatorUrl, { disableWarnings: true });
    console.log(`🧪 Connected to Firebase Auth emulator at ${emulatorUrl}`);
  } catch (error) {
    // Emulator already connected or not available
    console.debug('Firebase Auth emulator connection skipped:', error);
  }
} else {
  console.log(`🏭 Using production Firebase Auth (Project: ${firebaseConfig.projectId})`);
} 