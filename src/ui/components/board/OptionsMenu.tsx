import React, { useState } from 'react';
import { useTimeout } from '../../hooks/useTimeout';
import {
  Settings,
  Wrench,
  Check,
  ShieldAlert,
  Gauge,
  Zap,
  ZoomIn,
  Camera,
  BookOpen,
  ExternalLink,
  Sparkles,
  Clock,
  Trash2,
  Palette,
} from 'lucide-react';
import { useGameSettings } from '../../context/useGameSettings';
import { logGameStateSnapshot } from '../../services/gamestate-logger-service';
import { ResetCardStatsConfirmModal } from '../cards/ResetCardStatsConfirmModal';
import { resetAllStats } from '../../services/stats-storage-service';
import { useGameSession } from '../../context/GameStateContext';
import { ModalScaffold } from '../../theme/ModalScaffold';
import { ThemePicker } from '../../theme/ThemePicker';
import { useGameTheme } from '../../theme/useGameTheme';
import { useModalStyle } from '../../theme/useModalStyle';

interface OptionsMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SettingPanelProps {
  icon: React.ReactNode;
  title: string;
  /** Control on the right of the title row (segmented buttons, switch, action button). */
  control?: React.ReactNode;
  wrapControl?: boolean;
  description?: React.ReactNode;
  children?: React.ReactNode;
}

/** One setting: icon and title, its control, and a short description. */
const SettingPanel: React.FC<SettingPanelProps> = ({
  icon,
  title,
  control,
  wrapControl = false,
  description,
  children,
}) => {
  const { style } = useModalStyle();
  return (
    <div className={`p-4 space-y-2 ${style.panel}`}>
      <div className={`flex items-center justify-between gap-2 ${wrapControl ? 'flex-wrap' : ''}`}>
        <div className="flex items-center gap-2">
          {icon}
          <span className="font-comic text-base">{title}</span>
        </div>
        {control}
      </div>
      {description && <p className={`text-xs ${style.muted}`}>{description}</p>}
      {children}
    </div>
  );
};

interface SegmentedProps<T extends string | number> {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  /** Colour of the selected option: the game's default is yellow. */
  activeTone?: 'yellow' | 'red';
}

