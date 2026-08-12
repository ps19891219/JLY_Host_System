console.log(
  "myprofile.js 已成功載入！"
);

console.log(
  "saveMyProfile 函式準備載入"
);

// ============================================================
// 基本工具
// ============================================================

function normalizeMyProfileText(
  value
) {
  return String(
    value == null
      ? ""
      : value
  ).trim();
}

function normalizeMyProfileIds(
  values
) {
  const source =
    Array.isArray(values)
      ? values
      : [];

  return Array.from(
    new Set(
      source
        .map(
          normalizeMyProfileText
        )
        .filter(Boolean)
    )
  );
}

// ============================================================
// 取得 Identity 資料
// ============================================================

function getMyProfileIdentityId() {
  return (
    window.JLYIdentity &&
    typeof window
      .JLYIdentity
      .getCurrentPlayerId ===
        "function"
      ? window.JLYIdentity
          .getCurrentPlayerId()
      : normalizeMyProfileText(
          localStorage.getItem(
            "currentPlayerId"
          )
        )
  );
}

function getMyProfilePlayerId() {
  return (
    window.JLYIdentity &&
    typeof window
      .JLYIdentity
      .getCurrentPlayerProfileId ===
        "function"
      ? window.JLYIdentity
          .getCurrentPlayerProfileId()
      : normalizeMyProfileText(
          localStorage.getItem(
            "currentPlayerProfileId"
          )
        )
  );
}

function getMyProfileLinkedIds() {
  return (
    window.JLYIdentity &&
    typeof window
      .JLYIdentity
      .getLinkedPlayerIds ===
        "function"
      ? window.JLYIdentity
          .getLinkedPlayerIds()
      : []
  );
}

// ============================================================
// 將 Firebase linkedPlayerIds 同步回本機快取
// ============================================================

function cacheLinkedPlayerIds(
  linkedPlayerIds
) {
  const ids =
    normalizeMyProfileIds(
      linkedPlayerIds
    );

  if (
    window.JLYIdentity &&
    typeof window
      .JLYIdentity
      .setLinkedPlayerIds ===
        "function"
  ) {
    window.JLYIdentity
      .setLinkedPlayerIds(
        ids
      );

    return;
  }

  localStorage.setItem(
    "linkedPlayerIds",
    JSON.stringify(ids)
  );
}

// ============================================================
// 儲存我的玩家資料
// ============================================================

