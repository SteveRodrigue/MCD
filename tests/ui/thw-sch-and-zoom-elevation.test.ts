import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { cardCatalog } from '../../src/data/importer/card-loader';

describe('THW / SCH Stat Alignment & ADR-0012 Z-Axis Hover-Zoom Contract Tests', () => {
  // Helper matching DualCardInspector's THW/SCH resolution logic
  function resolveThwSchStat(cardRaw: any): string {
    if (cardRaw.scheme !== undefined && cardRaw.scheme !== null) {
      return `${cardRaw.scheme} (SCH)`;
    }
    if (cardRaw.thwart !== undefined && cardRaw.thwart !== null) {
      return `${cardRaw.thwart} (THW)`;
    }
    return '—';
  }

  describe('THW / SCH Stat Resolution by Card Type', () => {
    it('resolves scheme stat with (SCH) for Villains (Rhino I 01094, Rhino II 01095)', () => {
      const rhinoI = cardCatalog.getCard('01094');
      expect(rhinoI).toBeDefined();
      expect(resolveThwSchStat(rhinoI!.raw)).toBe('1 (SCH)');

      const rhinoII = cardCatalog.getCard('01095');
      expect(rhinoII).toBeDefined();
      expect(resolveThwSchStat(rhinoII!.raw)).toBe('1 (SCH)');
    });

    it('resolves scheme stat with (SCH) for Minions (Shocker 01103)', () => {
      const shocker = cardCatalog.getCard('01103');
      expect(shocker).toBeDefined();
      expect(resolveThwSchStat(shocker!.raw)).toBe('1 (SCH)');
    });

    it('resolves thwart stat with (THW) for Heroes (Spider-Man 01001a, She-Hulk 01019a)', () => {
      const spidey = cardCatalog.getCard('01001a');
      expect(spidey).toBeDefined();
      expect(resolveThwSchStat(spidey!.raw)).toBe('1 (THW)');

      const sheHulk = cardCatalog.getCard('01019a');
      expect(sheHulk).toBeDefined();
      expect(resolveThwSchStat(sheHulk!.raw)).toBe('1 (THW)');
    });

    it('resolves thwart stat with (THW) for Allies (Tigra 01051)', () => {
      const tigra = cardCatalog.getCard('01051');
      expect(tigra).toBeDefined();
      expect(resolveThwSchStat(tigra!.raw)).toBe('1 (THW)');
    });

    it('resolves "—" for non-character cards (Web-Shooter 01008, Bomb Scare 01107)', () => {
      const webShooter = cardCatalog.getCard('01008');
      expect(webShooter).toBeDefined();
      expect(resolveThwSchStat(webShooter!.raw)).toBe('—');

      const bombScare = cardCatalog.getCard('01107');
      expect(bombScare).toBeDefined();
      expect(resolveThwSchStat(bombScare!.raw)).toBe('—');
    });
  });

  // Helper matching DualCardInspector's DEF/REC resolution logic
  function resolveDefRecStat(cardRaw: any): string {
    if (cardRaw.recover !== undefined && cardRaw.recover !== null) {
      return `${cardRaw.recover} (REC)`;
    }
    if (cardRaw.defense !== undefined && cardRaw.defense !== null) {
      return `${cardRaw.defense} (DEF)`;
    }
    return '—';
  }

  describe('DEF / REC Stat Resolution by Card Type', () => {
    it('resolves recovery stat with (REC) for Alter-Egos (Peter Parker 01001b, She-Hulk 01019b, Tony Stark 01029b)', () => {
      const peter = cardCatalog.getCard('01001b');
      expect(peter).toBeDefined();
      expect(resolveDefRecStat(peter!.raw)).toBe('3 (REC)');

      const jennifer = cardCatalog.getCard('01019b');
      expect(jennifer).toBeDefined();
      expect(resolveDefRecStat(jennifer!.raw)).toBe('5 (REC)');

      const tony = cardCatalog.getCard('01029b');
      expect(tony).toBeDefined();
      expect(resolveDefRecStat(tony!.raw)).toBe('3 (REC)');

      const tchalla = cardCatalog.getCard('01040b');
      expect(tchalla).toBeDefined();
      expect(resolveDefRecStat(tchalla!.raw)).toBe('4 (REC)');
    });

    it('resolves defense stat with (DEF) for Heroes (Spider-Man 01001a, She-Hulk 01019a)', () => {
      const spidey = cardCatalog.getCard('01001a');
      expect(spidey).toBeDefined();
      expect(resolveDefRecStat(spidey!.raw)).toBe('3 (DEF)');

      const sheHulk = cardCatalog.getCard('01019a');
      expect(sheHulk).toBeDefined();
      expect(resolveDefRecStat(sheHulk!.raw)).toBe('2 (DEF)');
    });

    it('resolves defense stat with (DEF) for Allies with defense, or "—" if none', () => {
      const tigra = cardCatalog.getCard('01051');
      expect(tigra).toBeDefined();
      // Tigra doesn't have printed defense
      expect(resolveDefRecStat(tigra!.raw)).toBe('—');
    });

    it('resolves "—" for non-character cards (Web-Shooter 01008, Rhino I 01094)', () => {
      const webShooter = cardCatalog.getCard('01008');
      expect(webShooter).toBeDefined();
      expect(resolveDefRecStat(webShooter!.raw)).toBe('—');

      const rhinoI = cardCatalog.getCard('01094');
      expect(rhinoI).toBeDefined();
      expect(resolveDefRecStat(rhinoI!.raw)).toBe('—');
    });
  });

  describe('ADR-0012 Z-Axis Hover-Zoom Architecture Invariants in Editor', () => {
    it('DualCardInspector enforces unconstrained Z-axis elevation without overflow-hidden clipping', () => {
      const filePath = path.resolve(
        process.cwd(),
        'src/ui/components/editor/DualCardInspector.tsx',
      );
      const content = fs.readFileSync(filePath, 'utf8');

      // Must contain ADR-0012 reference
      expect(content).toContain('ADR-0012');

      // The Card View Visual Preview container must have overflow-visible and z-30
      expect(content).toContain('overflow-visible');
      expect(content).toContain('relative z-30');

      // The container wrapping CardView must NOT have overflow-hidden
      const cardViewContainerMatch = content.match(
        /shadow-comic-lg border-2 border-black rounded-lg([^>]*?)>/,
      );
      expect(cardViewContainerMatch).not.toBeNull();
      const containerClasses = cardViewContainerMatch![1];
      expect(containerClasses).not.toContain('overflow-hidden');
      expect(containerClasses).toContain('overflow-visible');

      // Must contain THW / SCH and DEF / REC labels in properties table
      expect(content).toContain('THW / SCH');
      expect(content).toContain('DEF / REC');
    });
  });
});
