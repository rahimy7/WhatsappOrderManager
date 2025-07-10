// shared/schema.utils.ts
import { z, ZodTypeAny } from "zod";
import { createInsertSchema } from "drizzle-zod";

/**
 * Genera un insert schema desde una tabla usando drizzle-zod,
 * omitiendo automáticamente `id`, `createdAt` y `updatedAt` si existen.
 */
export function makeInsertSchema<T extends ZodTypeAny>(
  table: any,
  extraFields: Record<string, ZodTypeAny> = {},
  omitFields: string[] = ["id", "createdAt", "updatedAt"]
) {
  const base = createInsertSchema(table) as any;
  const schema = base.omit(Object.fromEntries(omitFields.map((f) => [f, true])));
  return schema.extend(extraFields);
}
