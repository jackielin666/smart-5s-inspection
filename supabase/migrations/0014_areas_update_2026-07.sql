-- 發生區域（依班別）重整：依 2026-07 更新版對照表
-- 作法：對照表內的班別，先停用「不在目標清單」的舊區域（達成刪除/合併），
--       再插入/重新啟用目標區域並更新排序。文字快照存於 defects.area_name，歷史不受影響。
-- 「空白：可自行填寫」為操作提示（App 已內建自行填寫欄），不建為區域。

drop table if exists _area_target;
create temp table _area_target (unit_name text, area_name text, ord int);
insert into _area_target (unit_name, area_name, ord) values
  ('果醬調理班', '果醬調理區', 1),
  ('果餡調理班', '果餡調理區', 1),
  ('果醬(餡)充填班', '果醬充填區', 1),
  ('果醬(餡)充填班', '果餡充填區', 2),
  ('花生班', '花生調理區', 1),
  ('花生班', '花生充填區', 2),
  ('花生班', '熟成室-7', 3),
  ('花生班', '熟成室-8', 4),
  ('花生班', '熟成室-9', 5),
  ('原料班', '1廠1F蜜餞區', 1),
  ('原料班', '2廠3F原料區', 2),
  ('原料班', '2廠3F冷藏室', 3),
  ('包裝班', '1廠1F包裝區', 1),
  ('包裝班', '2廠1F包裝區', 2),
  ('包裝班', '2廠3F蜜餞包裝區', 3),
  ('品保課', '現場品保區', 1),
  ('品保課', '品保留樣室', 2),
  ('品保課', '品保辦公室', 3),
  ('品保課', '品保檢驗室', 4),
  ('工務課', '廢水處理區', 1),
  ('工務課', '廢棄物存放區', 2),
  ('工務課', '工務辦公室', 3),
  ('資材', '一廠成品小倉', 1),
  ('資材', '一廠成品大倉', 2),
  ('資材班', '冷凍庫', 1),
  ('資材班', '成品倉', 2),
  ('資材班', '原料倉', 3),
  ('資材班', '物料倉', 4),
  ('資材班', '二廠4F砂糖暫存區', 5),
  ('資材班', '二廠4F物料倉', 6),
  ('資材班', '二廠1A紙箱暫存區', 7),
  ('資材班', '一廠成品小倉', 8),
  ('資材班', '一廠成品大倉', 9),
  ('資材班', '1F冷凍庫', 10),
  ('資材班', '外倉', 11),
  ('其它', '打發製程區', 1),
  ('其它', '打發充填區', 2),
  ('其它', '共用區', 3),
  ('其它', '警衛室', 4),
  ('其它', '二廠3F廁所', 5),
  ('其它', '二廠2F廁所', 6),
  ('其它', '二廠1A女更衣室', 7),
  ('外包業務', '病媒蚊', 1),
  ('外包業務', '二廠3F廁所', 2),
  ('外包業務', '二廠2F廁所', 3),
  ('外包業務', '二廠1A女更衣室', 4),
  ('配料室', '配料區', 1),
  ('配料室', '配料倉庫', 2);

-- 1) 確保對照表內班別存在且啟用（依表格順序設定 sort_order；不動其他既有班別）
insert into responsible_units (name, sort_order, is_active) values
  ('果醬調理班', 1, true), ('果餡調理班', 2, true), ('果醬(餡)充填班', 3, true),
  ('花生班', 4, true), ('原料班', 5, true), ('包裝班', 6, true),
  ('品保課', 7, true), ('工務課', 8, true), ('資材', 9, true),
  ('資材班', 10, true), ('其它', 11, true), ('外包業務', 12, true), ('配料室', 13, true)
on conflict (name) do update set sort_order = excluded.sort_order, is_active = true;

-- 2) 對照表內班別：停用「不在目標清單」的區域（刪除/合併）
update unit_areas ua set is_active = false
from responsible_units u
where ua.unit_id = u.id
  and u.name in (select distinct unit_name from _area_target)
  and not exists (
    select 1 from _area_target t where t.unit_name = u.name and t.area_name = ua.name
  );

-- 3) 插入/重新啟用目標區域，並更新排序
insert into unit_areas (unit_id, name, sort_order, is_active)
select u.id, t.area_name, t.ord, true
from _area_target t
join responsible_units u on u.name = t.unit_name
on conflict (unit_id, name) do update set sort_order = excluded.sort_order, is_active = true;

drop table _area_target;

-- 檢查人員 Jean 停用（＝設定管理的「刪除」，歷史紀錄不受影響）
update inspectors set is_active = false where name = 'Jean';
