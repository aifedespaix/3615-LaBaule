"use client";

import React, { useEffect } from 'react';
import { useInputStore, BindableAction, DeviceType } from '../../stores/inputStore';
import { cn } from '@/lib/utils';
import { X, RotateCcw } from 'lucide-react';

// Helper to format key names
const formatKey = (key: string | undefined) => {
  if (!key) return "---";
  return key.replace('Key', '').replace('Digit', '').replace('Mouse', 'M_');
};

export const SettingsMenu = () => {
  const {
    bindings,
    activeDevice,
    isListening,
    setBinding,
    startListening,
    stopListening,
    resetDefaults
  } = useInputStore();

  // Listen for key press when rebinding
  useEffect(() => {
    if (!isListening) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      // Allow Escape to cancel
      if (e.code === 'Escape') {
        stopListening();
        return;
      }
      setBinding(isListening, 'KEYBOARD', e.code);
    };

    const handleGamepad = () => {
       const gp = navigator.getGamepads()[0];
       if (gp) {
          gp.buttons.forEach((b, i) => {
             if (b.pressed) {
                // Determine button name
                let name = `Button${i}`;
                // Map common indices to names for better UI
                const map = ['ButtonSouth', 'ButtonEast', 'ButtonWest', 'ButtonNorth', 'LeftBumper', 'RightBumper', 'LeftTrigger', 'RightTrigger', 'ButtonSelect', 'ButtonStart', 'LeftStick', 'RightStick', 'DpadUp', 'DpadDown', 'DpadLeft', 'DpadRight'];
                if (i < map.length) name = map[i];

                setBinding(isListening, 'GAMEPAD', name);
             }
          });
       }
       requestAnimationFrame(handleGamepad);
    };

    window.addEventListener('keydown', handleKeyDown);

    // Gamepad polling for rebind
    const raf = requestAnimationFrame(handleGamepad);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      cancelAnimationFrame(raf);
    };
  }, [isListening, setBinding, stopListening]);


  return (
    <div className="p-6 bg-slate-950 border-2 border-amber-600/50 shadow-[0_0_20px_rgba(217,119,6,0.2)] text-amber-500 font-mono w-full max-w-2xl mx-auto backdrop-blur-md">
      {/* Header */}
      <div className="flex justify-between items-center mb-6 border-b border-amber-600/30 pb-4">
        <h2 className="text-2xl uppercase tracking-widest text-amber-400 drop-shadow-[0_0_5px_rgba(251,191,36,0.8)]">
          // CONFIGURATION_ENTREES
        </h2>
        <div className="flex items-center gap-4">
            <span className={cn("text-xs px-2 py-1 border rounded", activeDevice === 'KEYBOARD' ? "bg-amber-500 text-black border-amber-400" : "border-slate-700 text-slate-700")}>CLAVIER</span>
            <span className={cn("text-xs px-2 py-1 border rounded", activeDevice === 'GAMEPAD' ? "bg-amber-500 text-black border-amber-400" : "border-slate-700 text-slate-700")}>MANETTE</span>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 gap-2 max-h-[60vh] overflow-y-auto custom-scrollbar">
        {(Object.keys(bindings) as BindableAction[]).map((action) => {
          const binding = bindings[action];
          const isRebinding = isListening === action;

          return (
            <div key={action} className="flex items-center justify-between p-2 hover:bg-amber-900/20 group transition-colors">
              <span className="w-1/3 font-bold text-amber-200 text-sm">{action}</span>

              {/* Keyboard Bind */}
              <button
                onClick={() => startListening(action)}
                disabled={isRebinding}
                className={cn(
                  "w-1/3 text-center border border-amber-800/50 py-1 mx-2 relative overflow-hidden text-sm",
                  isRebinding ? "animate-pulse bg-amber-500 text-black border-amber-400" : "bg-black/40 hover:border-amber-500/80",
                  !binding.keyboard && "text-red-500"
                )}
              >
                {isRebinding ? "PRESS KEY..." : (formatKey(binding.keyboard) || "UNBOUND")}
              </button>

              {/* Gamepad Bind */}
              <div className={cn(
                  "w-1/3 text-center border border-amber-800/50 py-1 mx-2 text-slate-500 text-sm",
                  !binding.gamepad && "text-red-900"
                )}
              >
                 {binding.gamepad || "---"}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="mt-8 pt-4 border-t border-amber-600/30 flex justify-between">
        <button
            onClick={resetDefaults}
            className="flex items-center gap-2 px-4 py-2 border border-red-900/50 text-red-400 hover:bg-red-900/20 hover:border-red-500 transition-all uppercase text-sm"
        >
            <RotateCcw size={14} /> Reset Defaults
        </button>

        <div className="text-xs text-amber-700 self-center">
            AUTO-SAVE ENABLED
        </div>
      </div>
    </div>
  );
};
