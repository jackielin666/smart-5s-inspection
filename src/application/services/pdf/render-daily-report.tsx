import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseStorageProvider } from '@/infrastructure/storage/supabase-storage';
import { buildDailyPdfData } from './inspection-pdf-data';
import { InspectionDocument } from './inspection-document';

/** 產生當日彙整報告 PDF（含照片內嵌）；當日無表單回傳 null */
export async function renderDailyReportPdf(
  db: SupabaseClient,
  date: string,
): Promise<Buffer | null> {
  const data = await buildDailyPdfData(db, date);
  if (!data) return null;

  const storage = new SupabaseStorageProvider(db);
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

  return await renderToBuffer(<InspectionDocument data={data} />);
}
