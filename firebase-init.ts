import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
    apiKey: "AIzaSyBTK8altmAR-fWqR9BjE74gEGavuiqk1Bs",
    authDomain: "gastos-2n.firebaseapp.com",
    projectId: "gastos-2n",
    storageBucket: "gastos-2n.firebasestorage.app",
    messagingSenderId: "55010048795",
    appId: "1:55010048795:web:4fb48d1e0f9006ebf7b1be"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;
