console.log(
  "recruit-batch-share.js 已成功載入！"
);

(function () {
  "use strict";

  let recruitCars = [];
  let selectedCarIds =
    new Set();

  function escapeHtml(value) {
    return String(
      value == null
        ? ""
        : value
    )
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function normalizeText(value) {
    return String(
      value == null
        ? ""
        : value
    ).trim();
  }

  function getActivePlayers(car) {
    const players =
      Array.isArray(
        car &&
        car.players
      )
        ? car.players
        : [];

    return players.filter(
      function (player) {
        if (!player) {
          return false;
        }

        const status =
          normalizeText(
            player.status
          );

        return (
          status !== "已取消" &&
          status !== "取消" &&
          status !== "cancelled" &&
          status !== "canceled"
        );
      }
    );
  }

  function isSeatEmpty(seat) {
    return !(
      seat &&
      (
        seat.playerId ||
        seat.player
      )
    );
  }

  function getRemainingText(car) {
    const slots =
      Array.isArray(
        car &&
        car.slots
      )
        ? car.slots
        : [];

    if (slots.length > 0) {
      const maleSeats =
        slots.filter(
          function (seat) {
            return (
              seat.originalType ===
                "male" ||
              (
                seat.originalType ===
                  "flexible" &&
                seat.type ===
                  "male"
              )
            );
          }
        );

      const femaleSeats =
        slots.filter(
          function (seat) {
            return (
              seat.originalType ===
                "female" ||
              (
                seat.originalType ===
                  "flexible" &&
                seat.type ===
                  "female"
              )
            );
          }
        );

      const flexibleSeats =
        slots.filter(
          function (seat) {
            return (
              seat.originalType ===
                "flexible" &&
              seat.type !==
                "male" &&
              seat.type !==
                "female"
            );
          }
        );

      if (
        maleSeats.length > 0 ||
        femaleSeats.length > 0
      ) {
        const maleNeed =
          maleSeats.filter(
            isSeatEmpty
          ).length;

        const femaleNeed =
          femaleSeats.filter(
            isSeatEmpty
          ).length;

        const flexibleNeed =
          flexibleSeats.filter(
            isSeatEmpty
          ).length;

        const parts = [];

        if (maleNeed > 0) {
          parts.push(
            maleNeed + "男"
          );
        }

        if (femaleNeed > 0) {
          parts.push(
            femaleNeed + "女"
          );
        }

        if (flexibleNeed > 0) {
          parts.push(
            flexibleNeed +
            "不限"
          );
        }

        return parts.length
          ? "缺 " +
              parts.join(" ")
          : "已滿團";
      }

      const totalNeed =
        slots.filter(
          isSeatEmpty
        ).length;

      return totalNeed > 0
        ? "缺 " +
            totalNeed +
            "人"
        : "已滿團";
    }

    const total =
      Number(
        car.totalPeople ||
        car.capacity ||
        0
      );

    const remaining =
      Math.max(
        total -
          getActivePlayers(car)
            .length,
        0
      );

    return remaining > 0
      ? "缺 " +
          remaining +
          "人"
      : "已滿團";
  }

  function getDmText(car) {
    if (
      Array.isArray(
        car.dmList
      )
    ) {
      const text =
        car.dmList
          .map(
            function (item) {
              if (
                typeof item ===
                "string"
              ) {
                return item.trim();
              }

              if (
                item &&
                typeof item ===
                  "object"
              ) {
                return normalizeText(
                  item.displayName ||
                  item.name ||
                  item.dmName
                );
              }

              return "";
            }
          )
          .filter(Boolean)
          .join("、");

      if (text) {
        return text;
      }
    }

    return normalizeText(
      car.dmName
    );
  }

  function getStudioLocationText(
    car
  ) {
    const studio =
      normalizeText(
        car.studioName ||
        car.organizerName ||
        car.organizer
      );

    const location =
      normalizeText(
        car.locationName ||
        car.location ||
        car.address
      );

    if (
      studio &&
      location &&
      studio !== location
    ) {
      return (
        studio +
        "｜" +
        location
      );
    }

    return (
      studio ||
      location ||
      ""
    );
  }

  function buildCarText(
    car,
    options
  ) {
    const settings =
      options || {};

    const lines = [];

    const scriptName =
      normalizeText(
        car.scriptName ||
        car.activityName ||
        "未命名劇本"
      );

    const date =
      normalizeText(
        car.gameDate
      );

    const time =
      normalizeText(
        car.gameTime
      );

    const price =
      Number(
        car.price || 0
      );

    const dmText =
      getDmText(car);

    const studioLocation =
      getStudioLocationText(
        car
      );

    const note =
      normalizeText(
        car.note
      );

    lines.push(
      "🎭 " +
      scriptName
    );

    lines.push("");

    if (
      date ||
      time
    ) {
      lines.push(
        "📅 " +
        [date, time]
          .filter(Boolean)
          .join(" ")
      );
    }

    if (price > 0) {
      lines.push(
        "💰 $" +
        price.toLocaleString(
          "zh-TW"
        )
      );
    }

    lines.push(
      "👥 " +
      getRemainingText(car)
    );

    if (
      settings.includeDm &&
      dmText
    ) {
      lines.push("");
      lines.push(
        "🎲 DM：" +
        dmText
      );
    }

    if (studioLocation) {
      lines.push(
        "🏠 " +
        studioLocation
      );
    }

    if (
      settings.includeNote &&
      note
    ) {
      lines.push(
        "📝 備註：" +
        note
      );
    }

    return lines
      .join("\n")
      .trim();
  }

  function getSelectedCars() {
    return recruitCars.filter(
      function (car) {
        return (
          car &&
          selectedCarIds.has(
            car.id
          )
        );
      }
    );
  }

  function buildBatchText(
    cars,
    options
  ) {
    const settings =
      options || {};

    const blocks =
      (
        Array.isArray(cars)
          ? cars
          : []
      )
        .map(
          function (car) {
            return buildCarText(
              car,
              settings
            );
          }
        )
        .filter(Boolean);

    const footer =
      normalizeText(
        settings.footerText
      );

    let text =
      blocks.join(
        "\n\n────────────\n\n"
      );

    if (footer) {
      text +=
        "\n\n" +
        footer;
    }

    return text.trim();
  }

  function removeModal() {
    const old =
      document.getElementById(
        "recruitBatchShareBackdrop"
      );

    if (old) {
      old.remove();
    }
  }

  function updateSelectedCount() {
    const countBox =
      document.getElementById(
        "recruitBatchSelectedCount"
      );

    if (countBox) {
      countBox.textContent =
        "已選取 " +
        selectedCarIds.size +
        " 台車";
    }

    const button =
      document.getElementById(
        "recruitBatchGenerateButton"
      );

    if (button) {
      button.disabled =
        selectedCarIds.size ===
        0;
    }
  }

  function toggleCar(
    carId,
    checked
  ) {
    if (!carId) {
      return;
    }

    if (checked) {
      selectedCarIds.add(
        carId
      );
    } else {
      selectedCarIds.delete(
        carId
      );
    }

    updateSelectedCount();
  }

  function toggleAll(
    checked
  ) {
    selectedCarIds.clear();

    if (checked) {
      recruitCars.forEach(
        function (car) {
          if (
            car &&
            car.id
          ) {
            selectedCarIds.add(
              car.id
            );
          }
        }
      );
    }

    document
      .querySelectorAll(
        "[data-recruit-batch-car]"
      )
      .forEach(
        function (input) {
          input.checked =
            checked;
        }
      );

    updateSelectedCount();
  }

  function openModal() {
    if (
      recruitCars.length ===
      0
    ) {
      alert(
        "目前沒有可以分享的公開招募車團"
      );
      return;
    }

    removeModal();

    selectedCarIds =
      new Set();

    const backdrop =
      document.createElement(
        "div"
      );

    backdrop.id =
      "recruitBatchShareBackdrop";

    backdrop.style.cssText = [
      "position:fixed",
      "inset:0",
      "z-index:9999",
      "background:rgba(0,0,0,.45)",
      "display:flex",
      "align-items:flex-end",
      "justify-content:center",
      "padding:0"
    ].join(";");

    const carRows =
      recruitCars
        .map(
          function (car) {
            const title =
              escapeHtml(
                car.scriptName ||
                car.activityName ||
                "未命名劇本"
              );

            const date =
              escapeHtml(
                [
                  car.gameDate ||
                    "",
                  car.gameTime ||
                    ""
                ]
                  .filter(Boolean)
                  .join(" ")
              );

            return `
              <label
                style="
                  display:flex;
                  gap:12px;
                  align-items:flex-start;
                  padding:12px 0;
                  border-bottom:1px solid #eee;
                "
              >
                <input
                  type="checkbox"
                  data-recruit-batch-car
                  value="${escapeHtml(
                    car.id
                  )}"
                  onchange="
                    JLYRecruitBatchShare
                      .toggleCar(
                        this.value,
                        this.checked
                      )
                  "
                  style="
                    margin-top:4px;
                    width:20px;
                    height:20px;
                    flex:0 0 auto;
                  "
                >

                <span>
                  <strong>
                    ${title}
                  </strong>

                  ${
                    date
                      ? `
                        <div
                          style="
                            margin-top:4px;
                            font-size:14px;
                            opacity:.7;
                          "
                        >
                          ${date}
                        </div>
                      `
                      : ""
                  }
                </span>
              </label>
            `;
          }
        )
        .join("");

    backdrop.innerHTML = `
      <div
        style="
          width:min(520px,100%);
          max-height:88vh;
          overflow:auto;
          background:#fff;
          border-radius:20px 20px 0 0;
          padding:20px;
          box-sizing:border-box;
        "
      >
        <div
          style="
            display:flex;
            justify-content:space-between;
            align-items:center;
            gap:12px;
          "
        >
          <h2
            style="
              margin:0;
            "
          >
            📋 批次 LINE 揪團文案
          </h2>

          <button
            type="button"
            onclick="
              JLYRecruitBatchShare
                .close()
            "
          >
            ×
          </button>
        </div>

        <label
          style="
            display:flex;
            gap:10px;
            align-items:center;
            margin:18px 0 8px;
          "
        >
          <input
            type="checkbox"
            onchange="
              JLYRecruitBatchShare
                .toggleAll(
                  this.checked
                )
            "
          >
          全選
        </label>

        <div
          id="recruitBatchSelectedCount"
          style="
            margin-bottom:8px;
            font-size:14px;
            opacity:.7;
          "
        >
          已選取 0 台車
        </div>

        <div>
          ${carRows}
        </div>

        <div
          style="
            margin-top:20px;
            padding-top:16px;
            border-top:1px solid #eee;
          "
        >
          <strong>
            附加資訊
          </strong>

          <label
            style="
              display:flex;
              gap:10px;
              align-items:center;
              margin-top:12px;
            "
          >
            <input
              id="recruitBatchIncludeDm"
              type="checkbox"
            >
            加入 DM
          </label>

          <label
            style="
              display:flex;
              gap:10px;
              align-items:center;
              margin-top:12px;
            "
          >
            <input
              id="recruitBatchIncludeNote"
              type="checkbox"
            >
            加入備註
          </label>

          <label
            for="recruitBatchFooter"
            style="
              display:block;
              margin-top:18px;
              font-weight:600;
            "
          >
            最底下補充文字
          </label>

          <textarea
            id="recruitBatchFooter"
            rows="4"
            placeholder="例如：有興趣可以私訊我～"
            style="
              width:100%;
              box-sizing:border-box;
              margin-top:8px;
              padding:12px;
              resize:vertical;
            "
          ></textarea>
        </div>

        <button
          id="recruitBatchGenerateButton"
          type="button"
          disabled
          onclick="
            JLYRecruitBatchShare
              .generate()
          "
          style="
            width:100%;
            margin-top:18px;
            padding:14px;
          "
        >
          產生 LINE 文案
        </button>
      </div>
    `;

    backdrop.addEventListener(
      "click",
      function (event) {
        if (
          event.target ===
          backdrop
        ) {
          removeModal();
        }
      }
    );

    document.body.appendChild(
      backdrop
    );
  }

  function showPreview(
    text
  ) {
    const panel =
      document.querySelector(
        "#recruitBatchShareBackdrop > div"
      );

    if (!panel) {
      return;
    }

    panel.innerHTML = `
      <div
        style="
          display:flex;
          justify-content:space-between;
          align-items:center;
          gap:12px;
        "
      >
        <h2
          style="
            margin:0;
          "
        >
          📋 LINE 文案預覽
        </h2>

        <button
          type="button"
          onclick="
            JLYRecruitBatchShare
              .close()
          "
        >
          ×
        </button>
      </div>

      <textarea
        id="recruitBatchPreview"
        readonly
        style="
          width:100%;
          min-height:360px;
          box-sizing:border-box;
          margin-top:16px;
          padding:12px;
          line-height:1.6;
          resize:vertical;
        "
      >${escapeHtml(text)}</textarea>

      <button
        type="button"
        onclick="
          JLYRecruitBatchShare
            .copyPreview()
        "
        style="
          width:100%;
          margin-top:14px;
          padding:14px;
        "
      >
        📋 全部複製
      </button>

      <button
        type="button"
        onclick="
          JLYRecruitBatchShare
            .open()
        "
        style="
          width:100%;
          margin-top:10px;
          padding:12px;
        "
      >
        ← 重新選擇
      </button>
    `;
  }

  function generate() {
    const cars =
      getSelectedCars();

    if (
      cars.length ===
      0
    ) {
      alert(
        "請至少選擇一台車"
      );
      return;
    }

    const includeDm =
      Boolean(
        document.getElementById(
          "recruitBatchIncludeDm"
        )?.checked
      );

    const includeNote =
      Boolean(
        document.getElementById(
          "recruitBatchIncludeNote"
        )?.checked
      );

    const footerText =
      document.getElementById(
        "recruitBatchFooter"
      )?.value || "";

    const text =
      buildBatchText(
        cars,
        {
          includeDm,
          includeNote,
          footerText
        }
      );

    showPreview(text);
  }

  async function copyPreview() {
    const preview =
      document.getElementById(
        "recruitBatchPreview"
      );

    const text =
      preview
        ? preview.value
        : "";

    if (!text.trim()) {
      return;
    }

    try {
      await navigator
        .clipboard
        .writeText(text);

      alert(
        "✅ 已複製批次 LINE 揪團文案"
      );
    } catch (error) {
      console.error(
        "批次文案複製失敗：",
        error
      );

      alert(
        "複製失敗，請稍後再試"
      );
    }
  }

  function setCars(cars) {
    recruitCars =
      Array.isArray(cars)
        ? cars.slice()
        : [];
  }

  window.JLYRecruitBatchShare = {
    setCars,
    open:
      openModal,
    close:
      removeModal,
    toggleCar,
    toggleAll,
    generate,
    copyPreview,
    buildCarText,
    buildBatchText
  };
})();