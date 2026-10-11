# JLY Host System｜Project Map

## 2026/10/11 LINE 行事曆手機加入頁（待提交）
- LINE 歡迎卡第三按鈕進入 /pages/car-calendar-add.html?id=carId；保留 DM、玩家入口不變。無可靠日期或時長時維持不提供 Calendar 動作。
- 新增 /api/car-calendar-event 單筆精準讀取 carDetailViews/{carId}，僅輸出公共活動資料、正確 UTC 起迄時間與既有 Google 預填網址；另提供 .ics 下載。不讀 Core、不掃描集合、不建立新 Activity。
- 手機頁使用既有 JLYCalendarAuth / Google OAuth，玩家確認後才向個人 primary Calendar 寫入，先以 privateExtendedProperty=carId 查重；也提供 Apple/其他 Calendar .ics、Google 網頁版備用入口。
- 日期與時間沿用 google-calendar-prefill-url 的 Asia/Taipei 驗證；不推測缺少資料。這是單次手動個人加入，不承諾自動追蹤車團變更或修改 Person/LINE Identity/Reminder。

## 2026/10/09 玩家／DM 自助申請 Prepared View write-through
- 新玩家或 DM 自助申請沿用正式 cars/{carId} transaction，同筆交易以既有 buildCarDetailView 更新 carDetailViews/{carId}；不額外查詢集合、不修改成員或席位。
- 同一 LINE 身分重送已存在的待審申請，僅回補該車 Prepared View，回覆 alreadySubmitted=true，不複製正式申請。已加入、其他 LINE 帳號、額滿及名單認領仍按既有驗證處理。
- 公開玩家報名頁將已申請的錯誤顯示為中文，car-view-a���q�^