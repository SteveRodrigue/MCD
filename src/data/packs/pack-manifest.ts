import { z } from 'zod';

/** Bumped when the engine-to-pack contract (manifest or hook API) breaks. */
export const PACK_API_VERSION = 1;

export const PACK_KINDS = ['core', 'hero', 'scenario', 'campaign', 'mixed'] as const;

/**
 * `official-bundled`: tracked in this repository (Core today). `official-sync`: materialized by
 * the sync command. `user`: community content. Both official origins are read-only.
 */
export const PACK_ORIGINS = ['official-bundled', 'official-sync', 'user'] as const;

export const PACK_ID_PATTERN = /^[a-z][a-z0-9_-]{1,31}$/;
export const OFFICIAL_CARD_CODE_PATTERN = /^\d{5}[a-f]?$/;

export const PackManifestSchema = z
  .object({
    $schema: z.string().optional(),
    id: z.string().regex(PACK_ID_PATTERN, 'must match ^[a-z][a-z0-9_-]{1,31}$'),
    name: z.string().min(1),
    kind: z.enum(PACK_KINDS),
    origin: z.enum(PACK_ORIGINS),
    apiVersion: z.number().int().positive(),
    version: z.string().min(1),
    dependsOn: z.array(z.string()).default([]),
    source: z.string().optional(),
    /** How the pack's card art is named when it differs from the standard `<code>.png`. */
    art: z
      .object({
        /** Main scheme side A is the second image of the pair (the Core Set upstream art). */
        swapMainSchemeSides: z.boolean().default(false),
      })
      .strict()
      .optional(),
  })
  .strict();

export type PackManifest = z.infer<typeof PackManifestSchema>;

/**
 * User packs may not reuse an official pack code, the `_encounter` suffix, or a leading digit.
 * The official list is a parameter so only the caller changes when its source moves.
 */
export function isReservedPackId(id: string, officialPackCodes: readonly string[]): boolean {
  return officialPackCodes.includes(id) || id.endsWith('_encounter') || /^\d/.test(id);
}

/** User cards are coded `<packId>-NNNN`. */
export function userCardCodePattern(packId: string): RegExp {
  return new RegExp(`^${packId}-[0-9]{4}[a-f]?$`);
}
