// Renames the 3 login accounts' emails in both Supabase Auth and profiles,
// without touching any other data (does NOT reseed).
require('dotenv').config({ path: __dirname + '/../.env' });
const { Client } = require('pg');
const { createClient } = require('@supabase/supabase-js');

const supa = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const pg = new Client({
  host: process.env.DB_HOST, port: 5432, user: process.env.DB_USER,
  password: process.env.DB_PASSWORD, database: 'postgres', ssl: { rejectUnauthorized: false },
});

const RENAMES = [
  { oldEmail: 'sanjay.kumar@nexus.com', newEmail: '1@nexus.com' },
  { oldEmail: 'rajesh.n@nexus.com', newEmail: '2@nexus.com' },
  { oldEmail: 'anjali.pillai@nexus.com', newEmail: '3@nexus.com' },
];

async function main() {
  await pg.connect();
  const { data: list, error } = await supa.auth.admin.listUsers({ perPage: 200 });
  if (error) throw error;

  for (const { oldEmail, newEmail } of RENAMES) {
    const user = list.users.find((u) => u.email === oldEmail);
    if (!user) {
      console.log(`No auth user found for ${oldEmail}, skipping`);
      continue;
    }
    await supa.auth.admin.updateUserById(user.id, { email: newEmail, email_confirm: true });
    await pg.query(`update profiles set email = $1 where id = $2`, [newEmail, user.id]);
    console.log(`${oldEmail} -> ${newEmail}`);
  }

  await pg.end();
}

main().catch(async (e) => { console.error(e); try { await pg.end(); } catch (_) {} process.exit(1); });
