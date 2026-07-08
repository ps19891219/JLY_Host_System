// Firebase 設定
const firebaseConfig = {
  apiKey: "AIzaSyCUCSAkNXkxiLupfFRlo4XIjyB-KXfr0gE",
  authDomain: "jly-host-system.firebaseapp.com",
  projectId: "jly-host-system",
  storageBucket: "jly-host-system.firebasestorage.app",
  messagingSenderId: "600556274479",
  appId: "1:600556274479:web:2acfc0bcf3472fff13d7da",
  measurementId: "G-25N3VWQT8L"
};

// 初始化 Firebase（避免重複初始化）
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

// 建立 Firestore
const db = firebase.firestore();

// 提供給其他 JS 使用
window.db = db;

console.log("✅ Firebase 初始化完成");