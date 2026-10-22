import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { createCardInstance } from '@engine/state/game-setup';
import type { CardInstance, GameState } from '@engine/models';
import { dispatchOk, newRhinoGame } from '../support/game-fixtures';

const HELLCAT = '01020'; // She-Hulk's ally. Action: Return Hellcat to your hand.
const MAKE_THE_CALL = '01071'; // Action: Pay the printed cost of an ally in any player's discard pile → put that ally into play under your control.
const RESOURCE_CARD = '01005';

/**
 * "Your hand" is the hand of the player resolving the ability ("You, Your": a hand is not an
 * identity), and Make the Call puts an ally from any discard under the caller's control. So
 * Captain Marvel can take Hellcat out of She-Hulk's discard pile and Hellcat returns to Captain
 * Marvel's hand, not to her owner's (#340 follow-up; see #365 for `RETURN_TO_HAND` as a gate rule).
 */
describe("Hellcat (01020) returned with Make the Call from another player's discard", () => {
  let state: GameState;
  let hellcat: CardInstance;
  let makeTheCall: CardInstance;
  let payment: CardInstance[];

  beforeEach(() => {
    state = newRhinoGame({
      players: [
        { hero: '01019a', form: 'hero' }, // She-Hulk, owner of Hellcat
        { hero: '01010a', form: 'hero' }, // Captain Marvel, plays Make the Call
      ],
    });
    state.activePlayerIndex = 1;
    const [sheHulk, captainMarvel] = state.players;

    hellcat = createCardInstance(cardCatalog.getCard(HELLCAT)!);
    sheHulk.discard = [hellcat];

    makeTheCall = createCardInstance(cardCatalog.getCard(MAKE_THE_CALL)!);
    payment = [1, 2, 3].map(() => createCardInstance(cardCatalog.getCard(RESOURCE_CARD)!));
    captainMarvel.hand = [makeTheCall, ...payment];
  });

  const takeHellcat = () =>
    dispatchOk(state, {
      type: 'PLAY_CARD',
      playerId: state.players[1].id,
      cardInstanceId: makeTheCall.instanceId,
      paymentCardInstanceIds: payment.map((c) => c.instanceId),
      targetInstanceId: hellcat.instanceId,
    });

  it("puts Hellcat into the caller's play area, still owned by She-Hulk", () => {
    const next = takeHellcat();
    const [sheHulk, captainMarvel] = next.players;

    expect(captainMarvel.allies.map((c) => c.instanceId)).toContain(hellcat.instanceId);
    expect(sheHulk.discard.map((c) => c.instanceId)).not.toContain(hellcat.instanceId);
    expect(captainMarvel.allies.find((c) => c.instanceId === hellcat.instanceId)?.ownerId).toBe(
      sheHulk.id,
    );
  });

  it("returns Hellcat to the hand of the player who uses her, not to her owner's", () => {
    const taken = takeHellcat();
    const next = dispatchOk(taken, {
      type: 'USE_CARD_ABILITY',
      playerId: taken.players[1].id,
      cardInstanceId: hellcat.instanceId,
      abilityId: 'hellcat_return',
    });
    const [sheHulk, captainMarvel] = next.players;

    expect(captainMarvel.hand.map((c) => c.instanceId)).toContain(hellcat.instanceId);
    expect(captainMarvel.allies.map((c) => c.instanceId)).not.toContain(hellcat.instanceId);
    expect(sheHulk.hand.map((c) => c.instanceId)).not.toContain(hellcat.instanceId);
    expect(sheHulk.discard.map((c) => c.instanceId)).not.toContain(hellcat.instanceId);
  });
});
