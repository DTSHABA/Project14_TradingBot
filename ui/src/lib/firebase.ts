import { initializeApp, type FirebaseOptions } from 'firebase/app';
import { getAuth, GoogleAuthProvider, connectAuthEmulator } from 'firebase/auth';

// Default production Firebase config (hardcoded as fallback - ensures it always works)
const DEFAULT_FIREBASE_CONFIG: FirebaseOptions = {
  apiKey: "AIzaSyAijr2peSKkNWRH0j3qMmb_Ve6pIwjp9dE",
  authDomain: "my-first-project-31367.firebaseapp.com",
  projectId: "my-first-project-31367",
  storageBucket: "my-first-project-31367.firebasestorage.app",
  messagingSenderId: "734914644733",
  appId: "1:734914644733:web:1971a0bbf025b41e0a0c94",
  measurementId: "G-6PTW5WWK3E"
};

// Import firebase-config.json (Vite will bundle this at build time)
// If file doesn't exist or has demo values, we'll use DEFAULT_FIREBASE_CONFIG as fallback
let firebaseConfigJson: Partial<FirebaseOptions> = {};
try {
  // Regular ES module import - Vite handles this at build time
  const configModule = require('./firebase-config.json');
  firebaseConfigJson = configModule.default || configModule;
  
  // Validate imported config is not demo values
  if (firebaseConfigJson.apiKey?.includes('demo') || 
      firebaseConfigJson.apiKey === 'demo-api-key' ||
      firebaseConfigJson.apiKey?.includes('DemoKeyForLocalDevelopment')) {
    console.warn('⚠️ firebase-config.json contains demo values, using default production config');
    firebaseConfigJson = {};
  }
} catch (e) {
  // File doesn't exist or can't be imported - use default
  console.warn('⚠️ firebase-config.json not found, using default production config');
}

// Build Firebase config from environment variables, JSON file, or defaults (in that order of precedence)
const buildFirebaseConfig = (): FirebaseOptions => {
  // Check if environment variables are provided (highest priority)
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

  // Merge: environment variables > JSON file > defaults
  const config: FirebaseOptions = {
    ...DEFAULT_FIREBASE_CONFIG,
    ...firebaseConfigJson,
    ...envConfig,
  } as FirebaseOptions;

  // Validate required fields - check for demo keys (including the specific one seen in errors)
  if (!config.apiKey || 
      config.apiKey === 'demo-api-key' || 
      config.apiKey.includes('demo') ||
      config.apiKey.includes('DemoKeyForLocalDevelopment')) {
    console.error('❌ Firebase API key is missing or invalid!');
    console.error('Detected demo/invalid API key:', config.apiKey);
    console.error('Using hardcoded production config as fallback');
    // Don't throw - use the DEFAULT_FIREBASE_CONFIG instead
    return DEFAULT_FIREBASE_CONFIG;
  }

  if (!config.projectId || config.projectId === 'demo-project') {
    console.error('❌ Firebase project ID is missing or invalid!');
    throw new Error('Invalid Firebase project ID. Please configure Firebase in firebase-config.json or via environment variables.');
  }

  console.log(`✅ Firebase initialized with project: ${config.projectId}`);
  if (envConfig.apiKey) {
    console.log('📝 Using Firebase config from environment variables');
  } else if (firebaseConfigJson.apiKey && !firebaseConfigJson.apiKey.includes('demo')) {
    console.log('📝 Using Firebase config from firebase-config.json');
  } else {
    console.log('📝 Using hardcoded production Firebase config (fallback)');
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