import { migrateDatabase } from './migrate-database';

await migrateDatabase();
console.log('migrations applied');
