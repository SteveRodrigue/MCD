import { TriggerType } from '../models';

export interface TriggerCallNode {
  trigger: TriggerType;
  abilityId?: string;
  sourceInstanceId?: string;
  cardCode?: string;
  cardName?: string;
}

export class InfiniteLoopError extends Error {
  public readonly cycle: TriggerCallNode[];
  public readonly triggerChain: TriggerCallNode[];
  public readonly depth: number;
  public readonly formattedCycle: string;

  constructor(
    message: string,
    options: {
      cycle?: TriggerCallNode[];
      triggerChain?: TriggerCallNode[];
      depth?: number;
    } = {},
  ) {
    super(message);
    this.name = 'InfiniteLoopError';
    this.cycle = options.cycle || [];
    this.triggerChain = options.triggerChain || [];
    this.depth = options.depth || 0;
    this.formattedCycle =
      this.cycle.length > 0
        ? this.cycle
            .map(
              (n) =>
                `${n.cardName || 'Unknown Card'}${n.cardCode ? ` [${n.cardCode}]` : ''} (${n.abilityId || 'ability'} / ${n.trigger})`,
            )
            .join(' ? ')
        : message;

    Object.setPrototypeOf(this, InfiniteLoopError.prototype);
  }
}
