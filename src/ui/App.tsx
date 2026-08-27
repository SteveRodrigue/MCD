import React from 'react';
import { Shield, Zap, Sparkles } from 'lucide-react';

export const App: React.FC = () => {
  return (
    <div className="relative min-h-screen w-full bg-comic-paper flex flex-col items-center justify-center p-6 overflow-hidden">
      {/* Halftone Dot Overlay */}
      <div className="absolute inset-0 bg-bendy-dots pointer-events-none" />

      {/* Main Comic Panel Card */}
      <div className="relative z-10 comic-panel p-8 max-w-xl w-full text-center transform rotate-[-0.5deg]">
        {/* Onomatopoeia Badge */}
        <div className="absolute -top-6 -right-6 bg-comic-yellow border-comic border-comic-black px-4 py-2 font-comic text-2xl tracking-wider text-comic-red shadow-comic transform rotate-12">
          KAPOW!
        </div>

        <h1 className="font-comic text-5xl md:text-6xl text-comic-red tracking-wide drop-shadow-sm mb-2">
          MARVEL CHAMPIONS
        </h1>
        <p className="font-comic text-2xl text-comic-blue tracking-wider mb-6">
          DIGITAL EDITION
        </p>

        <div className="flex justify-center gap-4 my-6">
          <div className="flex items-center gap-2 bg-amber-100 border-2 border-comic-black px-3 py-1.5 rounded font-semibold text-sm shadow-comic-sm">
            <Zap className="w-4 h-4 text-resource-energy" />
            <span>Pure Headless Engine</span>
          </div>
          <div className="flex items-center gap-2 bg-sky-100 border-2 border-comic-black px-3 py-1.5 rounded font-semibold text-sm shadow-comic-sm">
            <Shield className="w-4 h-4 text-comic-blue" />
            <span>60s Pop-Art Aesthetic</span>
          </div>
        </div>

        <div className="comic-bubble p-4 text-sm font-medium text-slate-700 bg-amber-50">
          <p className="flex items-center justify-center gap-1">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>Project scaffolded successfully! Engine ready for Phase 1 modeling.</span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default App;
