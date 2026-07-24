'use client';

import { useState } from 'react';
import type { Inspector, NotifiedPerson, ResponsibleUnit, UnitArea } from '@/domain/entities';
import { AppDialog, type DialogState } from '../../_components/app-dialog';
import {
  addInspectorAction,
  addNotifiedPersonAction,
  addUnitAction,
  addUnitAreaAction,
  saveReportConfigAction,
  setInspectorActiveAction,
  setNotifiedPersonActiveAction,
  setUnitActiveAction,
  setUnitAreaActiveAction,
} from '../actions';

/**
 * 設定管理：檢查人員 / 權責班別 / 發生區域
 * 「刪除」＝停用（歷史紀錄仍保留原名），停用者不再出現於選單，可隨時重新啟用。
 */
export function SettingsClient({
  inspectors: initInspectors,
  units: initUnits,
  unitAreas: initAreas,
  notifiedPersons: initNotified,
  isAdmin,
  reportConfig,
}: {
  inspectors: Inspector[];
  units: ResponsibleUnit[];
  unitAreas: UnitArea[];
  notifiedPersons: NotifiedPerson[];
  isAdmin: boolean;
  reportConfig: { reportEmails: string[] } | null;
}) {
  const [inspectors, setInspectors] = useState(initInspectors);
  const [units, setUnits] = useState(initUnits);
  const [areas, setAreas] = useState(initAreas);
  const [notified, setNotified] = useState(initNotified);
  const [areaUnitId, setAreaUnitId] = useState(initUnits.find((u) => u.isActive)?.id ?? '');
  const [dialog, setDialog] = useState<DialogState | null>(null);

  const fail = () => setDialog({ mode: 'alert', lines: ['操作失敗，請重試。'] });

  async function toggleInspector(it: Inspector) {
    const res = await setInspectorActiveAction(it.id, !it.isActive);
    if (!res.ok) return fail();
    setInspectors((prev) => prev.map((x) => (x.id === it.id ? { ...x, isActive: !it.isActive } : x)));
  }

  async function addInspector(name: string) {
    const res = await addInspectorAction(name);
    if (!res.ok) return fail();
    setInspectors((prev) => {
      const without = prev.filter((x) => x.id !== res.inspector.id);
      return [...without, res.inspector];
    });
  }

  async function toggleUnit(u: ResponsibleUnit) {
    const res = await setUnitActiveAction(u.id, !u.isActive);
    if (!res.ok) return fail();
    setUnits((prev) => prev.map((x) => (x.id === u.id ? { ...x, isActive: !u.isActive } : x)));
  }

  async function addUnit(name: string) {
    const res = await addUnitAction(name);
    if (!res.ok) return fail();
    setUnits((prev) => {
      const without = prev.filter((x) => x.id !== res.unit.id);
      return [...without, res.unit];
    });
  }

  async function toggleNotified(p: NotifiedPerson) {
    const res = await setNotifiedPersonActiveAction(p.id, !p.isActive);
    if (!res.ok) return fail();
    setNotified((prev) => prev.map((x) => (x.id === p.id ? { ...x, isActive: !p.isActive } : x)));
  }

  async function addNotified(name: string) {
    const res = await addNotifiedPersonAction(name);
    if (!res.ok) return fail();
    setNotified((prev) => {
      const without = prev.filter((x) => x.id !== res.person.id);
      return [...without, res.person];
    });
  }

  async function toggleArea(a: UnitArea) {
    const res = await setUnitAreaActiveAction(a.id, !a.isActive);
    if (!res.ok) return fail();
    setAreas((prev) => prev.map((x) => (x.id === a.id ? { ...x, isActive: !a.isActive } : x)));
  }

  async function addArea(name: string) {
    if (!areaUnitId) return setDialog({ mode: 'alert', lines: ['請先選擇班別，再新增區域。'] });
    const res = await addUnitAreaAction(areaUnitId, name);
    if (!res.ok) return fail();
    setAreas((prev) => {
      const without = prev.filter((x) => x.id !== res.area.id);
      return [...without, res.area];
    });
  }

  const activeUnits = units.filter((u) => u.isActive);
  const areasOfUnit = areas.filter((a) => a.unitId === areaUnitId);

  return (
    <div className="space-y-5 pb-6">
      <h1 className="text-xl font-bold text-foreground">設定管理</h1>
      <p className="-mt-3 text-sm text-muted">
        「停用」後不再出現在選單（歷史紀錄不受影響），可隨時重新啟用。
      </p>

      {isAdmin && reportConfig && <ReportConfigSection initial={reportConfig} onError={(m) => setDialog({ mode: 'alert', lines: [m] })} onSaved={() => setDialog({ mode: 'alert', title: '提醒', lines: ['報告寄送設定已儲存。'] })} />}

      <ManageSection
        title="檢查人員"
        items={inspectors.map((i) => ({ id: i.id, name: i.name, isActive: i.isActive }))}
        onToggle={(id) => {
          const it = inspectors.find((x) => x.id === id);
          if (it) toggleInspector(it);
        }}
        onAdd={addInspector}
        addPlaceholder="輸入人員姓名"
      />

      <ManageSection
        title="權責單位（班別）"
        items={units.map((u) => ({ id: u.id, name: u.name, isActive: u.isActive }))}
        onToggle={(id) => {
          const u = units.find((x) => x.id === id);
          if (u) toggleUnit(u);
        }}
        onAdd={addUnit}
        addPlaceholder="輸入班別名稱"
      />

      <section className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
        <h2 className="mb-2 text-base font-bold text-foreground">發生區域（依班別）</h2>
        <select
          value={areaUnitId}
          onChange={(e) => setAreaUnitId(e.target.value)}
          className="mb-3 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none"
        >
          <option value="">選擇班別…</option>
          {activeUnits.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
        {areaUnitId && (
          <ItemList
            items={areasOfUnit.map((a) => ({ id: a.id, name: a.name, isActive: a.isActive }))}
            onToggle={(id) => {
              const a = areas.find((x) => x.id === id);
              if (a) toggleArea(a);
            }}
          />
        )}
        {areaUnitId && <AddRow placeholder="輸入區域名稱" onAdd={addArea} />}
      </section>

      <ManageSection
        title="已知會人員"
        items={notified.map((p) => ({ id: p.id, name: p.unitName ? `${p.name}（${p.unitName}）` : p.name, isActive: p.isActive }))}
        onToggle={(id) => {
          const p = notified.find((x) => x.id === id);
          if (p) toggleNotified(p);
        }}
        onAdd={addNotified}
        addPlaceholder="輸入已知會人員姓名"
      />

      <AppDialog dialog={dialog} onClose={() => setDialog(null)} />
    </div>
  );
}

function ManageSection({
  title,
  items,
  onToggle,
  onAdd,
  addPlaceholder,
}: {
  title: string;
  items: { id: string; name: string; isActive: boolean }[];
  onToggle: (id: string) => void;
  onAdd: (name: string) => void;
  addPlaceholder: string;
}) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <h2 className="mb-2 text-base font-bold text-foreground">{title}</h2>
      <ItemList items={items} onToggle={onToggle} />
      <AddRow placeholder={addPlaceholder} onAdd={onAdd} />
    </section>
  );
}

