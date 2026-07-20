import { NextResponse, type NextRequest } from 'next/server';
import JSZip from 'jszip';
import { createClient } from '@/infrastructure/supabase/server';
import { SupabaseStorageProvider } from '@/infrastructure/storage/supabase-storage';

export const runtime = 'nodejs';
export const maxDuration = 60;

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const KIND_LABEL: Record<string, string> = { before: '改善前', after: '改善後' };
const safe = (s: string) => (s || '').replace(/[\\/:*?"<>|]/g, '_').slice(0, 30);

/** 當日照片打包下載（ZIP）：QC 可存到本地電腦 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'invalid date' }, { status: 400 });
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  // 當日表單 → 缺失 → 照片
  const { data: forms } = await supabase
    .from('inspections')
    .select('id')
    .eq('inspection_date', date)
    .is('deleted_at', null);
  const formIds = (forms ?? []).map((f: Row) => f.id);
  if (formIds.length === 0) return NextResponse.json({ error: '當日無資料' }, { status: 404 });

  const { data: defs } = await supabase
    .from('defects')
    .select('id, seq_in_day, area_name, description')
    .in('inspection_id', formIds)
    .is('deleted_at', null)
    .order('seq_in_day');
  const defMeta = new Map<string, { seq: number; area: string; desc: string }>();
  for (const d of (defs ?? []) as Row[]) {
    defMeta.set(d.id, { seq: d.seq_in_day, area: d.area_name ?? '', desc: d.description ?? '' });
  }
  const defIds = [...defMeta.keys()];
  if (defIds.length === 0) return NextResponse.json({ error: '當日無照片' }, { status: 404 });

  const { data: pics } = await supabase
    .from('defect_photos')
    .select('storage_key, kind, defect_id, sort_order')
    .in('defect_id', defIds)
    .is('deleted_at', null)
    .order('sort_order');

  const storage = new SupabaseStorageProvider(supabase);
  const zip = new JSZip();
  let count = 0;
  const perKind = new Map<string, number>();

  for (const p of (pics ?? []) as Row[]) {
    const meta = defMeta.get(p.defect_id);
    if (!meta) continue;
    try {
      const { data: buf } = await storage.download(p.storage_key);
      const kindLabel = KIND_LABEL[p.kind] ?? p.kind;
      const folder = `缺失${meta.seq}_${safe(meta.area)}`;
      const seqKey = `${p.defect_id}-${p.kind}`;
      const n = (perKind.get(seqKey) ?? 0) + 1;
      perKind.set(seqKey, n);
      zip.file(`${folder}/${kindLabel}${n}.jpg`, buf);
      count += 1;
    } catch {
      /* 單張失敗跳過 */
    }
  }

  if (count === 0) return NextResponse.json({ error: '當日無照片' }, { status: 404 });

  const content = await zip.generateAsync({ type: 'nodebuffer', compression: 'STORE' });
  const filename = `${date}_缺失照片.zip`;
  return new NextResponse(new Uint8Array(content), {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  });
}
