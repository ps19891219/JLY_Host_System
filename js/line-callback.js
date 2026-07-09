console.log("line-callback.js 已成功載入！");

const LINE_CHANNEL_ID = "請貼上你的 Channel ID";
const REDIRECT_URI = "https://jly-host-system-eeso.vercel.app/pages/line-callback.html";

function setStatus(text) {
  const statusText = document.getElementById("statusText");
  if (statusText) statusText.innerText = text;
}

function getQueryParam(name) {
  return new URLSearchParams(location.search).get(name);
}

async function handleLineCallback() {
  const code = getQueryParam("code");
  const state = getQueryParam("state");

  if (!code) {
    setStatus("沒有收到 LINE 登入授權碼，請重新登入。");
    return;
  }

  setStatus("已收到 LINE 回傳，正在準備建立玩家資料...");

  /*
    ⚠️ 重要：
    LINE Login 正式版需要用後端交換 token。
    Channel Secret 不能放在前端 JS 裡。

    所以這一版先完成：
    1. 接住 LINE callback
    2. 保存 code/state
    3. 回到報名頁繼續流程

    下一步我們會加 Firebase Functions 或安全後端來換取 LINE 使用者資料。
  */

  sessionStorage.setItem("line_login_code", code);

  if (state) {
    sessionStorage.setItem("line_login_state", state);
  }

  setStatus("LINE 登入回傳成功，正在回到報名頁...");

  setTimeout(() => {
    const savedCarId = sessionStorage.getItem("join_car_id");

    if (savedCarId) {
      location.href = "join.html?id=" + savedCarId + "&line=callback";
    } else {
      location.href = "../index.html";
    }
  }, 800);
}

document.addEventListener("DOMContentLoaded", handleLineCallback);