function ItemList({
  items,
  onToggle,
}: {
  items: { id: string; name: string; isActive: boolean }[];
  onToggle: (id: string) => void;
}) {
  const sorted = [...items].sort((a, b) => Number(b.isActive) - Number(a.isActive));
  if (sorted.length === 0) return <p className="mb-2 text-sm text-muted">（尚無資料）</p>;
  return (
    <div className="mb-3 divide-y divide-border rounded-xl border border-border bg-white">
      {sorted.map((it) => (
        <div key={it.id} className="flex items-center justify-between px-3 py-2.5">
          <span className={`text-sm font-medium ${it.isActive ? 'text-foreground' : 'text-muted line-through'}`}>
            {it.name}
          </span>
          <button
            onClick={() => onToggle(it.id)}
            className="rounded-lg border px-3 py-1 text-xs font-semibold transition active:scale-95"
            style={
              it.isActive
                ? { borderColor: 'var(--border)', color: 'var(--fail)', background: 'white' }
                : { borderColor: 'var(--pass)', color: 'white', background: 'var(--pass)' }
            }
          >
            {it.isActive ? '停用' : '啟用'}
          </button>
        </div>
      ))}
    </div>
  );
}

function AddRow({ placeholder, onAdd }: { placeholder: string; onAdd: (name: string) => void }) {
  const [text, setText] = useState('');
  function submit() {
    const name = text.trim();
    if (!name) return;
    setText('');
    onAdd(name);
  }
  return (
    <div className="flex gap-2">
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
        placeholder={placeholder}
        className="flex-1 rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-brand"
      />
      <button
        type="button"
        onClick={submit}
        className="rounded-lg px-4 py-2 text-sm font-semibold text-white active:scale-95"
        style={{ background: 'var(--brand)' }}
      >
        新增
      </button>
    </div>
  );
}

