import React from 'react';
import { ModalLayer } from '../layout/ModalLayer';
import {
  Newspaper,
  Zap,
  Shield,
  Heart,
  Swords,
  Target,
  RefreshCw,
  ChevronRight,
} from 'lucide-react';
import {
  LegalActionReport,
  LegalActionItem,
} from '../../../engine/pipeline/legal-actions-generator';
import { FormattedCardText } from '../cards/FormattedCardText';
import {
  CallForActionGroup,
  NewsActionItem,
  NewsSection,
  NewspaperColumns,
  NewspaperSheet,
} from '../../theme/kit/newspaper';
import { ThemedButton } from '../../theme/kit/controls';
import { useThemeExtras } from '../../theme/useThemeExtras';

interface DailyBugleActionNewspaperProps {
  report: LegalActionReport;
  isOpen: boolean;
  onClose: () => void;
  onSelectAction: (actionItem: LegalActionItem) => void;
}

function formatTeammateHeader(ownerName?: string): string {
  if (!ownerName) return 'TEAMMATE ACTIONS';
  const match = ownerName.match(/^(Hero Seat \d+)\s*\(([^)]+)\)$/);
  if (match) {
    const seat = match[1];
    const hero = match[2];
    return `${hero.toUpperCase()} (${seat})`;
  }
  return ownerName.toUpperCase();
}

/** What a legal action does, as a small icon in the colour of the paper's text. */
const renderIcon = (iconType?: string) => {
  switch (iconType) {
    case 'flip':
      return <RefreshCw className="w-4 h-4 shrink-0" />;
    case 'recover':
      return <Heart className="w-4 h-4 shrink-0" />;
    case 'attack':
      return <Swords className="w-4 h-4 shrink-0" />;
    case 'thwart':
      return <Target className="w-4 h-4 shrink-0" />;
    case 'card':
      return <Zap className="w-4 h-4 shrink-0" />;
    case 'ability':
      return <Shield className="w-4 h-4 shrink-0" />;
    default:
      return <ChevronRight className="w-4 h-4 shrink-0" />;
  }
};

