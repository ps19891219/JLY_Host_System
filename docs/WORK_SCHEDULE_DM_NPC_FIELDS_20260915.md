# Work Schedule DM / NPC 欄位邊界｜2026-09-15

本輪只處理 Work Schedule 工作人員欄位，不修改 MyCar、Matching、Calendar Core、Accounting、LINE 或 Person Identity。

## 正式規則

- DM 與 NPC 是兩個獨立工作角色區塊，不再以單一「工作人員」視覺桶混在一起。
- 每個角色保留自己的 staffSlots、欄位名稱、順序與 person assignment。
- 批次修改必須明確選定角色與欄位；修改 NPC 不得清除 DM，修改 DM 不得清除 NPC。
- 未勾選「修改分工名稱」或「修改人員」時，不允許送出空批次修改。
- 本輪不做任何 Production Firestore 資料回填或重建。

## 相容性

現有 workShifts role row 與 staffSlots 資料模型保持不變。本輪以角色分區顯示與批次操作 guard 強化既有資料鏈，不建立第二套排班資料。
