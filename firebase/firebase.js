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

let jlyViewRuntimePromise = null;

async function ensureJlyViewRuntime() {
  if (window.JLYViewRuntimeLoader) {
    return window.JLYViewRuntimeLoader.ensure();
  }

  if (!jlyViewRuntimePromise) {
    jlyViewRuntimePromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "/js/data-view/view-runtime-loader.js?v=2";
      script.async = true;
      script.onload = async () => {
        try {
          resolve(await window.JLYViewRuntimeLoader.ensure());
        } catch (error) {
          reject(error);
        }
      };
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  return jlyViewRuntimePromise;
}

async function syncCarViewsFromKnownMutation(beforeCar, afterCar, changedFields) {
  try {
    const runtime = await ensureJlyViewRuntime();
    return await runtime.coordinator.updateCarViews({
      beforeCar: beforeCar || null,
      afterCar: afterCar || null,
      changedFields: Array.isArray(changedFields) ? changedFields : []
    });
  } catch (error) {
    // Core 已成功寫入時不可讓使用者重送同一個建立／修改動作。
    // View 失敗必須由明確 Repair 處理，不在這裡重掃 Core。
    console.error("Car View 增量同步失敗，需人工 Repair：", error);
    return [{ type: "car_view", ok: false, repairRequired: true, error }];
  }
}

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
window.syncCarViewsFromKnownMutation = syncCarViewsFromKnownMutation;

console.log("Firebase 初始化完成！");
