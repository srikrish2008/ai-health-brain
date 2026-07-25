import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDxYBBKOOHJv0FQVNuJbOWLKpKGuwaZWhc",
  authDomain: "ai-health-brain.firebaseapp.com",
  projectId: "ai-health-brain",
  storageBucket: "ai-health-brain.firebasestorage.app",
  messagingSenderId: "863149939106",
  appId: "1:863149939106:web:6aac8a155c470d2274fafb"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Services
export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;
