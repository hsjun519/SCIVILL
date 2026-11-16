import { NextRequest } from 'next/server';
import { member } from '../../../lib/auth';
import { json, failure } from '../../../lib/http';
export const runtime='nodejs';
export async function GET(req:NextRequest) {
  try { return json({member:await member(req.headers.get('authorization'))}); }
  catch(error) { return failure(error); }
}
