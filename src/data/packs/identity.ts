/**
 * Identity claims across a set of packs: the first pack to claim a key (card code, scenario id,
 * modular set code) owns it. Shared by the pack validator and the runtime content loader so both
 * apply the same duplicate rule.
 */
export class ClaimRegistry {
  private readonly owners = new Map<string, string>();

  /** The owner that claimed `key`, if any. */
  ownerOf(key: string): string | undefined {
    return this.owners.get(key);
  }

  /** Claims `key` for `owner`. Returns the existing owner when the key is already taken. */
  claim(key: string, owner: string): string | undefined {
    const existing = this.owners.get(key);
    if (existing === undefined) this.owners.set(key, owner);
    return existing;
  }
}
