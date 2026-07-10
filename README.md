# 五惠智慧環境5S巡檢系統

品保部門專用的每日環境 5S/GMP 巡檢系統，取代紙本「衛生檢查紀錄表（S12501F）」：
手機巡檢 → 即時拍照 → 缺失追蹤（權責單位、5 工作天 SLA）→ 1:1 紙本 PDF → 績效 Dashboard。

## 文件

- [開發計畫與需求決策紀錄](docs/PLAN.md)
- [系統架構](docs/ARCHITECTURE.md)
- [資料庫設計（含 ER 圖與部署步驟）](docs/DATABASE.md)

## 技術棧

Next.js (App Router) · TypeScript · TailwindCSS · shadcn/ui · Supabase (PostgreSQL/Auth) · Google Drive (StorageProvider) · Vercel

## 開發

```bash
npm install
cp .env.example .env.local   # 填入 Supabase 金鑰
npm run dev
```

巡檢項目/單位/人員等設定在 `supabase/seed/*.json`，修改後執行 `npm run seed:generate` 重新產生 `seed.sql`。
