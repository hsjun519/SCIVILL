import { NextResponse } from 'next/server';
import { HttpError } from './auth';
export function failure(error: unknown) {
  if (error instanceof HttpError) return NextResponse.json({error: error.message}, {status: error.status});
  if (error instanceof SyntaxError) return NextResponse.json({error:'JSON 요청을 확인해 주세요.'}, {status:400});
  console.error('Server request failed', error instanceof Error ? error.name : 'Unknown');
  return NextResponse.json({error:'요청 처리에 실패했습니다.'}, {status:500});
}
export function json(data: unknown, status=200) {
  return NextResponse.json(data, { status, headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'} });
}
