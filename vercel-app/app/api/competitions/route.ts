import { db } from '../../../lib/db';
import { json, failure } from '../../../lib/http';
export const runtime='nodejs';
export async function GET() {
  try {
    const sql=db();
    const competitions=await sql`SELECT id,title,organizer,category,theme,award,team_size AS "teamSize",official_url AS "officialUrl",application_end_at AS "applicationEndAt" FROM competitions WHERE verified=TRUE AND application_end_at>now() ORDER BY application_end_at LIMIT 100`;
    return json({competitions});
  } catch(error){return failure(error);}
}
