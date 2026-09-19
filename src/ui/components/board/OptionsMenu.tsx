import React, { useState } from 'react';
import {
  Settings,
  Wrench,
  X,
  ShieldAlert,
  Check,
  Gauge,
  Zap,
  ZoomIn,
  Camera,
  BookOpen,
  ExternalLink,
  Sparkles,
  Clock,
} from 'lucide-react';
import { useGameSettings } from '../../context/useGameSettings';
import { GameState } from '../../../engine/models';
import { logGameStateSnapshot } from '../../services/gamestate-logger-service';

interface OptionsMenuProps {
  isOpen: boolean;
  onClose: () => void;
  gameState?: GameState;
}

export const OptionsMenu: React.FC<OptionsMenuProps> = ({ isOpen, onClose, gameState }) => {
  const [snapshotSuccess, setSnapshotSuccess] = useState<string | null>(null);
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

  return (
    <div className="fixed inset-0 bg-comic-black/80 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-comic-paper border-4 border-comic-black rounded-xl shadow-comic-xl max-w-lg w-full flex flex-col max-h-[90vh] overflow-hidden font-comic">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-comic-darkBlue text-white border-b-4 border-comic-black select-none">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-comic-black rounded-lg border border-white/20 shadow-comic-sm">
              <Settings className="w-5 h-5 text-comic-yellow" />
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-wider text-comic-yellow">
                BULLPEN WORKSHOP
              </div>
              <h3 className="font-comic text-xl text-white uppercase leading-none">
                Game Options & Settings
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg border-2 border-comic-black bg-comic-black hover:bg-slate-800 text-white transition-all cursor-pointer shadow-comic-sm"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Settings Body */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1 font-comic">
          {/* Card Zooming Scale Setting */}
          <div className="bg-amber-50 p-4 rounded-xl border-2 border-comic-black shadow-comic-sm space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <ZoomIn className="w-5 h-5 text-comic-blue" />
                <span className="font-comic text-base text-comic-black">Card Zooming</span>
              </div>

              {/* Segmented Zoom Controls */}
              <div className="flex items-center bg-white rounded-lg border-2 border-comic-black p-0.5 shadow-comic-sm">
                {(['small', 'normal', 'larger'] as const).map((level) => (
                  <button
                    key={level}
                    onClick={() => setCardZoomLevel(level)}
                    className={`px-3 py-1 font-comic text-xs uppercase rounded transition-all cursor-pointer font-bold ${
                      cardZoomLevel === level
                        ? 'bg-comic-yellow text-comic-black border border-comic-black shadow-comic-sm'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {level === 'small'
                      ? 'Small (90%)'
                      : level === 'normal'
                        ? 'Normal (Default)'
                        : 'Larger (110%)'}
                  </button>
                ))}
              </div>
            </div>

            <p className="text-xs text-slate-600">
              Sets the constant hover zoom preview magnification (90%, 100%, 110%) across all cards
              on the board and in hand.
            </p>
          </div>

          {/* Panoramic Edge-Scroll Velocity Setting */}
          <div className="bg-amber-50 p-4 rounded-xl border-2 border-comic-black shadow-comic-sm space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <Gauge className="w-5 h-5 text-comic-red" />
                <span className="font-comic text-base text-comic-black">Edge-Scroll Velocity</span>
              </div>

              {/* Segmented Speed Controls */}
              <div className="flex items-center bg-white rounded-lg border-2 border-comic-black p-0.5 shadow-comic-sm">
                {(['slow', 'normal', 'fast'] as const).map((speed) => (
                  <button
                    key={speed}
                    onClick={() => setEdgeScrollSpeed(speed)}
                    className={`px-3 py-1 font-comic text-xs uppercase rounded transition-all cursor-pointer font-bold ${
                      edgeScrollSpeed === speed
                        ? 'bg-comic-yellow text-comic-black border border-comic-black shadow-comic-sm'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {speed === 'slow' ? 'Slow' : speed === 'normal' ? 'Normal (Default)' : 'Fast'}
                  </button>
                ))}
              </div>
            </div>

            <p className="text-xs text-slate-600">
              Adjusts the camera panning speed when hovering your mouse near the left/right screen
              edges on multi-hero panoramic tabletops.
            </p>
          </div>

          {/* Optional Rules: Default Difficulty Setting */}
          <div className="bg-amber-50 p-4 rounded-xl border-2 border-comic-black shadow-comic-sm space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-comic-red" />
                <span className="font-comic text-base text-comic-black">
                  Default Difficulty Mode
                </span>
              </div>

              {/* Segmented Difficulty Controls */}
              <div className="flex items-center bg-white rounded-lg border-2 border-comic-black p-0.5 shadow-comic-sm">
                {(['SKIRMISH', 'STANDARD', 'EXPERT'] as const).map((diff) => (
                  <button
                    key={diff}
                    onClick={() => setDefaultDifficulty(diff)}
                    className={`px-3 py-1 font-comic text-xs uppercase rounded transition-all cursor-pointer font-bold ${
                      defaultDifficulty === diff
                        ? 'bg-comic-yellow text-comic-black border border-comic-black shadow-comic-sm'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {diff === 'SKIRMISH' ? 'Skirmish' : diff === 'STANDARD' ? 'Standard' : 'Expert'}
                  </button>
                ))}
              </div>
            </div>

            <p className="text-xs text-slate-600">
              Sets default villain stages and encounter sets. Skirmish = Stage I only; Standard =
              Stage I $\rightarrow$ II; Expert = Stage II $\rightarrow$ III + Expert cards.
            </p>
          </div>

          {/* Optional Rules: Heroic Mode Variant */}
          <div className="bg-amber-50 p-4 rounded-xl border-2 border-comic-black shadow-comic-sm space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-comic-yellow" />
                <span className="font-comic text-base text-comic-black">Heroic Mode Variant</span>
              </div>

              {/* Segmented Heroic Level Controls */}
              <div className="flex items-center bg-white rounded-lg border-2 border-comic-black p-0.5 shadow-comic-sm">
                {[0, 1, 2, 3].map((lvl) => (
                  <button
                    key={lvl}
                    onClick={() => setDefaultHeroicLevel(lvl)}
                    className={`px-2.5 py-1 font-comic text-xs uppercase rounded transition-all cursor-pointer font-bold ${
                      defaultHeroicLevel === lvl
                        ? 'bg-comic-red text-white border border-comic-black shadow-comic-sm'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {lvl === 0 ? 'Off (0)' : `Heroic ${lvl} (+${lvl})`}
                  </button>
                ))}
              </div>
            </div>

            <p className="text-xs text-slate-600">
              Official FFG difficulty variant: Deals $+L$ additional encounter cards to each player
              during Step 4. Available across all modes (Official on Expert, Custom variant on
              Standard/Skirmish).
            </p>
          </div>

          {/* Developer Mode Toggle */}
          <div className="bg-amber-50 p-4 rounded-xl border-2 border-comic-black shadow-comic-sm space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wrench className="w-5 h-5 text-comic-blue" />
                <span className="font-comic text-base text-comic-black">
                  Developer Mode (Dev Mode)
                </span>
              </div>

              {/* Toggle Switch */}
              <button
                onClick={toggleDevMode}
                className={`relative inline-flex h-7 w-14 items-center rounded-full border-2 border-comic-black transition-colors cursor-pointer shadow-comic-sm ${
                  devMode ? 'bg-emerald-500' : 'bg-slate-300'
                }`}
                role="switch"
                aria-checked={devMode}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white border border-comic-black transition-transform ${
                    devMode ? 'translate-x-7' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Enables hidden information inspectors (face-down draw deck inspection, search & debug
              scrying) for development and rules testing.
            </p>
          </div>

          {/* Auto-Resolve Unambiguous Actions Setting */}
          <div className="bg-amber-50 p-4 rounded-xl border-2 border-comic-black shadow-comic-sm space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-comic-yellow" />
                <span className="font-comic text-base text-comic-black">
                  Auto-Resolve Unambiguous Actions
                </span>
              </div>

              {/* Toggle Switch */}
              <button
                onClick={toggleAutoResolveUnambiguous}
                className={`relative inline-flex h-7 w-14 items-center rounded-full border-2 border-comic-black transition-colors cursor-pointer shadow-comic-sm ${
                  autoResolveUnambiguous ? 'bg-emerald-500' : 'bg-slate-300'
                }`}
                role="switch"
                aria-checked={autoResolveUnambiguous}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white border border-comic-black transition-transform ${
                    autoResolveUnambiguous ? 'translate-x-7' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Automatically resolves abilities and targeting when only 1 legal choice exists.
              Disable to force decision prompts and view disabled options.
            </p>
          </div>

          {/* Villain Phase Pacing Setting */}
          <div className="bg-amber-50 p-4 rounded-xl border-2 border-comic-black shadow-comic-sm space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-comic-red" />
                <span className="font-comic text-base text-comic-black">Villain Phase Pacing</span>
              </div>

              {/* Segmented Pacing Controls */}
              <div className="flex items-center bg-white rounded-lg border-2 border-comic-black p-0.5 shadow-comic-sm flex-wrap">
                {(
                  [
                    { id: 'auto_normal', label: 'Auto (Normal)' },
                    { id: 'auto_fast', label: 'Auto (Fast)' },
                    { id: 'manual', label: 'Manual Step' },
                    { id: 'instant', label: 'Instant' },
                  ] as const
                ).map(({ id, label }) => (
                  <button
                    key={id}
                    onClick={() => setVillainPhasePacing(id)}
                    className={`px-2.5 py-1 font-comic text-xs uppercase rounded transition-all cursor-pointer font-bold ${
                      villainPhasePacing === id
                        ? 'bg-comic-yellow text-comic-black border border-comic-black shadow-comic-sm'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <p className="text-xs text-slate-600">
              Controls villain phase speed: Auto Normal (~900ms pause) or Fast (~450ms) with comic
              pacing; Manual Step (click Next Step or Spacebar); Instant (no pauses, auto-resolves
              immediately).
            </p>
          </div>

          {/* Diagnostic GameState Snapshot */}
          {gameState && (
            <div className="bg-amber-50 p-4 rounded-xl border-2 border-comic-black shadow-comic-sm space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Camera className="w-5 h-5 text-comic-red" />
                  <span className="font-comic text-base text-comic-black">
                    Diagnostic GameState Snapshot
                  </span>
                </div>

                <button
                  type="button"
                  onClick={async () => {
                    await logGameStateSnapshot(gameState, undefined, 'Manual User Snapshot');
                    setSnapshotSuccess('Snapshot saved to logs/gamestates/latest_gamestate.json');
                    setTimeout(() => setSnapshotSuccess(null), 3000);
                  }}
                  className="px-3 py-1 font-comic text-xs rounded border-2 border-comic-black bg-comic-yellow hover:bg-amber-300 text-comic-black font-bold shadow-comic-sm cursor-pointer transition-all hover:scale-105"
                >
                  📸 Save Snapshot
                </button>
              </div>

              <p className="text-xs text-slate-600">
                Exports full table state to{' '}
                <code className="bg-white px-1 py-0.5 rounded border font-mono text-[10px]">
                  logs/gamestates/latest_gamestate.json
                </code>{' '}
                for instant debugging and test generation.
              </p>

              {snapshotSuccess && (
                <div className="p-2 rounded bg-emerald-100 border border-emerald-500 text-emerald-900 text-xs font-bold flex items-center gap-1.5 animate-in fade-in duration-200">
                  <span>✅</span>
                  <span>{snapshotSuccess}</span>
                </div>
              )}
            </div>
          )}

          {/* Supplemental Reviewer & Editor */}
          <div className="bg-amber-50 p-4 rounded-xl border-2 border-comic-black shadow-comic-sm space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-comic-blue" />
                <span className="font-comic text-base text-comic-black">
                  Supplemental Reviewer & Editor
                </span>
              </div>

              <button
                type="button"
                onClick={() => {
                  window.open('/editor', '_blank');
                }}
                className="px-3 py-1 font-comic text-xs rounded border-2 border-comic-black bg-comic-accent text-white font-bold shadow-comic-sm cursor-pointer transition-all hover:scale-105 flex items-center gap-1.5"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open Editor</span>
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Opens the visual Card Supplemental Reviewer & Editor in a new window to inspect,
              filter, and verify card rules.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-comic-paper border-t-2 border-comic-black text-center flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 text-sm font-comic font-black uppercase bg-comic-yellow hover:bg-yellow-400 text-comic-black rounded-lg border-2 border-comic-black shadow-comic-sm cursor-pointer flex items-center gap-2 transition-all hover:scale-105 active:scale-95"
          >
            <Check className="w-4 h-4" />
            <span>Save & Close</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default OptionsMenu;
