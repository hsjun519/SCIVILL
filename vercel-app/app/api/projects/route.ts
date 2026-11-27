import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '../../../lib/db';
import { member, HttpError } from '../../../lib/auth';
import { json, failure } from '../../../lib/http';
export const runtime='nodejs';
const body=z.object({teamId:z.string().uuid(),title:z.string().trim().min(3).max(120),description:z.string().trim().max(2000).default('')}).strict();
export async function GET(req:NextRequest){
  try{
    const actor=await member(req.headers.get('authorization'));
    const sql=db();
    const projects=await sql`SELECT p.id,p.title,p.description,p.team_id AS "teamId",p.created_at AS "createdAt" FROM projects p JOIN team_members t ON t.team_id=p.team_id AND t.uid=${actor.uid} ORDER BY p.created_at DESC LIMIT 100`;
    return json({projects});
  }catch(e){return failure(e);}
}
export async function POST(req:NextRequest){
  try{
    const actor=await member(req.headers.get('authorization'));
    const parsed=body.safeParse(await req.json());
    if(!parsed.success)throw new HttpError(400,'프로젝트 정보를 확인해 주세요.');
    const sql=db(),{teamId,title,description}=parsed.data;
    const owner=await sql`SELECT owner_uid FROM teams WHERE id=${teamId}`;
    if(!owner[0])throw new HttpError(404,'팀을 찾을 수 없습니다.');
    if(owner[0].owner_uid!==actor.uid&&actor.role!=='admin')throw new HttpError(403,'팀장만 프로젝트를 개설할 수 있습니다.');
    const id=crypto.randomUUID();
    await sql`INSERT INTO projects(id,team_id,title,description) VALUES (${id},${teamId},${title},${description})`;
    return json({id},201);
  }catch(e){return failure(e);}
}