export const DailyBugleActionNewspaper: React.FC<DailyBugleActionNewspaperProps> = ({
  report,
  isOpen,
  onClose,
  onSelectAction,
}) => {
  const { newspaper: np } = useThemeExtras();
  if (!isOpen) return null;

  const {
    identityActions = [],
    handCardActions = [],
    boardActions = [],
    villainActionItems = [],
    callForActionItems = [],
    turnAction,
    activeActionCount = 0,
    playerName,
  } = report;

  const select = (item: LegalActionItem) => {
    onSelectAction(item);
    onClose();
  };

  const renderItems = (items: LegalActionItem[], cue: string) =>
    items.map((item) => (
      <NewsActionItem
        key={item.id}
        card={{
          code: item.cardCode || item.targetCardInstance?.card.code,
          name: item.headline,
        }}
        icon={renderIcon(item.iconType)}
        headline={item.headline}
        subtext={item.subtext}
        badge={item.badge}
        cue={cue}
        onSelect={() => select(item)}
      />
    ));

  const hasIdentity = identityActions.length > 0;
  const hasHand = handCardActions.length > 0;
  const hasBoard = boardActions.length > 0;
  const hasVillain = villainActionItems.length > 0;
  const hasCallForAction = callForActionItems.length > 0;

  const hasIdentityOrHand = hasIdentity || hasHand;
  const hasBoardOrVillain = hasBoard || hasVillain;

  let activePlayerColumns: Array<{
    showIdentity?: boolean;
    showHand?: boolean;
    showBoard?: boolean;
    showVillain?: boolean;
  }> = [];

  if (hasIdentityOrHand && hasBoardOrVillain) {
    activePlayerColumns = [
      { showIdentity: hasIdentity, showHand: hasHand },
      { showBoard: hasBoard, showVillain: hasVillain },
    ];
  } else if (!hasBoardOrVillain && hasIdentity && hasHand) {
    activePlayerColumns = [{ showIdentity: true }, { showHand: true }];
  } else if (hasIdentityOrHand || hasBoardOrVillain) {
    activePlayerColumns = [
      {
        showIdentity: hasIdentity,
        showHand: hasHand,
        showBoard: hasBoard,
        showVillain: hasVillain,
      },
    ];
  }

  const totalColumns = activePlayerColumns.length + (hasCallForAction ? 1 : 0);

  const containerWidthClass =
    totalColumns >= 3 ? 'max-w-6xl' : totalColumns === 2 ? 'max-w-4xl' : 'max-w-xl';

  // Group call for action items by teammate owner
  const callForActionByOwner: Record<string, LegalActionItem[]> = {};
  for (const item of callForActionItems) {
    const key = item.ownerName || 'Unknown Teammate';
    if (!callForActionByOwner[key]) {
      callForActionByOwner[key] = [];
    }
    callForActionByOwner[key].push(item);
  }

  const columns: React.ReactNode[] = activePlayerColumns.map((col, idx) => (
    <React.Fragment key={`col_${idx}`}>
      {col.showIdentity && (
        <NewsSection title="FRONT PAGE: IDENTITY DIRECTIVES" tag="Form & Basic Moves">
          {renderItems(identityActions, 'Execute')}
        </NewsSection>
      )}
      {col.showHand && (
        <NewsSection title="LATEST DISPATCHES: PLAYABLE HAND CARDS" tag="Ready from Hand">
          {renderItems(handCardActions, 'Play Card')}
        </NewsSection>
      )}
      {col.showBoard && (
        <NewsSection title="THE CLASSIFIEDS: IN-PLAY ASSETS & ALLIES" tag="Tableau & Allies">
          {renderItems(boardActions, 'Activate')}
        </NewsSection>
      )}
      {col.showVillain && (
        <NewsSection
          title="VILLAIN DISPATCHES: ENCOUNTER & SCHEME ACTIONS"
          tag="Encounter & Schemes"
        >
          {renderItems(villainActionItems, 'Discard / Pay')}
        </NewsSection>
      )}
    </React.Fragment>
  ));

  // CALL FOR ACTION (Teammate Tableau Assets & Identities)
  if (hasCallForAction) {
    columns.push(
      <div key="call-for-action" data-testid="daily-bugle-call-for-action-column">
        <NewsSection title="CALL FOR ACTION: TEAM TABLEAU ASSETS" tag="Teammate Tableau">
          {Object.entries(callForActionByOwner).map(([ownerKey, items]) => (
            <CallForActionGroup
              key={ownerKey}
              teammate={formatTeammateHeader(ownerKey)}
              count={items.length}
            >
              {items.map((item) => (
                <NewsActionItem
                  key={item.id}
                  card={{
                    code: item.cardCode || item.targetCardInstance?.card.code,
                    name: item.headline,
                  }}
                  icon={renderIcon(item.iconType)}
                  headline={item.headline}
                  subtext={
                    <FormattedCardText
                      text={item.targetCardInstance?.card?.text || item.subtext}
                      className={np.body}
                    />
                  }
                  badge={item.badge}
                  cue="Ask Teammate"
                  onSelect={() => select(item)}
                />
              ))}
            </CallForActionGroup>
          ))}
        </NewsSection>
      </div>,
    );
  }

  return (
    <ModalLayer className="inset-0 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <NewspaperSheet
        testId="daily-bugle-container"
        scrollable
        onClose={onClose}
        className={`w-full ${containerWidthClass} max-h-[85vh] transition-all duration-300`}
        edition={`Special action edition: ${playerName}`}
        issue={`${activeActionCount} legal play${activeActionCount === 1 ? '' : 's'} available`}
        footer={
          turnAction && (
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <span className={`${np.byline} block`}>Turn flow management</span>
                <span className={np.standfirst}>{turnAction.subtext}</span>
              </div>
              <ThemedButton
                variant="primary"
                icon={<Newspaper className="w-4 h-4" />}
                onClick={() => select(turnAction)}
              >
                {turnAction.headline}
              </ThemedButton>
            </div>
          )
        }
      >
        {activeActionCount === 0 && callForActionItems.length === 0 ? (
          <div className={`${np.classified} p-8! text-center space-y-1 my-4`}>
            <h3 className={np.headline}>★ PRESS RUN COMPLETE: NO ACTIONS REMAIN ★</h3>
            <p className={np.body}>
              You have exhausted your character and played all available cards. You may now conclude
              your turn below.
            </p>
          </div>
        ) : (
          <NewspaperColumns columns={columns} />
        )}
      </NewspaperSheet>
    </ModalLayer>
  );
};

export default DailyBugleActionNewspaper;
