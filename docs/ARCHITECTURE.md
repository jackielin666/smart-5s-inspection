# 系統架構

## 技術棧

- **Frontend**：Next.js (App Router) + TypeScript + TailwindCSS + shadcn/ui
- **Backend/DB**：Supabase（PostgreSQL + Auth + RLS）
- **檔案儲存**：Google Drive（服務帳號）via StorageProvider 抽換介面
- **PDF**：HTML 版型 → 無頭 Chromium（1:1 復刻紙本 S12501F）
- **部署**：Vercel（GitHub push 自動部署）

## Clean Architecture 分層

```
src/
├── domain/                  # 領域層：純型別與介面，不依賴任何框架/服務
│   ├── entities.ts          #   實體（Inspection、Defect、ChecklistItem…）
│   ├── repositories.ts      #   Repository 介面
│   └── storage.ts           #   StorageProvider 介面
├── application/             # 應用層：用例服務（P1 起）
│   └── services/            #   建立巡檢、記錄缺失、結案、產PDF、KPI計算…
├── infrastructure/          # 基礎設施層：外部服務實作
│   ├── supabase/            #   client.ts（瀏覽器）/ server.ts（伺服器）
│   ├── repositories/        #   Supabase Repository 實作（P1）
│   └── storage/             #   google-drive.ts（StorageProvider 實作）
└── app/                     # 呈現層：Next.js 頁面與元件
```

**依賴方向**：app → application → domain ← infrastructure。
商業邏輯只認識 domain 介面；換儲存、換資料庫只動 infrastructure。

## 關鍵設計

### 巡檢項目設定化 + 版本快照
- 項目放 `checklist_sections` / `checklist_items`，由 `supabase/seed/checklist.json` 管理（`npm run seed:generate` 產 SQL）。
- 建立巡檢時把「項次/文字/大類」**快照**進 `inspection_results`——日後改項目文字不影響歷史紀錄與舊 PDF（稽核正確性）。

### 缺失多對多權責單位
`defects ↔ defect_units ↔ responsible_units`，一筆缺失可掛多個單位（跨部門），統計時各單位各記一次。

### 軟刪除 + 稽核 + 結案鎖定
- 修改/刪除皆允許（操作錯誤可修正），但走軟刪除（`deleted_at`）+ `audit_logs`。
- `status='resolved'`（已改善）由 DB trigger `guard_resolved_defect` 鎖定，不可改刪。

### 品保 SLA 與工作天
- `add_working_days(date, n)` DB 函式跳過週末與 `holidays` 表。
- 預設 SLA 5 個工作天（`app_settings.qa_sla_working_days`），即將逾期門檻 2 工作天。
- `defects.qa_owner` 歸屬品保 KPI。

### Google Drive 檔案結構
```
五惠智慧環境5S巡檢系統/（GDRIVE_ROOT_FOLDER_ID）
├── Photos/YYYY/MM/{inspectionId}/{defectSeq}/xxx.jpg
├── Reports/Daily/YYYY/…、Monthly/YYYY/…、Annual/…
└── Data/inspections/YYYY/YYYY-MM.jsonl、exports/…
```

## 環境變數

見 `.env.example`。機密（`SUPABASE_SECRET_KEY`、`GOOGLE_SERVICE_ACCOUNT_KEY`）只放 Vercel 環境變數或本機 `.env.local`，不進 git。
