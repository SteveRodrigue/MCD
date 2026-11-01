import { z } from 'zod';

/** content/config.json: which packs the game loads (their dependencies are added automatically). */
export const ContentConfigSchema = z
  .object({
    $schema: z.string().optional(),
    enabledPacks: z.array(z.string().min(1)),
  })
  .strict();

export type ContentConfig = z.infer<typeof ContentConfigSchema>;
