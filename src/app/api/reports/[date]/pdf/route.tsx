import { NextResponse, type NextRequest } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { createClient } from '@/infrastructure/supabase/server';
import { SupabaseStorageProvider } from '@/infrastructure/storage/supabase-storage';
import { buildDailyPdfData } from '@/application/services/pdf/inspection-pdf-data';
import { InspectionDocument } from '@/application/services/pdf/inspection-document';

export const runtime = 'nodejs';
export const maxDuration = 60;

/** 當日彙整報告 PDF：跨當日所有表單（不合格優先、標完成度） */
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

  const data = await buildDailyPdfData(supabase, date);
  if (!data) return NextResponse.json({ error: 'no forms for this date' }, { status: 404 });

  // 照片下載為 data URI 內嵌
  const storage = new SupabaseStorageProvider(supabase);
  const allPhotos = [
    ...data.notesByDate.flatMap((g) => g.items.flatMap((it) => it.photos)),
    ...data.improvements.flatMap((im) => [...im.before, ...im.after]),
  ];
  await Promise.all(
    allPhotos.map(async (p) => {
      if (p.src) return;
      try {
        const { data: buf, mimeType } = await storage.download(p.storageKey);
        p.src = `data:${mimeType};base64,${buf.toString('base64')}`;
      } catch {
        /* 圖片讀取失敗則略過 */
      }
    }),
  );

  const buffer = await renderToBuffer(<InspectionDocument data={data} />);
  const filename = `${date}_衛生檢查紀錄表.pdf`;
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  });
}
