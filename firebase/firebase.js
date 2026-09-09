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

// iPhone Safari / 部分行動網路會讓 Firestore WebChannel 長時間停在 pending。
// 直接強制 long-polling，避免自動偵測仍卡在 WebChannel。
try {
  db.settings({ experimentalForceLongPolling: true });
} catch (error) {
  // settings 只能在 Firestore 第一次使用前套用；若其他入口已先使用，保留既有設定即可。
  console.warn("Firestore transport settings skipped:", error);
}

// Work Schedule 專用唯讀 fallback。
// 正常情況仍走 Firebase SDK；若 mobile Safari 的 Query.get() 卡住超過 2.5 秒，
// 以 Firestore REST structuredQuery 讀取同一份 workShifts 資料。
// 只包裝 Work Schedule 頁的 workShifts 查詢，不影響其他 collection，也不改寫寫入流程。
if (typeof window !== "undefined" && /\/pages\/work-schedule\.html$/.test(window.location.pathname)) {
  const nativeCollection = db.collection.bind(db);

  function decodeFirestoreValue(value) {
    if (!value || typeof value !== "object") return null;
    if ("nullValue" in value) return null;
    if ("stringValue" in value) return value.stringValue;
    if ("booleanValue" in value) return value.booleanValue;
    if ("integerValue" in value) return Number(value.integerValue);
    if ("doubleValue" in value) return Number(value.doubleValue);
    if ("timestampValue" in value) return value.timestampValue;
    if ("referenceValue" in value) return value.referenceValue;
    if ("geoPointValue" in value) return value.geoPointValue;
    if ("arrayValue" in value) {
      return (value.arrayValue.values || []).map(decodeFirestoreValue);
    }
    if ("mapValue" in value) {
      return decodeFirestoreFields(value.mapValue.fields || {});
    }
    return null;
  }

  function decodeFirestoreFields(fields) {
    const out = {};
    Object.entries(fields || {}).forEach(([key, value]) => {
      out[key] = decodeFirestoreValue(value);
    });
    return out;
  }

  async function readWorkShiftsByRest(monthKey) {
    const projectId = firebase.app().options.projectId;
    const apiKey = firebase.app().options.apiKey;
    const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents:runQuery?key=${encodeURIComponent(apiKey)}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: "workShifts" }],
          where: {
            fieldFilter: {
              field: { fieldPath: "monthKey" },
              op: "EQUAL",
              value: { stringValue: monthKey }
            }
          }
        }
      })
    });
    if (!response.ok) {
      throw new Error(`Firestore REST ${response.status}`);
    }
    const payload = await response.json();
    const docs = (Array.isArray(payload) ? payload : [])
      .filter(item => item && item.document)
      .map(item => {
        const document = item.document;
        const id = String(document.name || "").split("/").pop();
        const data = decodeFirestoreFields(document.fields || {});
        return { id, data: () => data };
      });
    return { docs, empty: docs.length === 0 };
  }

  function wrapQuery(query, filters) {
    return new Proxy(query, {
      get(target, prop) {
        if (prop === "where") {
          return (field, op, value) => wrapQuery(target.where(field, op, value), [...filters, { field, op, value }]);
        }
        if (prop === "get") {
          return async (...args) => {
            const monthFilter = filters.find(f => f.field === "monthKey" && f.op === "==" && typeof f.value === "string");
            if (!monthFilter) return target.get(...args);

            const nativePromise = target.get(...args);
            const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("SDK_QUERY_TIMEOUT")), 2500));
            try {
              return await Promise.race([nativePromise, timeout]);
            } catch (error) {
              if (error?.message !== "SDK_QUERY_TIMEOUT") {
                console.warn("Work Schedule SDK query failed, trying REST fallback:", error);
              } else {
                console.warn("Work Schedule SDK query timed out, using REST fallback.");
              }
              return readWorkShiftsByRest(monthFilter.value);
            }
          };
        }
        const value = Reflect.get(target, prop, target);
        return typeof value === "function" ? value.bind(target) : value;
      }
    });
  }

  db.collection = function patchedCollection(name) {
    const collection = nativeCollection(name);
    if (name !== "workShifts") return collection;
    return new Proxy(collection, {
      get(target, prop) {
        if (prop === "where") {
          return (field, op, value) => wrapQuery(target.where(field, op, value), [{ field, op, value }]);
        }
        const value = Reflect.get(target, prop, target);
        return typeof value === "function" ? value.bind(target) : value;
      }
    });
  };
}

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
