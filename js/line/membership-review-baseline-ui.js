"use strict";

(function () {
  function e(v) { return typeof esc === "function" ? esc(v) : String(v == null ? "" : v); }
  function changed(row) {
    return (row.pendingJoinedUserIds || []).length > 0 || (row.pendingLeftUserIds || []).length > 0 || Boolean(row.verifiedAt);
  }

  renderSummary = function () {
    const total = reviewRows.length;
    const changedCount = reviewRows.filter(changed).length;
    const firstReview = total - changedCount;
    document.getElementById("reviewSummary").innerHTML = total
      ? `<div class="summary"><div><strong>${total}</strong>待核對</div><div><strong>${changedCount}</strong>人員有異動</div><div><strong>${firstReview}</strong>初次確認</div></div>`
      : "";
  };

  renderBatch = function () {
    document.getElementById("batchBar").innerHTML = reviewRows.length
      ? `<div class="batch-bar"><button type="button" id="selectAllReview">全選待核對（${reviewRows.length}）</button><button type="button" id="verifySelected">批次確認</button></div>`
      : "";
    const s = document.getElementById("selectAllReview"), v = document.getElementById("verifySelected");
    if (s) s.onclick = () => { document.querySelectorAll('.review-check').forEach(c => { c.checked = true; }); updateBatchLabel(); };
    if (v) v.onclick = verifySelected;
  };

  renderCard = function (row) {
    const car = row.car || {}, players = activePlayers(car), names = players.map(playerName), ln = lineNames(row);
    const date = carDate(car), place = carPlace(car), joined = (row.pendingJoinedUserIds || []).length, left = (row.pendingLeftUserIds || []).length;
    const hasBaseline = Boolean(row.verifiedAt), hasDelta = joined > 0 || left > 0;
    const badgeText = hasBaseline || hasDelta ? "有人員變動，請確認" : "初次核對，確認目前狀態";
    const detailUrl = `car-detail.html?id=${encodeURIComponent(row.carId || "")}&lineReview=1&groupId=${encodeURIComponent(row.groupId || "")}`;
    const diff = row.lineCount - row.carPlayerCount;
    return `<div id="review-${e(row.groupKey)}" class="review-card ${hasBaseline || hasDelta ? 'is-diff' : ''}"><div class="review-title"><input class="review-check" type="checkbox" data-group="${e(row.groupKey)}" aria-label="選取 ${e(scriptName(car))}"><div class="review-title-main"><div class="script-name">${e(scriptName(car))}</div><div class="car-sub">${e([date,place].filter(Boolean).join(" ・ ")||"車團資料未填日期／店家")}</div><span class="badge ${hasBaseline || hasDelta ? 'badge-diff' : 'badge-match'}">${badgeText}</span></div></div><div class="count-row"><div class="count-box">玩家<strong>${row.carPlayerCount}</strong>人</div><div class="count-box">LINE<strong>${row.lineCount}</strong>人</div><div class="count-box">參考差異<strong>${diff>0?'+':''}${diff}</strong>人</div></div><div class="review-meta">人數只供核對參考，不要求 LINE 與玩家人數相等。DM／工作人員不列入玩家數；按確認即代表你已確認目前實際狀態。</div><div class="roster"><strong>玩家名單</strong><div class="roster-names">${names.length?names.map(e).join('、'):'目前沒有正式玩家'}</div></div><div class="roster"><strong>LINE 名單</strong><div class="roster-names">${ln.length?ln.map(e).join('、'):`目前只能取得 LINE 人數（${row.lineCount} 人），LINE 尚未提供可顯示的成員姓名。`}</div></div><div class="review-delta">${hasDelta?`⚠️ 上次確認後：加入 ${joined} 人｜退出 ${left} 人`:`${hasBaseline?'上次已確認，目前等待重新核對。':'尚未建立人工確認基準。'}`}</div><div class="review-actions"><button type="button" onclick="location.href='${detailUrl}'">查看車團並確認</button><button type="button" onclick="verifyOne('${e(row.carId)}','${e(row.groupId)}')">直接確認目前狀態</button></div><details class="technical"><summary>技術資料</summary>車團 ID：${e(row.carId)}<br>LINE Group ID：${e(row.groupId)}<br>最後異動：${e(row.lastEventAt||row.initializedAt||"")}</details></div>`;
  };

  const originalRender = render;
  render = async function () {
    await originalRender();
    const params = new URLSearchParams(location.search);
    const groupId = params.get("groupId");
    if (groupId) {
      requestAnimationFrame(() => {
        const target = document.getElementById(`review-${groupId}`);
        if (target) target.scrollIntoView({ block: "center" });
      });
    }
  };
})();