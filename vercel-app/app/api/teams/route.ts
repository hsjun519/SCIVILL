import { NextRequest } from 'next/server';
import { z } from 'zod';
import { member, HttpError } from '../../../lib/auth';
import { db } from '../../../lib/db';
import { json, failure } from '../../../lib/http';
export const runtime='nodejs';
const createSchema=z.object({
  title:z.string().trim().min(3).max(100),
  description:z.string().trim().min(10).max(3000),
  category:z.enum(['장관상','공학','소프트웨어','기타·환경']),
  capacity:z.number().int().min(2).max(30),
  competitionId:z.string().max(100).optional().nullable()
}).strict();
export async function GET(req:NextRequest) {
  try {
    await member(req.headers.get('authorization'));
    const sql=db();
    const rows=await sql`SELECT t.id,t.title,t.description,t.category,t.capacity,t.owner_uid AS "ownerUid",t.competition_id AS "competitionId",t.created_at AS "createdAt", (SELECT count(*)::int FROM team_members m WHERE m.team_id=t.id) AS members FROM teams t ORDER BY created_at DESC LIMIT 100`;
    return json({teams:rows});
  } catch(error){return failure(error);}
}
export async function POST(req:NextRequest) {
  try {
    const actor=await member(req.headers.get('authorization'));
    const parsed=createSchema.safeParse(await req.json());
    if(!parsed.success)throw new HttpError(400,'팀 정보가 올바르지 않습니다.');
    const {title,description,category,capacity,competitionId}=parsed.data;
    const id=crypto.randomUUID(),sql=db();
    await sql.begin(async(tx)=>{
      await tx`INSERT INTO teams(id,title,description,category,capacity,competition_id,owner_uid) VALUES(${id},${title},${description},${category},${capacity},${competitionId||null},${actor.uid})`;
      await tx`INSERT INTO team_members(team_id,uid,role) VALUES(${id},${actor.uid},'owner')`;
    });
    return json({id},201);
  } catch(error){return failure(error);}
}
