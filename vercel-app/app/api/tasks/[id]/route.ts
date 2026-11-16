import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '../../../../lib/db';
import { member, HttpError } from '../../../../lib/auth';
import { json, failure } from '../../../../lib/http';
export const runtime='nodejs';
const body=z.object({status:z.enum(['todo','doing','done'])}).strict();
export async function PATCH(req:NextRequest,ctx:{params:Promise<{id:string}>}){
  try{
    const actor=await member(req.headers.get('authorization'));
    const {id}=await ctx.params;
    const parsed=body.safeParse(await req.json());
    if(!parsed.success)throw new HttpError(400,'작업 상태를 확인해 주세요.');
    const sql=db();
    const rows=await sql`SELECT tasks.id FROM tasks JOIN projects p ON tasks.project_id=p.id JOIN team_members tm ON tm.team_id=p.team_id WHERE tasks.id=${id} AND tm.uid=${actor.uid}`;
    if(!rows.length&&actor.role!=='admin')throw new HttpError(403,'팀원만 작업 상태를 변경할 수 있습니다.');
    const updated=await sql`UPDATE tasks SET status=${parsed.data.status} WHERE id=${id} RETURNING id`;
    if(!updated.length)throw new HttpError(404,'작업을 찾을 수 없습니다.');
    return json({ok:true});
  }catch(e){return failure(e);}
}
