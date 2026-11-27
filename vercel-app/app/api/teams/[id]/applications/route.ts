import { NextRequest } from 'next/server';
import { z } from 'zod';
import { member, HttpError } from '../../../../../lib/auth';
import { db } from '../../../../../lib/db';
import { json, failure } from '../../../../../lib/http';
export const runtime='nodejs';
const schema=z.object({message:z.string().trim().min(5).max(1000)}).strict();
export async function GET(req:NextRequest,ctx:{params:Promise<{id:string}>}) {
  try {
    const actor=await member(req.headers.get('authorization'));
    const {id}=await ctx.params;
    const sql=db();
    const team=await sql`SELECT owner_uid FROM teams WHERE id=${id}`;
    if(!team[0])throw new HttpError(404,'팀을 찾을 수 없습니다.');
    if(team[0].owner_uid!==actor.uid && actor.role!=='admin')throw new HttpError(403,'팀장만 신청 목록을 확인할 수 있습니다.');
    const applications=await sql`SELECT a.id,a.message,a.status,a.created_at AS "createdAt",m.name AS "applicantName" FROM applications a JOIN members m ON m.uid=a.applicant_uid WHERE a.team_id=${id} ORDER BY a.created_at DESC`;
    return json({applications});
  } catch(error){return failure(error);}
}
export async function POST(req:NextRequest,ctx:{params:Promise<{id:string}>}) {
  try {
    const actor=await member(req.headers.get('authorization'));
    const {id}=await ctx.params;
    const parsed=schema.safeParse(await req.json());
    if(!parsed.success)throw new HttpError(400,'지원 이유를 5~1000자로 작성해 주세요.');
    const sql=db();
    // Rechecks are made transactionally to avoid concurrent applications on stale team states.
    await sql.begin(async(tx)=>{
      const teams=await tx`SELECT owner_uid FROM teams WHERE id=${id} FOR UPDATE`;
      if(!teams[0]) throw new HttpError(404,'팀을 찾을 수 없습니다.');
      if(teams[0].owner_uid===actor.uid)throw new HttpError(400,'팀장은 자신의 팀에 지원할 수 없습니다.');
      const existing=await tx`SELECT uid FROM team_members WHERE team_id=${id} AND uid=${actor.uid}`;
      if(existing.length)throw new HttpError(409,'이미 팀원입니다.');
      const prior=await tx`SELECT id FROM applications WHERE team_id=${id} AND applicant_uid=${actor.uid}`;
      if(prior.length)throw new HttpError(409,'이미 신청한 팀입니다.');
      await tx`INSERT INTO applications(id,team_id,applicant_uid,message) VALUES(${crypto.randomUUID()},${id},${actor.uid},${parsed.data.message})`;
    });
    return json({ok:true},201);
  } catch(error){return failure(error);}
}
