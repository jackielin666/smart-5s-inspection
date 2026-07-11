import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/infrastructure/supabase/server';
import { SupabaseDefectRepository } from '@/infrastructure/repositories/supabase-defect.repository';
import { getStorageProvider } from '@/infrastructure/storage/google-drive';
import { taipeiToday } from '@/domain/date';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const form = await request.formData();
  const file = form.get('file');
  const defectId = form.get('defectId');
  const kind = (form.get('kind') as string) === 'after' ? 'after' : 'before';
  if (!(file instanceof Blob) || typeof defectId !== 'string') {
    return NextResponse.json({ error: 'bad request' }, { status: 400 });
  }

  const repo = new SupabaseDefectRepository(supabase);
  const defect = await repo.findById(defectId);
  if (!defect) return NextResponse.json({ error: 'defect not found' }, { status: 404 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const [yyyy, mm] = taipeiToday().split('-');
  const fileId = crypto.randomUUID();
  const path = `${yyyy}/${mm}/${defect.inspectionId}/${defect.seqInDay}/${fileId}.jpg`;

  try {
    const stored = await getStorageProvider().upload({
      folder: 'photos',
      path,
      content: buffer,
      contentType: 'image/jpeg',
    });
    const existing = await repo.getPhotos(defectId);
    const photo = await repo.addPhoto({
      defectId,
      kind,
      storageProvider: 'google_drive',
      storageKey: stored.key,
      thumbKey: null,
      sortOrder: existing.length,
      takenAt: new Date().toISOString(),
    });
    return NextResponse.json({ photo: { ...photo, url: `/api/photos/raw/${stored.key}` } });
  } catch (e) {
    console.error('photo upload failed', e);
    return NextResponse.json({ error: '上傳失敗，請稍後再試' }, { status: 500 });
  }
}
