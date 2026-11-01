import { z } from 'zod';

/** Pack deck files use the MarvelCDB deck shape (ADR-0014). */
export const PackDeckSchema = z
  .object({
    id: z.union([z.number(), z.string()]),
    name: z.string().min(1),
    hero_code: z.string().min(1),
    hero_name: z.string().min(1),
    slots: z.record(z.string(), z.number().int().positive()),
    ignoreDeckLimitSlots: z.record(z.string(), z.number()).nullable().optional(),
    sideSlots: z.record(z.string(), z.number()).nullable().optional(),
    meta: z.union([z.string(), z.record(z.string(), z.unknown())]).nullable().optional(),
    description_md: z.string().optional(),
    date_creation: z.string().optional(),
    date_update: z.string().optional(),
    user_id: z.number().nullable().optional(),
    version: z.string().optional(),
    tags: z.string().optional(),
  })
  .strict();
