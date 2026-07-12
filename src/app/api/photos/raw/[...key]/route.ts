import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/infrastructure/supabase/server';
import { SupabaseStorageProvider } from '@/infrastructure/storage/supabase-storage';

// 代理讀取照片：只有登入者看得到，維持私密性
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ key: string[] }> },
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { key } = await params;
  const storageKey = key.map(decodeURIComponent).join('/');
  try {
    const { data, mimeType } = await new SupabaseStorageProvider(supabase).download(storageKey);
    return new NextResponse(new Uint8Array(data), {
      headers: {
        'Content-Type': mimeType,
        'Cache-Control': 'private, max-age=86400',
      },
    });
  } catch {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }
}
