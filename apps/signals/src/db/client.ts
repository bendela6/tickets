export type Db = unknown;

export function createDbClient(): { db: Db } {
  throw new Error('db client lands in task 2');
}
