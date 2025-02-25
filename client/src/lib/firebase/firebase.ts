// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, User } from "firebase/auth";
import { getAnalytics } from "firebase/analytics";

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

export { auth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, analytics };
export type { User }; 