async function saveMyProfile() {
  const db =
    window.db;

  if (!db) {
    alert(
      "Firebase 尚未載入"
    );

    return;
  }

  const displayNameInput =
    document.getElementById(
      "displayName"
    );

  const defaultPositionInput =
    document.getElementById(
      "defaultPosition"
    );

  const defaultCrossPlayInput =
    document.getElementById(
      "defaultCrossPlay"
    );

  if (
    !displayNameInput ||
    !defaultPositionInput ||
    !defaultCrossPlayInput
  ) {
    alert(
      "找不到個人資料欄位，請重新整理頁面"
    );

    return;
  }

  const displayName =
    normalizeMyProfileText(
      displayNameInput.value
    );

  const defaultPosition =
    defaultPositionInput.value;

  const defaultCrossPlay =
    defaultCrossPlayInput.checked;

  if (!displayName) {
    alert(
      "請輸入玩家名稱"
    );

    return;
  }

  try {
    const currentIdentityId =
      getMyProfileIdentityId();

    const currentPlayerProfileId =
      getMyProfilePlayerId();

    const currentPlayerName =
      normalizeMyProfileText(
        localStorage.getItem(
          "currentPlayerName"
        )
      );

    const localLinkedPlayerIds =
      getMyProfileLinkedIds();

    const now =
      new Date().toISOString();

    const data = {
      identityId:
        currentIdentityId,

      displayName,

      nickname:
        displayName,

      defaultPosition,

      defaultCrossPlay,

      memberType:
        "guest",

      isLineLinked:
        false,

      playCount:
        0,

      updatedAt:
        now
    };

    // ============================================================
    // 已有 Player Profile ID
    //
    // 先確認文件真的存在。
    // 不存在時絕對不能直接 .set() 建立錯誤 Profile。
    // ============================================================

    if (
      currentPlayerProfileId
    ) {
      const profileRef =
        db
          .collection("players")
          .doc(
            currentPlayerProfileId
          );

      const profileSnapshot =
        await profileRef.get();

      if (
        !profileSnapshot.exists
      ) {
        console.error(
          "目前 Player Profile ID 不存在：",
          currentPlayerProfileId
        );

        alert(
          "目前玩家資料連結失效，系統已停止儲存，避免建立錯誤玩家資料。"
        );

        return;
      }

      const existingData =
        profileSnapshot.data() ||
        {};

      const cloudLinkedPlayerIds =
        Array.isArray(
          existingData
            .linkedPlayerIds
        )
          ? existingData
              .linkedPlayerIds
          : [];

      const mergedLinkedPlayerIds =
        normalizeMyProfileIds([
          ...cloudLinkedPlayerIds,
          ...localLinkedPlayerIds
        ]);

      await profileRef.set(
        {
          ...data,

          linkedPlayerIds:
            mergedLinkedPlayerIds
        },
        {
          merge: true
        }
      );

      cacheLinkedPlayerIds(
        mergedLinkedPlayerIds
      );

      if (
        window.JLYIdentity &&
        typeof window
          .JLYIdentity
          .setCurrentPlayerName ===
            "function"
      ) {
        window.JLYIdentity
          .setCurrentPlayerName(
            displayName
          );
      } else {
        localStorage.setItem(
          "currentPlayerName",
          displayName
        );
      }

      alert(
        "玩家資料已更新！"
      );

      return;
    }

        // ============================================================
    // 尚未建立 Player Profile
    // ============================================================

    data.createdAt =
      now;

    data.aliases =
      currentPlayerName &&
      currentPlayerName !==
        displayName
        ? [
            currentPlayerName
          ]
        : [];

    data.source =
      "my_profile";

    data.linkedPlayerIds =
      normalizeMyProfileIds(
        localLinkedPlayerIds
      );

    const docRef =
      await db
        .collection("players")
        .add(data);

    if (
      window.JLYIdentity &&
      typeof window
        .JLYIdentity
        .setCurrentPlayerProfileId ===
          "function"
    ) {
      window.JLYIdentity
        .setCurrentPlayerProfileId(
          docRef.id
        );
    } else {
      localStorage.setItem(
        "currentPlayerProfileId",
        docRef.id
      );
    }

    if (
      window.JLYIdentity &&
      typeof window
        .JLYIdentity
        .setCurrentPlayerName ===
          "function"
    ) {
      window.JLYIdentity
        .setCurrentPlayerName(
          displayName
        );
    } else {
      localStorage.setItem(
        "currentPlayerName",
        displayName
      );
    }

    cacheLinkedPlayerIds(
      data.linkedPlayerIds
    );

    alert(
      "玩家資料建立成功！"
    );
  } catch (error) {
    console.error(
      "儲存玩家資料失敗：",
      error
    );

    alert(
      "儲存失敗：" +
      (
        error &&
        error.message
          ? error.message
          : "未知錯誤"
      )
    );
  }
}

// ============================================================
// 頁面進入時同步 Firebase Profile → localStorage 快取
//
// 前提：這台裝置已經知道 currentPlayerProfileId。
// 這不是跨裝置登入機制。
// ============================================================

async function syncMyProfileIdentityCache() {
  const db =
    window.db;

  if (!db) {
    return null;
  }

  const currentPlayerProfileId =
    getMyProfilePlayerId();

  if (!currentPlayerProfileId) {
    return null;
  }

  if (
    !window.JLYIdentity ||
    typeof window
      .JLYIdentity
      .syncFromPlayerProfile !==
        "function"
  ) {
    return null;
  }

  return await window
    .JLYIdentity
    .syncFromPlayerProfile(
      db,
      currentPlayerProfileId
    );
}

// ============================================================
// 初始化
// ============================================================

document.addEventListener(
  "DOMContentLoaded",
  function () {
    const lineLinkResult = sessionStorage.getItem(
      "jly_line_member_link_result"
    );
    if (lineLinkResult) {
      sessionStorage.removeItem("jly_line_member_link_result");
      try {
        const result = JSON.parse(lineLinkResult);
        if (result.linked) {
          window.setTimeout(function () {
            alert("LINE 身分已成功連結到你的 JLY Member。現在可以回到群組綁定車團。");
          }, 100);
        }
      } catch (_error) {
        // Ignore invalid temporary callback data.
      }
    }

    syncMyProfileIdentityCache()
      .catch(
        function (error) {
          console.warn(
            "Player Profile 快取同步失敗：",
            error
          );
        }
      );
  }
);

// ============================================================
// 對外公開
// ============================================================

window.saveMyProfile =
  saveMyProfile;

window.syncMyProfileIdentityCache =
  syncMyProfileIdentityCache;
