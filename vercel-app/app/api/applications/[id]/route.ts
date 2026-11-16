import { NextRequest } from 'next/server';
import { z } from 'zod';
import { member, HttpError } from '../../../../lib/auth';
import { db } from '../../../../lib/db';
import { json, failure } from '../../../../lib/http';
export const runtime='nodejs';
const schema=z.object({status:z.enum(['approved','rejected'])}).strict();
export async function PATCH(req:NextRequest,ctx:{params:Promise<{id:string}>}) {
  try {
    const actor=await member(req.headers.get('authorization'));
    const {id}=await ctx.params;
    const parsed=schema.safeParse(await req.json());
    if(!parsed.success)throw new HttpError(400,'신청 처리 상태를 확인해 주세요.');
    const sql=db();
    await sql.begin(async tx=>{
      const application=await tx`SELECT team_id FROM applications WHERE id=${id}`;
      if(!application[0])throw new HttpError(404,'신청을 찾을 수 없습니다.');
      const teamId=application[0].team_id as string;
      const team=await tx`SELECT owner_uid,capacity FROM teams WHERE id=${teamId} FOR UPDATE`;
      if(!team[0])throw new HttpError(404,'팀을 찾을 수 없습니다.');
      if(team[0].owner_uid!==actor.uid && actor.role!=='admin')throw new HttpError(403,'팀장만 신청을 처리할 수 있습니다.');
      const locked=await tx`SELECT applicant_uid,status FROM applications WHERE id=${id} FOR UPDATE`;
      if(locked[0].status!=='pending')throw new HttpError(409,'이미 처리된 신청입니다.');
      if(parsed.data.status==='approved') {
        const count=await tx`SELECT count(*)::int AS count FROM team_members WHERE team_id=${teamId}`;
        if(count[0].count>=team[0].capacity)throw new HttpError(409,'모집 정원이 가득 찼습니다.');
        await tx`INSERT INTO team_members(team_id,uid,role) VALUES(${teamId},${locked[0].applicant_uid},'member') ON CONFLICT DO NOTHING`;
      }
      await tx`UPDATE applications SET status=${parsed.data.status} WHERE id=${id}`;
    });
    return json({ok:true});
  } catch(error){return failure(error);}
}
