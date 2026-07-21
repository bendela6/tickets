import postgres from 'postgres';
import { environment } from '../src/environment';

// Connects to the maintenance db and creates signals + signals_test if missing.
const { host, port, user, password } = environment.postgres;
const sql = postgres(`postgres://${user}:${password}@${host}:${port}/postgres`, { max: 1 });

for (const name of ['signals', 'signals_test']) {
  const [exists] = await sql`SELECT 1 FROM pg_database WHERE datname = ${name}`;
  if (!exists) {
    await sql.unsafe(`CREATE DATABASE "${name}"`);
    console.log(`created database ${name}`);
  } else {
    console.log(`database ${name} already exists`);
  }
}
await sql.end();
