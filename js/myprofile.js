console.log(
  "myprofile.js 已成功載入！"
);

console.log(
  "saveMyProfile 函式準備載入"
);

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
    displayNameInput
      .value
      .trim();

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
    const currentPlayerId =
      localStorage.getItem(
        "currentPlayerId"
      );

    const currentPlayerName =
      localStorage.getItem(
        "currentPlayerName"
      );

    const data = {
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
        new Date().toISOString()
    };

    if (currentPlayerId) {
      await db
        .collection("players")
        .doc(currentPlayerId)
        .set(
          data,
          {
            merge: true
          }
        );

      alert(
        "玩家資料已更新！"
      );
    } else {
      data.createdAt =
        new Date().toISOString();

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

      const docRef =
        await db
          .collection("players")
          .add(data);

      localStorage.setItem(
        "currentPlayerId",
        docRef.id
      );

      alert(
        "玩家資料建立成功！"
      );
    }

    localStorage.setItem(
      "currentPlayerName",
      displayName
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

window.saveMyProfile =
  saveMyProfile;