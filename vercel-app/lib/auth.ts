import { createRemoteJWKSet, jwtVerify } from 'jose';
import { db } from './db';

const jwks = createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'));
export type Member = { uid: string; email: string; name: string; role: 'member' | 'admin' };

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export async function identity(header: string | null) {
  const project = process.env.FIREBASE_PROJECT_ID;
  if (!project) throw new Error('FIREBASE_PROJECT_ID is missing');
  const idToken = header?.match(/^Bearer ([a-zA-Z0-9._-]+)$/)?.[1];
  if (!idToken) throw new HttpError(401, '로그인 후 이용해 주세요.');
  try {
    const { payload } = await jwtVerify(idToken, jwks, {
      issuer: 'https://securetoken.google.com/' + project,
      audience: project,
      algorithms: ['RS256']
    });
    if (!payload.sub || typeof payload.email !== 'string' || payload.email_verified !== true || typeof payload.auth_time !== 'number') {
      throw new HttpError(401, '이메일 인증이 완료된 계정이 필요합니다.');
    }
    if (payload.auth_time > Date.now()/1000) throw new HttpError(401, '인증 시간이 올바르지 않습니다.');
    return { uid: payload.sub, email: payload.email.toLowerCase(), name: (typeof payload.name === 'string' ? payload.name : '싸이빌 부원').slice(0,80) };
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(401, '인증 토큰이 만료되었거나 유효하지 않습니다.');
  }
}

export async function member(header: string | null): Promise<Member> {
  const actor = await identity(header);
  const sql = db();
  const invite = await sql<{ role: 'member'|'admin' }[]> `SELECT role FROM invitations WHERE email=${actor.email} LIMIT 1`;
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const role = adminEmail && actor.email === adminEmail ? 'admin' : invite[0]?.role;
  if (!role) throw new HttpError(403, '승인된 싸이빌 부원만 이용할 수 있습니다.');
  const rows = await sql<Member[]> `
    INSERT INTO members(uid,email,name,role) VALUES (${actor.uid},${actor.email},${actor.name},${role})
    ON CONFLICT (uid) DO UPDATE SET name=EXCLUDED.name, email=EXCLUDED.email, role=EXCLUDED.role
    RETURNING uid,email,name,role
  `;
  return rows[0];
}

export function mustBeAdmin(actor: Member) {
  if (actor.role !== 'admin') throw new HttpError(403, '관리자 권한이 필요합니다.');
}
