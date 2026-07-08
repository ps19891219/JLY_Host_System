console.log("firebase.js 已成功載入！");

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

// 初始化 Firebase
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

// 建立 Firestore
const db = firebase.firestore();

// 給其他 JS 使用
window.db = db;

// 儲存車團
async function saveCarToFirebase(car) {
  const now = new Date().toISOString();

  const carData = {
    ...car,
    createdAt: car.createdAt || now,
    updatedAt: now
  };

  const carRef = await db.collection("cars").add(carData);

  await autoSaveMasterData("scripts", car.scriptName, {
    defaultTotalPeople: car.totalPeople || 0,
    defaultMaleSlots: car.maleSlots || 0,
    defaultFemaleSlots: car.femaleSlots || 0,
    defaultPrice: car.price || 0
  });

  await autoSaveMasterData("studios", car.studioName, {});
  await autoSaveMasterData("dms", car.dmName, {});

  return carRef.id;
}

// 自動建立主資料
async function autoSaveMasterData(collectionName, name, extraData = {}) {
  if (!name) return;

  const now = new Date().toISOString();

  const snapshot = await db
    .collection(collectionName)
    .where("name", "==", name)
    .limit(1)
    .get();

  if (snapshot.empty) {
    await db.collection(collectionName).add({
      name,
      useCount: 1,
      createdAt: now,
      lastUsedAt: now,
      ...extraData
    });
  } else {
    const doc = snapshot.docs[0];
    const data = doc.data();

    await db
      .collection(collectionName)
      .doc(doc.id)
      .update({
        useCount: (data.useCount || 0) + 1,
        lastUsedAt: now,
        ...extraData
      });
  }
}

window.saveCarToFirebase = saveCarToFirebase;
window.autoSaveMasterData = autoSaveMasterData;

console.log("Firebase 初始化完成！");