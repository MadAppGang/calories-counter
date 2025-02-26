// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  User,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult 
} from "firebase/auth";
import { getAnalytics } from "firebase/analytics";
import { 
  getFirestore, 
  collection, 
  query, 
  where, 
  orderBy, 
  getDocs, 
  doc, 
  addDoc, 
  deleteDoc, 
  getDoc, 
  updateDoc, 
  serverTimestamp, 
  Timestamp 
} from "firebase/firestore";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyD6y2R8PdU2l-bbLBVXz_F7s1rXprBspXs",
  authDomain: "caloriescounter-432de.firebaseapp.com",
  projectId: "caloriescounter-432de",
  storageBucket: "caloriescounter-432de.firebasestorage.app",
  messagingSenderId: "188202579094",
  appId: "1:188202579094:web:de9076947b4f69d24a7eb7",
  measurementId: "G-21RRGSGDEZ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const analytics = getAnalytics(app);
const db = getFirestore(app);

// Collection names
export const COLLECTIONS = {
  MEALS: 'meals'
};

// Initialize Google Auth Provider
const googleProvider = new GoogleAuthProvider();
// Add scopes if needed
googleProvider.addScope('https://www.googleapis.com/auth/userinfo.email');
googleProvider.addScope('https://www.googleapis.com/auth/userinfo.profile');

export { 
  auth, 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  analytics,
  googleProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  db,
  // Firestore functions
  collection,
  query,
  where,
  orderBy,
  getDocs,
  doc,
  addDoc,
  deleteDoc,
  getDoc,
  updateDoc,
  serverTimestamp,
  Timestamp
};
export type { User }; 