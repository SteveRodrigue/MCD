import React, { useState } from 'react';
import { Settings, Wrench, X, ShieldAlert, Check, Gauge, Zap, ZoomIn, Camera } from 'lucide-react';
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
    edgeScrollSpeed,
    setEdgeScrollSpeed,
    cardZoomLevel,
    setCardZoomLevel,
    defaultDifficulty,
    setDefaultDifficulty,
    defaultHeroicLevel,
    setDefaultHeroicLevel,
  } = useGameSettings();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white border-4 border-comic-black rounded-2xl shadow-comic-lg max-w-lg w-full p-6 space-y-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b-2 border-comic-black pb-3">
          <div className="flex items-center gap-2">
            <Settings className="w-6 h-6 text-comic-blue" />
            <h3 className="font-comic text-xl text-comic-black uppercase">
              Game Options & Settings
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg border-2 border-comic-black bg-rose-100 hover:bg-rose-200 text-comic-red transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Settings Body */}
        <div className="space-y-4">
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
        </div>

        {/* Footer */}
        <div className="text-center pt-2 border-t border-slate-200">
          <button
            onClick={onClose}
            className="comic-button-primary px-6 py-2 text-sm font-comic cursor-pointer flex items-center gap-2 mx-auto"
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
