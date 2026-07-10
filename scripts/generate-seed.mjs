// 由 supabase/seed/*.json 產生 seed.sql
// 用法：node scripts/generate-seed.mjs
// 產出：supabase/seed/seed.sql（貼到 Supabase SQL Editor 執行，可重複執行）
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const checklist = JSON.parse(readFileSync(join(root, 'supabase/seed/checklist.json'), 'utf8'));
const master = JSON.parse(readFileSync(join(root, 'supabase/seed/master-data.json'), 'utf8'));

const esc = (s) => s.replaceAll("'", "''");
const lines = [];

lines.push('-- 自動產生：node scripts/generate-seed.mjs（請勿手改，改 JSON 後重新產生）');
lines.push('begin;');

// 大類與項目
checklist.sections.forEach((sec) => {
  lines.push(
    `insert into checklist_sections (name, sort_order) values ('${esc(sec.name)}', ${sec.sortOrder})` +
    ` on conflict do nothing;`
  );
});
checklist.sections.forEach((sec) => {
  sec.items.forEach((item, i) => {
    lines.push(
      `insert into checklist_items (section_id, item_no, content, has_temp_facility_field, sort_order)` +
      ` select id, ${item.itemNo}, '${esc(item.content)}', ${item.hasTempFacilityField ? 'true' : 'false'}, ${i + 1}` +
      ` from checklist_sections where name = '${esc(sec.name)}'` +
      ` on conflict (item_no) do update set content = excluded.content, sort_order = excluded.sort_order;`
    );
  });
});

// 權責單位
master.responsibleUnits.forEach((name, i) => {
  lines.push(
    `insert into responsible_units (name, sort_order) values ('${esc(name)}', ${i + 1}) on conflict (name) do nothing;`
  );
});

// 檢查人員
master.inspectors.forEach((name, i) => {
  lines.push(
    `insert into inspectors (name, sort_order) values ('${esc(name)}', ${i + 1}) on conflict (name) do nothing;`
  );
});

// 系統設定
Object.entries(master.settings).forEach(([key, value]) => {
  lines.push(
    `insert into app_settings (key, value) values ('${esc(key)}', '${JSON.stringify(value)}'::jsonb)` +
    ` on conflict (key) do update set value = excluded.value, updated_at = now();`
  );
});

// 假日
master.holidays2026.forEach((h) => {
  lines.push(
    `insert into holidays (holiday_date, name) values ('${h.date}', '${esc(h.name)}') on conflict do nothing;`
  );
});

lines.push('commit;');

const out = join(root, 'supabase/seed/seed.sql');
writeFileSync(out, lines.join('\n') + '\n');
console.log(`已產生 ${out}（${lines.length} 行）`);
