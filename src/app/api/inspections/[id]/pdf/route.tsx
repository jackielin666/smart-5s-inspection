import { NextResponse, type NextRequest } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { createClient } from '@/infrastructure/supabase/server';
import { SupabaseStorageProvider } from '@/infrastructure/storage/supabase-storage';
import { buildInspectionPdfData } from '@/application/services/pdf/inspection-pdf-data';
import { InspectionDocument } from '@/application/services/pdf/inspection-document';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const data = await buildInspectionPdfData(supabase, id);
  if (!data) return NextResponse.json({ error: 'not found' }, { status: 404 });

  // 把照片下載成 data URI 內嵌（避免 PDF 端無法帶 cookie 讀受保護圖片）
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
  const filename = `${data.rocDate.replace(/[ 年月]/g, '').replace('日', '')}_衛生檢查紀錄表.pdf`;
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  });
}
