import { NextRequest, NextResponse } from 'next/server';
import { analyzeReceipt } from '@/lib/analyzeReceipt';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = (await req.json()) as { base64?: unknown; mediaType?: unknown };
    const base64 = typeof body.base64 === 'string' ? body.base64 : '';
    const mediaType = typeof body.mediaType === 'string' ? body.mediaType : '';

    const layout = await analyzeReceipt(base64, mediaType);

    return NextResponse.json({ layout });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Analysis failed.';
    console.error('/api/analyze failed:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
