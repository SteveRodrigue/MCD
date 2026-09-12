import { describe, it, expect } from 'vitest';
import { CardType } from '../../src/engine/models';
import { CardCatalog } from '../../src/data/importer/card-loader';
import corePack from '../../data/upstream/pack/core.json';
import coreEncounterPack from '../../data/upstream/pack/core_encounter.json';

describe('CardPaymentModal Targeting Invariants (Issue #94)', () => {
  const catalog = new CardCatalog([...corePack, ...coreEncounterPack]);

  function evaluatePaymentModalTargeting(card: any) {
    const isEventCard = card?.type === CardType.EVENT || (card as any)?.type_code === 'event';
    const abilities = isEventCard ? card?.enrichment?.abilities || [] : [];
    const isAttack =
      isEventCard &&
      abilities.some((a: any) =>
        (a.steps || []).some((s: any) =>
          ['DEAL_DAMAGE', 'DEAL_DAMAGE_ALL_ENEMIES', 'REPULSOR_BLAST', 'EXPLOSION'].includes(
            s.effect,
          ),
        ),
      );
    const isThwart =
      isEventCard &&
      abilities.some((a: any) => (a.steps || []).some((s: any) => s.effect === 'REMOVE_THREAT'));

    return { isAttack, isThwart };
  }

  it('Support card (Interrogation Room 01063) does NOT trigger scheme target prompt in payment modal', () => {
    const interrogationRoom = catalog.getCard('01063');
    expect(interrogationRoom).toBeDefined();
    expect(interrogationRoom?.type).toBe(CardType.SUPPORT);

    const { isAttack, isThwart } = evaluatePaymentModalTargeting(interrogationRoom);
    expect(isThwart).toBe(false);
    expect(isAttack).toBe(false);
  });

  it('Support card (Surveillance Team 01064) does NOT trigger scheme target prompt in payment modal', () => {
    const surveillanceTeam = catalog.getCard('01064');
    expect(surveillanceTeam).toBeDefined();
    expect(surveillanceTeam?.type).toBe(CardType.SUPPORT);

    const { isAttack, isThwart } = evaluatePaymentModalTargeting(surveillanceTeam);
    expect(isThwart).toBe(false);
    expect(isAttack).toBe(false);
  });

  it('Support card with damage ability (Tac Team 01056) does NOT trigger attack target prompt in payment modal', () => {
    const tacTeam = catalog.getCard('01056');
    expect(tacTeam).toBeDefined();
    expect(tacTeam?.type).toBe(CardType.SUPPORT);

    const { isAttack, isThwart } = evaluatePaymentModalTargeting(tacTeam);
    expect(isAttack).toBe(false);
    expect(isThwart).toBe(false);
  });

  it('Upgrade card with thwart ability (Mark V Helmet 01037) does NOT trigger scheme target prompt in payment modal', () => {
    const helmet = catalog.getCard('01037');
    expect(helmet).toBeDefined();
    expect(helmet?.type).toBe(CardType.UPGRADE);

    const { isAttack, isThwart } = evaluatePaymentModalTargeting(helmet);
    expect(isThwart).toBe(false);
    expect(isAttack).toBe(false);
  });

  it('Ally card with damage ability (Hawkeye 01066) does NOT trigger attack target prompt in payment modal', () => {
    const hawkeye = catalog.getCard('01066');
    expect(hawkeye).toBeDefined();
    expect(hawkeye?.type).toBe(CardType.ALLY);

    const { isAttack, isThwart } = evaluatePaymentModalTargeting(hawkeye);
    expect(isAttack).toBe(false);
    expect(isThwart).toBe(false);
  });

  it('Thwart Event (For Justice! 01060) DOES trigger scheme target prompt in payment modal', () => {
    const forJustice = catalog.getCard('01060');
    expect(forJustice).toBeDefined();
    expect(forJustice?.type).toBe(CardType.EVENT);

    const { isAttack, isThwart } = evaluatePaymentModalTargeting(forJustice);
    expect(isThwart).toBe(true);
    expect(isAttack).toBe(false);
  });

  it('Attack Event (Swinging Web Kick 01005) DOES trigger attack target prompt in payment modal', () => {
    const swingingWebKick = catalog.getCard('01005');
    expect(swingingWebKick).toBeDefined();
    expect(swingingWebKick?.type).toBe(CardType.EVENT);

    const { isAttack, isThwart } = evaluatePaymentModalTargeting(swingingWebKick);
    expect(isAttack).toBe(true);
    expect(isThwart).toBe(false);
  });

  it('Attack Event (Relentless Assault 01053) DOES trigger attack target prompt in payment modal', () => {
    const relentlessAssault = catalog.getCard('01053');
    expect(relentlessAssault).toBeDefined();
    expect(relentlessAssault?.type).toBe(CardType.EVENT);

    const { isAttack, isThwart } = evaluatePaymentModalTargeting(relentlessAssault);
    expect(isAttack).toBe(true);
    expect(isThwart).toBe(false);
  });
});