/** 報告寄送設定（僅管理者）：收件人（結算固定每日 24:00 後自動結算前一日） */
function ReportConfigSection({
  initial,
  onError,
  onSaved,
}: {
  initial: { reportEmails: string[] };
  onError: (msg: string) => void;
  onSaved: () => void;
}) {
  const [emails, setEmails] = useState<string[]>(initial.reportEmails);
  const [newEmail, setNewEmail] = useState('');
  const [saving, setSaving] = useState(false);

  function addEmail() {
    const e = newEmail.trim().toLowerCase();
    if (!e) return;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return onError('Email 格式不正確');
    if (!emails.includes(e)) setEmails((prev) => [...prev, e]);
    setNewEmail('');
  }

  async function save() {
    setSaving(true);
    const res = await saveReportConfigAction(emails);
    setSaving(false);
    if (res.ok) onSaved();
    else onError(res.error ?? '儲存失敗');
  }

  return (
    <section className="rounded-2xl border-2 bg-surface p-4 shadow-sm" style={{ borderColor: 'var(--brand)' }}>
      <h2 className="mb-1 text-base font-bold" style={{ color: 'var(--brand)' }}>
        報告寄送設定（管理者）
      </h2>
      <p className="mb-3 text-xs text-muted">設定日報收件人，QC 帳號無此權限。</p>

      <div className="mb-3 rounded-lg border border-border bg-background px-3 py-2">
        <div className="text-sm font-semibold text-foreground">每日結算時間：24:00（固定）</div>
        <p className="mt-1 text-xs text-muted">表單開放編輯至當日 24:00；跨天後自動結算前一日、鎖定表單、產生並寄出日報。</p>
      </div>

      <div className="mb-3">
        <label className="mb-1 block text-sm font-semibold text-foreground">收件人 Email</label>
        <div className="mb-2 flex flex-wrap gap-1.5">
          {emails.map((e) => (
            <span key={e} className="flex items-center gap-1 rounded-full border border-border bg-white px-2.5 py-1 text-xs">
              {e}
              <button onClick={() => setEmails((prev) => prev.filter((x) => x !== e))} className="text-fail" aria-label="移除">
                ✕
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addEmail()}
            placeholder="輸入 Email 後按加入"
            className="flex-1 rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-brand"
          />
          <button onClick={addEmail} className="rounded-lg border border-border px-4 py-2 text-sm font-semibold" style={{ color: 'var(--brand)' }}>
            加入
          </button>
        </div>
        <p className="mt-1 text-xs text-muted">
          ※ 測試期間僅能寄達 jackielin666@gmail.com；寄給其他信箱需先完成公司網域驗證。
        </p>
      </div>

      <button
        onClick={save}
        disabled={saving}
        className="w-full rounded-xl py-3 text-sm font-bold text-white shadow-sm active:scale-[0.98] disabled:opacity-50"
        style={{ background: 'var(--brand)' }}
      >
        {saving ? '儲存中…' : '儲存報告設定'}
      </button>
    </section>
  );
}
