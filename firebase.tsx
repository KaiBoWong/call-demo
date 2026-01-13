// firebase.tsx
import auth from "@react-native-firebase/auth"
import { getFirestore } from "firebase/firestore"

// Firebase config (optional for @react-native-firebase, usually in Android/iOS native)
const firebaseConfig = {
  apiKey: "AIzaSyBIPufNAXKIdIzH-B18kX5TYv1pdLmwJd8",
  authDomain: "call-demo-b3572.firebaseapp.com",
  projectId: "call-demo-b3572",
  storageBucket: "call-demo-b3572.firebasestorage.app",
  messagingSenderId: "591274877463",
  appId: "1:591274877463:android:61480ccfbef4acddd37252",
}

// Firestore setup using the web SDK
import { getApp, getApps, initializeApp } from "firebase/app"
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp()
export const db = getFirestore(app)

// Export the native auth instance (persistent by default)
export { auth }
export default app
