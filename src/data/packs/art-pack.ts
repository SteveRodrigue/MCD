import { z } from 'zod';
import { CARD_ART_FILE_PATTERN } from '../content/card-art.ts';
import { PACK_ID_PATTERN } from './pack-manifest.ts';

const ArtPackImageSchema = z
  .object({
    file: z.string().regex(CARD_ART_FILE_PATTERN, 'must be <letters, digits, _ or ->.png'),
    /** The ATK this image prints. A stat image needs both `attack` and `hitPoints`. */
    attack: z.number().int().nonnegative().optional(),
    /** The hit points this image prints. */
    hitPoints: z.number().int().positive().optional(),
  })
  .strict();

/** One image with no stats, or any number of images that each print their stats. */
const ArtPackCardImagesSchema = z
  .array(ArtPackImageSchema)
  .min(1)
  .superRefine((images, context) => {
    const hasStats = (image: z.infer<typeof ArtPackImageSchema>) =>
      image.attack !== undefined && image.hitPoints !== undefined;
    const hasNoStats = (image: z.infer<typeof ArtPackImageSchema>) =>
      image.attack === undefined && image.hitPoints === undefined;
    const valid = images.length === 1 ? hasStats(images[0]) || hasNoStats(images[0]) : images.every(hasStats);
    if (!valid) {
      context.addIssue({
        code: 'custom',
        message: 'several images each need attack and hitPoints; one image needs both or neither',
      });
    }
  });

/** `content/art-packs/<id>/art-pack.json`: local images for any card, never committed (ADR-0093). */
export const ArtPackManifestSchema = z
  .object({
    $schema: z.string().optional(),
    id: z.string().regex(PACK_ID_PATTERN, 'must match ^[a-z][a-z0-9_-]{1,31}$'),
    name: z.string().min(1),
    /** What the pack contains and when to use it; shown in the art pack list. */
    description: z.string().trim().min(1).max(300),
    credit: z
      .object({
        author: z.string().min(1),
        sourceUrl: z.url(),
        /** True for fan-made art, which the card's menu then labels as unofficial. */
        unofficial: z.boolean(),
      })
      .strict(),
    /**
     * Hero card codes this pack is tied to (several versions of one hero, or several heroes). The
     * pack shows only on cards owned by a seat whose hero is listed; a pack without it shows on
     * every card it lists (ADR-0093, decision 16).
     */
    heroes: z
      .array(z.string().min(1))
      .min(1)
      .refine((codes) => new Set(codes).size === codes.length, 'hero codes must be unique')
      .optional(),
    /** Card code (a printed card or a scenario token) to the images that replace its art. */
    cards: z.record(z.string().min(1), ArtPackCardImagesSchema),
  })
  .strict();

export type ArtPackManifest = z.infer<typeof ArtPackManifestSchema>;
export type ArtPackImage = z.infer<typeof ArtPackImageSchema>;
export type ArtPackCredit = ArtPackManifest['credit'];
