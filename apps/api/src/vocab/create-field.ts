import { count, eq } from 'drizzle-orm';
import type { Db } from '@tickets/db';
import { fields } from '@tickets/db';

export type CreateFieldInput = {
  key: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'boolean' | 'json' | 'select' | 'multi_select' | 'status';
  required?: boolean;
  config?: Record<string, unknown>;
};

// Fields are type-owned now (not scheme-owned): inserts a field owned by
// `typeId` at the next position (count of existing fields for that type).
export async function createFieldForType(db: Db, typeId: number, input: CreateFieldInput) {
  const position =
    (await db.select({ value: count() }).from(fields).where(eq(fields.ticketTypeId, typeId)))[0]
      ?.value ?? 0;
  const [field] = await db
    .insert(fields)
    .values({
      ticketTypeId: typeId,
      key: input.key,
      label: input.label,
      type: input.type,
      required: input.required ?? false,
      position,
      config: input.config ?? {},
    })
    .returning();
  return field!;
}
