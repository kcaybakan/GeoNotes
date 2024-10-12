// src/firebase.js

import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore"; // Firestore için
import { getStorage } from "firebase/storage"; // Firebase Storage için

// Firebase config bilgileri
const firebaseConfig = {
    apiKey: "AIzaSyDBWUVQM4q95D6zvhEJl-AhNNvBYuAdRFo",
    authDomain: "geonote-ee003.firebaseapp.com",
    projectId: "geonote-ee003",
    storageBucket: "geonote-ee003.appspot.com",
    messagingSenderId: "834861403861",
    appId: "1:834861403861:web:cba4ea6b79dc0b3607dc5c"
};

// Firebase'i başlat
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);  // Firestore veritabanı
const storage = getStorage(app); // Firebase Storage

export { db, storage }; // Diğer dosyalarda db ve storage kullanmak için export et
