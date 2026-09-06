console.log("person-directory.js 已成功載入！");

(function () {
  "use strict";

  function getDataModule() {
    const module = window.JLYMemberPickerData;
    if (!module) throw new Error("JLYMemberPickerData 尚未載入");
    return module;
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function text(value) {
    return String(value == null ? "" : value).trim();
  }

  function getPersonMeta(person) {
    const safe = person || {};
    const data = getDataModule();
    const labels = [];

    labels.push(data.getIdentityLabel(safe));

    if (safe.staffEnabled === true || (Array.isArray(safe.roles) && safe.roles.includes("staff"))) {
      labels.push("Staff");
    }
    if (Array.isArray(safe.roles) && safe.roles.includes("dm")) {
      labels.push("DM");
    }
    if (Number(safe.playCount || 0) > 0) {
      labels.push(`歷史 ${Number(safe.playCount || 0)} 場`);
    }

    return [...new Set(labels)];
  }

  function renderPerson(person) {
    const data = getDataModule();
    const name = data.getMemberName(person);
    const identityState = data.getIdentityState(person);
    const meta = getPersonMeta(person);
    const lineName = text(person && person.lineDisplayName);

    return `
      <article class="person-directory-card" data-identity-state="${escapeHtml(identityState)}">
        <div class="person-directory-avatar" aria-hidden="true">${escapeHtml(name.slice(0, 1) || "人")}</div>
        <div class="person-directory-card-body">
          <div class="person-directory-card-title-row">
            <h2>${escapeHtml(name)}</h2>
            <span class="person-directory-status person-directory-status-${escapeHtml(identityState)}">
              ${escapeHtml(data.getIdentityLabel(person))}
            </span>
          </div>
          ${lineName && lineName !== name ? `<p class="person-directory-line-name">LINE：${escapeHtml(lineName)}</p>` : ""}
          <div class="person-directory-meta">
            ${meta.map(function (label) {
              return `<span>${escapeHtml(label)}</span>`;
            }).join("")}
          </div>
        </div>
      </article>
    `;
  }

  function renderList(people) {
    const list = document.getElementById("personDirectoryList");
    if (!list) return;

    if (!Array.isArray(people) || people.length === 0) {
      list.innerHTML = '<div class="person-directory-empty">找不到符合的人員。</div>';
      return;
    }

    list.innerHTML = people.map(renderPerson).join("");
  }

  function renderStats(allPeople, visiblePeople) {
    const stats = document.getElementById("personDirectoryStats");
    if (!stats) return;

    const all = Array.isArray(allPeople) ? allPeople : [];
    const visible = Array.isArray(visiblePeople) ? visiblePeople : [];
    const linkedCount = all.filter(function (person) {
      return getDataModule().isLineLinked(person);
    }).length;

    stats.textContent = `共 ${all.length} 人｜LINE 已連結 ${linkedCount} 人${visible.length !== all.length ? `｜目前顯示 ${visible.length} 人` : ""}`;
  }

  function showNotice(message) {
    const notice = document.getElementById("personDirectoryNotice");
    if (!notice) return;
    notice.hidden = !message;
    notice.textContent = message || "";
  }

  async function init() {
    const data = getDataModule();
    const searchInput = document.getElementById("personDirectorySearch");

    try {
      const allPeople = await data.loadPersonDirectory();
      renderList(allPeople);
      renderStats(allPeople, allPeople);

      if (searchInput) {
        searchInput.addEventListener("input", function () {
          const keyword = searchInput.value.trim();
          const visiblePeople = keyword ? data.searchMembers(allPeople, keyword) : allPeople;
          renderList(visiblePeople);
          renderStats(allPeople, visiblePeople);
        });
      }
    } catch (error) {
      console.error("人員名單讀取失敗：", error);
      showNotice("人員名單讀取失敗，請稍後再試。");
      renderList([]);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();