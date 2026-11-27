import postgres from 'postgres';

let sqlClient: ReturnType<typeof postgres> | undefined;

export function db() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not configured');
  if (!sqlClient) sqlClient = postgres(process.env.DATABASE_URL, { max: 5, ssl: 'require' });
  return sqlClient;
}
