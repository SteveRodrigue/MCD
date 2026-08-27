import React from 'react';
import { Settings, Wrench, X, ShieldAlert, Check } from 'lucide-react';
import { useGameSettings } from '../../context/GameSettingsContext';

interface OptionsMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

export const OptionsMenu: React.FC<OptionsMenuProps> = ({ isOpen, onClose }) => {
  const { devMode, toggleDevMode, sideBySideLayout, toggleSideBySide } = useGameSettings();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white border-4 border-comic-black rounded-2xl shadow-comic-lg max-w-lg w-full p-6 space-y-6">
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
          {/* Side-by-Side Dual Hero Layout Toggle */}
          <div className="bg-amber-50 p-4 rounded-xl border-2 border-comic-black shadow-comic-sm space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-comic text-base text-comic-black">
                  Side-by-Side Dual Hero View
                </span>
              </div>

              {/* Toggle Switch */}
              <button
                onClick={toggleSideBySide}
                className={`relative inline-flex h-7 w-14 items-center rounded-full border-2 border-comic-black transition-colors cursor-pointer shadow-comic-sm ${
                  sideBySideLayout ? 'bg-amber-400' : 'bg-slate-300'
                }`}
                role="switch"
                aria-checked={sideBySideLayout}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white border border-comic-black transition-transform ${
                    sideBySideLayout ? 'translate-x-7' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              When playing with 2+ heroes on widescreen viewports, displays the Current Hero and the Next Hero side-by-side.
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
              Enables hidden information inspectors (face-down draw deck inspection, search & debug scrying) for development and rules testing.
            </p>

            <div className="pt-1 flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
              <ShieldAlert className="w-3.5 h-3.5 text-comic-blue" />
              <span>
                {devMode
                  ? 'Active: Draw decks can be clicked to inspect card ordering.'
                  : 'Inactive: Draw decks are strictly hidden per standard game rules.'}
              </span>
            </div>
          </div>
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