/** A row of mutually exclusive choices. */
function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  activeTone = 'yellow',
}: SegmentedProps<T>) {
  const { style } = useModalStyle();
  return (
    <div className={`flex items-center flex-wrap p-0.5 ${style.inset}`}>
      {options.map((opt) => (
        <button
          key={String(opt.value)}
          type="button"
          aria-pressed={value === opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-2.5 py-1 font-comic text-xs uppercase rounded transition-all cursor-pointer font-bold ${
            value === opt.value
              ? activeTone === 'red'
                ? 'bg-comic-red text-white border border-comic-black shadow-comic-sm'
                : `${style.btnMove} !opacity-100`
              : `${style.muted} hover:opacity-80`
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

/** On/off switch. */
const Switch: React.FC<{ checked: boolean; onToggle: () => void }> = ({ checked, onToggle }) => (
  <button
    type="button"
    onClick={onToggle}
    className={`relative inline-flex h-7 w-14 items-center rounded-full border-2 border-comic-black transition-colors cursor-pointer shadow-comic-sm shrink-0 ${
      checked ? 'bg-emerald-500' : 'bg-slate-300'
    }`}
    role="switch"
    aria-checked={checked}
  >
    <span
      className={`inline-block h-5 w-5 transform rounded-full bg-white border border-comic-black transition-transform ${
        checked ? 'translate-x-7' : 'translate-x-1'
      }`}
    />
  </button>
);

const ZOOM_OPTIONS = [
  { value: 'small', label: 'Small (90%)' },
  { value: 'normal', label: 'Normal (Default)' },
  { value: 'larger', label: 'Larger (110%)' },
] as const;

const SPEED_OPTIONS = [
  { value: 'slow', label: 'Slow' },
  { value: 'normal', label: 'Normal (Default)' },
  { value: 'fast', label: 'Fast' },
] as const;

const DIFFICULTY_OPTIONS = [
  { value: 'SKIRMISH', label: 'Skirmish' },
  { value: 'STANDARD', label: 'Standard' },
  { value: 'EXPERT', label: 'Expert' },
] as const;

const HEROIC_OPTIONS = [0, 1, 2, 3].map((lvl) => ({
  value: lvl,
  label: lvl === 0 ? 'Off (0)' : `Heroic ${lvl} (+${lvl})`,
}));

const PACING_OPTIONS = [
  { value: 'auto_normal', label: 'Auto (Normal)' },
  { value: 'auto_fast', label: 'Auto (Fast)' },
  { value: 'manual', label: 'Manual Step' },
  { value: 'instant', label: 'Instant' },
] as const;

export const OptionsMenu: React.FC<OptionsMenuProps> = ({ isOpen, onClose }) => {
  const { state: gameState } = useGameSession();
  const { style } = useModalStyle();
  const later = useTimeout();
  const [snapshotSuccess, setSnapshotSuccess] = useState<string | null>(null);
  const [showResetAllConfirm, setShowResetAllConfirm] = useState(false);
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);
  const { activeThemeId, rollGameTheme } = useGameTheme();
  const {
    devMode,
    toggleDevMode,
    autoResolveUnambiguous,
    toggleAutoResolveUnambiguous,
    edgeScrollSpeed,
    setEdgeScrollSpeed,
    cardZoomLevel,
    setCardZoomLevel,
    defaultDifficulty,
    setDefaultDifficulty,
    defaultHeroicLevel,
    setDefaultHeroicLevel,
    villainPhasePacing,
    setVillainPhasePacing,
  } = useGameSettings();

  if (!isOpen) return null;

  const success = (message: string) => (
    <div className="p-2 rounded bg-emerald-100 border border-emerald-500 text-emerald-900 text-xs font-bold flex items-center gap-1.5">
      <span>✅</span>
      <span>{message}</span>
    </div>
  );

  return (
    <>
      <ModalScaffold
        title="Game Options & Settings"
        kicker="BULLPEN WORKSHOP"
        verb="blue"
        trigger={null}
        icon={<Settings className="w-5 h-5" />}
        onClose={onClose}
        maxWidthClass="max-w-lg"
        testId="options-menu"
        footer={
          <button
            type="button"
            onClick={onClose}
            className={`ml-auto px-6 py-2 text-sm font-comic font-black uppercase cursor-pointer flex items-center gap-2 ${style.btnGo}`}
          >
            <Check className="w-4 h-4" />
            <span>Save & Close</span>
          </button>
        }
      >
        {/* Theme: a chosen theme, or a random one for every game */}
        <SettingPanel icon={<Palette className="w-5 h-5 text-comic-red" />} title="Theme">
          <ThemePicker themed game={{ activeThemeId, onReroll: () => rollGameTheme() }} />
        </SettingPanel>

        <SettingPanel
          icon={<ZoomIn className="w-5 h-5 text-comic-blue" />}
          title="Card Zooming"
          wrapControl
          control={
            <Segmented options={ZOOM_OPTIONS} value={cardZoomLevel} onChange={setCardZoomLevel} />
          }
          description="Sets the constant hover zoom preview magnification (90%, 100%, 110%) across all cards on the board and in hand."
        />

        <SettingPanel
          icon={<Gauge className="w-5 h-5 text-comic-red" />}
          title="Edge-Scroll Velocity"
          wrapControl
          control={
            <Segmented
              options={SPEED_OPTIONS}
              value={edgeScrollSpeed}
              onChange={setEdgeScrollSpeed}
            />
          }
          description="Adjusts the camera panning speed when hovering your mouse near the left/right screen edges on multi-hero panoramic tabletops."
        />

        <SettingPanel
          icon={<ShieldAlert className="w-5 h-5 text-comic-red" />}
          title="Default Difficulty Mode"
          wrapControl
          control={
            <Segmented
              options={DIFFICULTY_OPTIONS}
              value={defaultDifficulty}
              onChange={setDefaultDifficulty}
            />
          }
          description="Sets default villain stages and encounter sets. Skirmish = Stage I only; Standard = Stage I $\rightarrow$ II; Expert = Stage II $\rightarrow$ III + Expert cards."
        />

        <SettingPanel
          icon={<Zap className="w-5 h-5 text-comic-yellow" />}
          title="Heroic Mode Variant"
          wrapControl
          control={
            <Segmented
              options={HEROIC_OPTIONS}
              value={defaultHeroicLevel}
              onChange={setDefaultHeroicLevel}
              activeTone="red"
            />
          }
          description="Official FFG difficulty variant: Deals $+L$ additional encounter cards to each player during Step 4. Available across all modes (Official on Expert, Custom variant on Standard/Skirmish)."
        />

        <SettingPanel
          icon={<Wrench className="w-5 h-5 text-comic-blue" />}
          title="Developer Mode (Dev Mode)"
          control={<Switch checked={devMode} onToggle={toggleDevMode} />}
          description="Enables hidden information inspectors (face-down draw deck inspection, search & debug scrying) for development and rules testing."
        >
          {devMode && (
            <div className="pt-2 border-t border-current/20 flex items-center justify-between gap-2">
              <div>
                <span className="font-bold text-xs">Card Play Statistics</span>
                <p className={`text-[11px] ${style.muted}`}>
                  Reset all historical card play and usage statistics.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowResetAllConfirm(true)}
                className={`px-3 py-1 font-comic text-xs font-bold cursor-pointer flex items-center gap-1.5 shrink-0 ${style.btnMove}`}
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Reset All Stats</span>
              </button>
            </div>
          )}
          {resetSuccess && success(resetSuccess)}
        </SettingPanel>

        <SettingPanel
          icon={<Sparkles className="w-5 h-5 text-comic-yellow" />}
          title="Auto-Resolve Unambiguous Actions"
          control={
            <Switch checked={autoResolveUnambiguous} onToggle={toggleAutoResolveUnambiguous} />
          }
          description="Automatically resolves abilities and targeting when only 1 legal choice exists. Disable to force decision prompts and view disabled options."
        />

        <SettingPanel
          icon={<Clock className="w-5 h-5 text-comic-red" />}
          title="Villain Phase Pacing"
          wrapControl
          control={
            <Segmented
              options={PACING_OPTIONS}
              value={villainPhasePacing}
              onChange={setVillainPhasePacing}
            />
          }
          description="Controls villain phase speed: Auto Normal (~900ms pause) or Fast (~450ms) with comic pacing; Manual Step (click Next Step or Spacebar); Instant (no pauses, auto-resolves immediately)."
        />

        <SettingPanel
          icon={<Camera className="w-5 h-5 text-comic-red" />}
          title="Diagnostic GameState Snapshot"
          control={
            <button
              type="button"
              onClick={async () => {
                await logGameStateSnapshot(gameState, undefined, 'Manual User Snapshot');
                setSnapshotSuccess('Snapshot saved to logs/gamestates/latest_gamestate.json');
                later(() => setSnapshotSuccess(null), 3000);
              }}
              className={`px-3 py-1 font-comic text-xs font-bold cursor-pointer ${style.btnMove}`}
            >
              📸 Save Snapshot
            </button>
          }
          description={
            <>
              Exports full table state to{' '}
              <code className="bg-white text-slate-900 px-1 py-0.5 rounded border font-mono text-[10px]">
                logs/gamestates/latest_gamestate.json
              </code>{' '}
              for instant debugging and test generation.
            </>
          }
        >
          {snapshotSuccess && success(snapshotSuccess)}
        </SettingPanel>

        <SettingPanel
          icon={<BookOpen className="w-5 h-5 text-comic-blue" />}
          title="Supplemental Reviewer & Editor"
          control={
            <button
              type="button"
              onClick={() => {
                window.open('/editor', '_blank');
              }}
              className="px-3 py-1 font-comic text-xs rounded border-2 border-comic-black bg-comic-accent text-white font-bold shadow-comic-sm cursor-pointer flex items-center gap-1.5 shrink-0"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Open Editor</span>
            </button>
          }
          description="Opens the visual Card Supplemental Reviewer & Editor in a new window to inspect, filter, and verify card rules."
        />
      </ModalScaffold>

      {showResetAllConfirm && (
        <ResetCardStatsConfirmModal
          isOpen={showResetAllConfirm}
          onClose={() => setShowResetAllConfirm(false)}
          isAll={true}
          onConfirm={async () => {
            await resetAllStats();
            setResetSuccess('All card play statistics have been reset.');
            later(() => setResetSuccess(null), 3000);
          }}
        />
      )}
    </>
  );
};

export default OptionsMenu;
