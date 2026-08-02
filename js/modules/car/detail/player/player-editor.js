/*
====================================================

JLY Host System V3

Module：
Car Detail Player Editor

用途：
1. 建立玩家編輯視窗
2. 開啟／關閉玩家編輯視窗
3. 讀取玩家本場資料
4. 新增玩家至車團
5. 編輯玩家本場資料
6. 更新玩家預設資料

規則：
- 玩家搜尋交給 Player Search
- 玩家移出交給 Player Actions
- Seat 寫入仍透過既有 Seat 資料
- 不負責車團主畫面 Render

依賴：
- window.db
- window.getCarId
- window.nowTime
- window.addHistory
- window.getCurrentSeatSlots
- window.getPlayerDatabaseName
- window.removePlayerFromCar
- window.renderCarDetail

====================================================
*/

console.log(
  "player-editor.js 已成功載入！"
);

(function () {
  "use strict";

  let playerEditorState =
    null;

  // ------------------------------------------------------------
  // 共用工具
  // ------------------------------------------------------------

  function getCarId() {
    if (
      typeof window.getCarId ===
        "function"
    ) {
      return window.getCarId();
    }

    return new URLSearchParams(
      location.search
    ).get("id");
  }

  function nowTime() {
    if (
      typeof window.nowTime ===
        "function"
    ) {
      return window.nowTime();
    }

    return new Date()
      .toISOString();
  }

  function getPlayerName(player) {
    if (
      typeof window
        .getPlayerDatabaseName ===
        "function"
    ) {
      return window
        .getPlayerDatabaseName(
          player
        );
    }

    const source =
      player || {};

    return (
      source.displayName ||
      source.nickname ||
      source.playerName ||
      source.name ||
      "未命名玩家"
    );
  }

  function getSlots(car) {
    if (
      typeof window
        .getCurrentSeatSlots ===
        "function"
    ) {
      return window
        .getCurrentSeatSlots(car);
    }

    return Array.isArray(
      car && car.slots
    )
      ? car.slots.map(
          function (slot) {
            return {
              ...slot,

              player:
                slot &&
                slot.player
                  ? {
                      ...slot.player
                    }
                  : null
            };
          }
        )
      : [];
  }

  function createHistory(
    car,
    type,
    text
  ) {
    if (
      typeof window.addHistory ===
        "function"
    ) {
      return window.addHistory(
        car,
        type,
        text
      );
    }

    const history =
      Array.isArray(
        car && car.history
      )
        ? [...car.history]
        : [];

    history.push({
      type,
      text,
      time:
        nowTime()
    });

    return history;
  }

  async function refreshPage() {

  const controller =
    window
      .JLYCarDetailController;

  const pending =
    window
      .JLYPendingCarDetailPosition;

  if (
    controller &&
    typeof controller
      .refreshPage ===
      "function"
  ) {

    await controller.refreshPage({

      preservePosition: true,

      anchorSelector:
        pending &&
        pending.anchorSelector
          ? pending.anchorSelector
          : ""

    });

  } else if (
    typeof window
      .renderCarDetail ===
      "function"
  ) {

    await window
      .renderCarDetail();

  }

  window.JLYPendingCarDetailPosition =
    null;

}

  // ------------------------------------------------------------
  // 建立 Modal 樣式
  // ------------------------------------------------------------

  function ensurePlayerModalStyle() {
    if (
      document.getElementById(
        "playerEditorModuleStyle"
      )
    ) {
      return;
    }

    const style =
      document.createElement(
        "style"
      );

    style.id =
      "playerEditorModuleStyle";

    style.textContent = `
      .player-modal-backdrop {
        position: fixed;
        inset: 0;
        z-index: 9999;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 18px;
        background: rgba(0, 0, 0, 0.48);
      }

      .player-modal-backdrop[hidden] {
        display: none;
      }

      .player-modal {
        width: min(100%, 460px);
        max-height: 90vh;
        overflow-y: auto;
        box-sizing: border-box;
        padding: 18px;
        background: #ffffff;
        border-radius: 18px;
      }

      .player-modal h3 {
        margin-top: 0;
      }

      .player-modal .field {
        margin: 14px 0;
      }

      .player-modal label {
        display: block;
        margin-bottom: 6px;
        font-weight: 700;
      }

      .player-modal input,
      .player-modal select,
      .player-modal textarea {
        width: 100%;
        box-sizing: border-box;
      }

      .player-modal .inline-check {
        display: flex;
        align-items: center;
        gap: 8px;
        font-weight: 700;
      }

      .player-modal .inline-check input {
        width: auto;
      }

      .player-modal-actions {
        display: grid;
        gap: 8px;
        margin-top: 18px;
      }
    `;

    document.head.appendChild(
      style
    );
  }

  // ------------------------------------------------------------
  // 建立 Modal
  // ------------------------------------------------------------

  function ensurePlayerModal() {
    if (
      document.getElementById(
        "playerEditorModal"
      )
    ) {
      return;
    }

    ensurePlayerModalStyle();

    const modal =
      document.createElement(
        "div"
      );

    modal.id =
      "playerEditorModal";

    modal.className =
      "player-modal-backdrop";

    modal.hidden =
      true;

    modal.innerHTML = `
      <div
        class="player-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="playerEditorTitle"
      >
        <h3 id="playerEditorTitle">
          玩家資料
        </h3>

        <div class="field">
          <label for="playerEditorName">
            玩家名稱
          </label>

          <input
            id="playerEditorName"
            type="text"
          >
        </div>

        <div class="field">
          <label for="playerEditorPosition">
            位置
          </label>

          <select id="playerEditorPosition">
            <option value="不限">
              不限
            </option>

            <option value="男位">
              男位
            </option>

            <option value="女位">
              女位
            </option>
          </select>
        </div>

        <div class="field">
          <label class="inline-check">
            <input
              id="playerEditorCrossPlay"
              type="checkbox"
            >

            反串
          </label>
        </div>

        <div class="field">
          <label for="playerEditorSeatLabel">
            席位名稱
          </label>

          <input
            id="playerEditorSeatLabel"
            type="text"
            placeholder="未填時顯示 1、2、3……"
          >
        </div>

        <div class="field">
          <label for="playerEditorStatus">
            本場狀態
          </label>

          <select id="playerEditorStatus">
            <option value="已加入">
              已加入
            </option>

            <option value="候補">
              候補
            </option>

            <option value="已取消">
              已取消
            </option>
          </select>
        </div>

        <div class="field">
          <label for="playerEditorNote">
            主揪備註
          </label>

          <textarea
            id="playerEditorNote"
            rows="3"
            placeholder="可空白"
          ></textarea>
        </div>

        <div class="player-modal-actions">
          <button
            id="playerEditorSaveButton"
            type="button"
          >
            💾 儲存本場資料
          </button>

          <button
            id="playerEditorSaveDefaultButton"
            type="button"
            class="gray"
          >
            💾 儲存並更新玩家預設
          </button>

          <button
            id="playerEditorRemoveButton"
            type="button"
            class="gray"
            hidden
          >
            🚪 移出車團
          </button>

          <button
            id="playerEditorCancelButton"
            type="button"
            class="gray"
          >
            ✖️ 取消
          </button>
        </div>
      </div>
    `;

    modal.addEventListener(
      "click",
      function (event) {
        if (event.target === modal) {
          closePlayerEditor();
        }
      }
    );

    document.body.appendChild(
      modal
    );
  }

  // ------------------------------------------------------------
  // 關閉 Editor
  // ------------------------------------------------------------

  function closePlayerEditor() {
    const modal =
      document.getElementById(
        "playerEditorModal"
      );

    if (modal) {
      modal.hidden =
        true;
    }

    playerEditorState =
      null;
  }

  // ------------------------------------------------------------
  // 取得輸入元素
  // ------------------------------------------------------------

  function getEditorElements() {
    return {
      modal:
        document.getElementById(
          "playerEditorModal"
        ),

      title:
        document.getElementById(
          "playerEditorTitle"
        ),

      name:
        document.getElementById(
          "playerEditorName"
        ),

      position:
        document.getElementById(
          "playerEditorPosition"
        ),

      crossPlay:
        document.getElementById(
          "playerEditorCrossPlay"
        ),

      seatLabel:
        document.getElementById(
          "playerEditorSeatLabel"
        ),

      status:
        document.getElementById(
          "playerEditorStatus"
        ),

      note:
        document.getElementById(
          "playerEditorNote"
        ),

      save:
        document.getElementById(
          "playerEditorSaveButton"
        ),

      saveDefault:
        document.getElementById(
          "playerEditorSaveDefaultButton"
        ),

      remove:
        document.getElementById(
          "playerEditorRemoveButton"
        ),

      cancel:
        document.getElementById(
          "playerEditorCancelButton"
        )
    };
  }

  // ------------------------------------------------------------
  // 開啟 Editor
  // ------------------------------------------------------------

  function openPlayerEditor(config) {
    const safeConfig =
      config || {};

    ensurePlayerModal();

    playerEditorState = {

  mode:
    safeConfig.mode ||
    "add",

  playerIndex:
    typeof safeConfig.playerIndex ===
    "number"
      ? safeConfig.playerIndex
      : null,

  selectedPlayer:
    safeConfig.selectedPlayer ||
    null,

  returnPosition:
    safeConfig.returnPosition ||
    null

};

    const elements =
      getEditorElements();

    const data =
      safeConfig.data || {};

    const selectedPlayer =
      safeConfig.selectedPlayer ||
      {};

    elements.title.textContent =
      playerEditorState.mode ===
        "edit"
        ? "✏️ 編輯人員資料"
        : "➕ 加入玩家";

    elements.name.value =
      data.hostAlias ||
      data.name ||
      data.playerName ||
      getPlayerName(
        selectedPlayer
      );

    elements.position.value =
      data.position ||
      selectedPlayer
        .defaultPosition ||
      "不限";

    elements.crossPlay.checked =
      typeof data.isCrossPlay ===
        "boolean"
        ? data.isCrossPlay
        : selectedPlayer
            .defaultCrossPlay ===
          true;

    elements.seatLabel.value =
      data.seatLabel ||
      data.roleChoice ||
      "";

    elements.status.value =
      data.status ||
      "已加入";

    elements.note.value =
      data.hostNote ||
      "";

    elements.remove.hidden =
      playerEditorState.mode !==
      "edit";

    elements.save.onclick =
      function () {
        savePlayerEditor(
          false
        );
      };

    elements.saveDefault.onclick =
      function () {
        savePlayerEditor(
          true
        );
      };

    elements.remove.onclick =
      function () {
        if (
          !playerEditorState ||
          playerEditorState.mode !==
            "edit"
        ) {
          return;
        }

        if (
          typeof window
            .removePlayerFromCar !==
            "function"
        ) {
          alert(
            "玩家移除功能尚未載入"
          );

          return;
        }

        window.removePlayerFromCar(
          playerEditorState
            .playerIndex
        );
      };

    elements.cancel.onclick =
      closePlayerEditor;

    elements.modal.hidden =
      false;

    setTimeout(
      function () {
        elements.name.focus();
      },
      30
    );
  }

  // ------------------------------------------------------------
  // 讀取欄位值
  // ------------------------------------------------------------

  function readPlayerEditorValues() {
    const elements =
      getEditorElements();

    const hostAlias =
      String(
        elements.name.value ||
        ""
      ).trim();

    if (!hostAlias) {
      alert(
        "請輸入玩家名稱"
      );

      elements.name.focus();

      return null;
    }

    return {
      hostAlias,

      position:
        elements.position.value ||
        "不限",

      isCrossPlay:
        elements.crossPlay.checked ===
        true,

      seatLabel:
        String(
          elements.seatLabel.value ||
          ""
        ).trim(),

      status:
        elements.status.value ||
        "已加入",

      hostNote:
        String(
          elements.note.value ||
          ""
        ).trim()
    };
  }

  // ------------------------------------------------------------
  // 設定儲存按鈕狀態
  // ------------------------------------------------------------

  function setSavingState(
    saving
  ) {
    const elements =
      getEditorElements();

    [
      elements.save,
      elements.saveDefault,
      elements.remove,
      elements.cancel
    ].forEach(
      function (button) {
        if (button) {
          button.disabled =
            saving;
        }
      }
    );

    if (elements.save) {
      elements.save.textContent =
        saving
          ? "儲存中……"
          : "💾 儲存本場資料";
    }

    if (elements.saveDefault) {
      elements.saveDefault
        .textContent =
        saving
          ? "儲存中……"
          : "💾 儲存並更新玩家預設";
    }
  }

  // ------------------------------------------------------------
  // 儲存 Editor
  // ------------------------------------------------------------

  async function savePlayerEditor(
    updateDefault
  ) {
    if (!playerEditorState) {
      return;
    }

    const db =
      window.db;

    const carId =
      getCarId();

    if (!db) {
      alert(
        "Firebase 尚未載入"
      );

      return;
    }

    if (!carId) {
      alert(
        "找不到車團 ID"
      );

      return;
    }

    const values =
      readPlayerEditorValues();

    if (!values) {
      return;
    }

    setSavingState(
      true
    );

    try {
      const carRef =
        db
          .collection("cars")
          .doc(carId);

      const carDoc =
        await carRef.get();

      if (!carDoc.exists) {
        alert(
          "找不到這台車"
        );

        return;
      }

      const car =
        carDoc.data() ||
        {};

      const players =
        Array.isArray(
          car.players
        )
          ? [...car.players]
          : [];

      const slots =
        getSlots(car);

      let playerId =
        null;

      let historyType =
        "";

      let historyText =
        "";

      // --------------------------------------------------------
      // 新增玩家
      // --------------------------------------------------------

      if (
        playerEditorState.mode ===
        "add"
      ) {
        const selectedPlayer =
          playerEditorState
            .selectedPlayer;

        if (!selectedPlayer) {
          alert(
            "找不到玩家"
          );

          return;
        }

        const selectedPlayerId =
          selectedPlayer.id ||
          selectedPlayer.playerId ||
          "";

        const alreadyInCar =
          players.some(
            function (player) {
              return (
                selectedPlayerId &&
                (
                  player.playerId ===
                    selectedPlayerId ||
                  player.id ===
                    selectedPlayerId
                )
              );
            }
          );

        if (alreadyInCar) {
          alert(
            "這位玩家已經在車上"
          );

          return;
        }

        playerId =
          selectedPlayerId;

        const newPlayer = {
          playerId,

          playerName:
            getPlayerName(
              selectedPlayer
            ),

          hostAlias:
            values.hostAlias,

          name:
            values.hostAlias,

          hostNote:
            values.hostNote,

          position:
            values.position,

          seatLabel:
            values.seatLabel,

          roleChoice:
            values.seatLabel,

          isCrossPlay:
            values.isCrossPlay,

          memberType:
            selectedPlayer
              .memberType ||
            "guest",

          isLineLinked:
            selectedPlayer
              .isLineLinked ===
            true,

          source:
            "host_manual",

          status:
            values.status,

          joinedAt:
            nowTime()
        };

        players.push(
          newPlayer
        );

        const addingSeatId =
          window
            .currentAddingSeatId ||
          "";

        if (addingSeatId) {
          const seat =
            slots.find(
              function (item) {
                return (
                  item.id ===
                    addingSeatId ||
                  item.slotId ===
                    addingSeatId ||
                  String(
                    item.order
                  ) ===
                    String(
                      addingSeatId
                    )
                );
              }
            );

          if (seat) {
            seat.playerId =
              playerId;

            seat.player = {
              ...newPlayer
            };
          }
        }

        historyType =
          "主揪新增玩家";

        historyText =
          values.hostAlias +
          " 已由主揪加入車團";
      } else {
        // ------------------------------------------------------
        // 編輯既有玩家
        // ------------------------------------------------------

        const index =
          playerEditorState
            .playerIndex;

        const currentPlayer =
          players[index];

        if (!currentPlayer) {
          alert(
            "找不到玩家"
          );

          return;
        }

        playerId =
          currentPlayer.playerId ||
          currentPlayer.id ||
          null;

        const updatedPlayer = {
          ...currentPlayer,

          hostAlias:
            values.hostAlias,

          name:
            values.hostAlias,

          hostNote:
            values.hostNote,

          position:
            values.position,

          seatLabel:
            values.seatLabel,

          roleChoice:
            values.seatLabel,

          isCrossPlay:
            values.isCrossPlay,

          status:
            values.status,

          updatedAt:
            nowTime()
        };

        players[index] =
          updatedPlayer;

        slots.forEach(
          function (seat) {
            if (
              seat &&
              playerId &&
              seat.playerId ===
                playerId
            ) {
              seat.player = {
                ...updatedPlayer
              };
            }
          }
        );

        historyType =
          "編輯玩家";

        historyText =
          values.hostAlias +
          " 已更新資料";
      }

      const history =
        createHistory(
          car,
          historyType,
          historyText
        );

      await carRef.update({
        players,

        slots,

        history,

        updatedAt:
          nowTime()
      });

      if (
        updateDefault &&
        playerId
      ) {
        await db
          .collection("players")
          .doc(playerId)
          .set(
            {
              displayName:
                values.hostAlias,

              nickname:
                values.hostAlias,

              defaultPosition:
                values.position,

              defaultCrossPlay:
                values.isCrossPlay,

              updatedAt:
                nowTime()
            },
            {
              merge:
                true
            }
          );
      }

      window.currentAddingSeatId =
        "";

        if (
  playerEditorState &&
  playerEditorState
    .returnPosition
) {

  window.JLYPendingCarDetailPosition =

    playerEditorState
      .returnPosition;

}

      closePlayerEditor();

      alert(
        updateDefault
          ? "已更新玩家預設"
          : "已儲存本場資料"
      );

      await refreshPage();
    } catch (error) {
      console.error(
        "玩家資料儲存失敗：",
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
    } finally {
      setSavingState(
        false
      );
    }
  }

  // ------------------------------------------------------------
  // 對外公開
  // ------------------------------------------------------------

  window.JLYCarDetailPlayerEditor = {
    ensurePlayerModal,

    openPlayerEditor,

    closePlayerEditor,

    readPlayerEditorValues,

    savePlayerEditor,

    getState:
      function () {
        return playerEditorState
          ? {
              ...playerEditorState
            }
          : null;
      }
  };

  console.log(
    "✅ Car Detail Player Editor 已載入"
  );
})();