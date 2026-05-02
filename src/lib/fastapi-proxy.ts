import { NextResponse } from 'next/server';

const FASTAPI_URL = process.env.FASTAPI_URL ?? process.env.NEXT_PUBLIC_API_URL ?? '';

export function fastapiEnabled(): boolean {
  return FASTAPI_URL.length > 0;
}

export async function proxyToFastapi(path: string): Promise<NextResponse> {
  const url = `${FASTAPI_URL}/${path}`;
  const res = await fetch(url, { next: { revalidate: 0 } });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
