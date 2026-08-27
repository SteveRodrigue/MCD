/**
 * Marvel Champions Digital - Data & Schemas
 * Interfaces for card metadata and MarvelsDB JSON ingestion.
 */

export interface CardDefinition {
  code: string;
  name: string;
  type_code: string;
  faction_code: string;
  pack_code?: string;
  cost?: number;
  text?: string;
}

export const DATA_VERSION = '0.1.0';
