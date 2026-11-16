import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '../../../../../lib/db';
import { member, HttpError } from '../../../../../lib/auth';
import { json, failure } from '../../../../../lib/http';
export const runtime='nodejs';
const body=z.object({title:z.string().trim().min(2).max(180)}).strict();
async function access(actor:{uid:string;role:string},id:string){
  const sql=db();
  const rows=await sql`SELECT p.id,t.owner_uid FROM projects p JOIN teams t ON t.id=p.team_id JOIN team_members tm ON tm.team_id=t.id WHERE p.id=${id} AND tm.uid=${actor.uid}`;
  if(!rows.length&&actor.role!=='admin')throw new HttpError(403,'프로젝트 참여자만 접근할 수 있습니다.');
  return sql;
}
export async function GET(req:NextRequest,ctx:{params:Promise<{id:string}>}){
  try{
    const actor=await member(req.headers.get('authorization'));
    const {id}=await ctx.params;
    const sql=await access(actor,id);
    const tasks=await sql`SELECT id,title,status,created_at AS "createdAt" FROM tasks WHERE project_id=${id} ORDER BY created_at DESC`;
    return json({tasks});
  }catch(e){return failure(e);}
}
export async function POST(req:NextRequest,ctx:{params:Promise<{id:string}>}){
  try{
    const actor=await member(req.headers.get('authorization'));
    const {id}=await ctx.params;
    const sql=await access(actor,id);
    const parsed=body.safeParse(await req.json());
    if(!parsed.success)throw new HttpError(400,'작업명을 확인해 주세요.');
    const taskId=crypto.randomUUID();
    await sql`INSERT INTO tasks(id,project_id,title) VALUES (${taskId},${id},${parsed.data.title})`;
    return json({id:taskId},201);
  }catch(e){return failure(e);}
}
