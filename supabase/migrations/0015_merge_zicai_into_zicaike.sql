-- 資材 併入資材課：把「資材」單位的歷史缺失關聯改指到「資材課」，
-- 統計圖表/年度分析/設定各分類才會一致（統計是依缺失關聯的單位分類）。
-- 註：資材班→資材課為「改名」（同一 unit_id，自動一致）；此處只處理獨立的「資材」單位。

-- 1) 只關聯「資材」、未關聯「資材課」的缺失 → 改指資材課
update defect_units du
set unit_id = ru2.id
from responsible_units ru1, responsible_units ru2
where ru1.name = '資材' and ru2.name = '資材課'
  and du.unit_id = ru1.id
  and not exists (
    select 1 from defect_units d2 where d2.defect_id = du.defect_id and d2.unit_id = ru2.id
  );

-- 2) 同時關聯資材與資材課者 → 刪掉指向資材的那筆（避免主鍵衝突）
delete from defect_units du
using responsible_units ru1
where ru1.name = '資材' and du.unit_id = ru1.id;

-- 3) 移除「資材」單位（此時已無缺失關聯；其區域為 cascade，資材課已另有同名區域）
delete from responsible_units where name = '資材';

-- 4) 已知會人員的班別標示同步改名（徐德和：資材班 → 資材課）
update notified_persons set unit_name = '資材課' where unit_name = '資材班';
