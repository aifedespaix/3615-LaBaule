import { useGameUI } from "../../lib/network/useNetworkGame";
import { useLevelStore } from "../../stores/levelStore";
import { cn } from "../../lib/utils";
import { Heart, Zap, Crosshair } from "lucide-react";
import { useEffect, useState } from "react";
import { WEAPONS, WeaponType } from "@3615/shared/weapons";

export function HUD() {
  const gameState = useGameUI();
  const levelData = useLevelStore((state) => state.levelData);
  const localPlayer = gameState.localPlayer;

  // Animation state for ammo change
  const [ammoScale, setAmmoScale] = useState(1);
  const [lastAmmo, setLastAmmo] = useState(0);

  useEffect(() => {
     if (localPlayer?.ammo !== lastAmmo) {
        setAmmoScale(1.5);
        const t = setTimeout(() => setAmmoScale(1), 100);
        setLastAmmo(localPlayer?.ammo || 0);
        return () => clearTimeout(t);
     }
  }, [localPlayer?.ammo, lastAmmo]);

  if (!localPlayer) return null;

  const weaponName = WEAPONS[localPlayer.weapon as WeaponType]?.name || "FISTS";
  const isLowAmmo = (localPlayer.ammo || 0) < 5 && localPlayer.weapon !== WeaponType.FISTS;
  const isLowHp = localPlayer.hp < 30;

  return (
    <div className="absolute inset-0 pointer-events-none font-vt323 text-shadow-sm select-none">

       {/* Top Bar - Minitel Header */}
       <div className="absolute top-0 left-0 right-0 h-8 bg-black flex items-center justify-between px-4 text-[#00ffff] border-b border-[#333]">
          <div className="flex items-center gap-4">
             <span className="text-[#ff00ff]">SCORE:</span>
             <span className="text-white tracking-widest">{localPlayer.score?.toString().padStart(6, '0') || '000000'}</span>
          </div>
          <div className="text-[#ffff00]">
             3615 LA BAULE
          </div>
          <div className="flex items-center gap-4">
             <span className="text-[#ff00ff]">ETAGE:</span>
             <span className="text-white">-2</span>
          </div>
       </div>

       {/* Diegetic Ammo Counter (Floating near player, approximated here as centered-bottom-right) */}
       {/* Actually, prompt asks for "Billboard 3D" or floating.
           Since this is a HTML Overlay, we can put it in a fixed position
           or project 3D pos to 2D.
           For now, let's stick to a clean UI layout as per Minitel structure
           but stylized as "floating" elements.
       */}
       <div className="absolute bottom-32 right-32 transform translate-x-1/2 translate-y-1/2">
           <div className={cn(
               "text-6xl font-bold transition-transform duration-100",
               isLowAmmo ? "text-[#ff0000] animate-pulse" : "text-[#ffff00]"
           )}
           style={{ transform: `scale(${ammoScale})` }}
           >
              {localPlayer.weapon === WeaponType.FISTS ? '∞' : localPlayer.ammo}
           </div>
           <div className="text-[#00ffff] text-right text-xl">
              {weaponName}
           </div>
       </div>


       {/* Bottom Bar - Status Context */}
       <div className="absolute bottom-0 left-0 right-0 h-10 bg-black flex items-center px-4 gap-6 border-t border-[#333] text-[#00ffff]">

          {/* Health */}
          <div className="flex items-center gap-2 w-48">
             <Heart size={18} className={isLowHp ? "text-[#ff0000] animate-bounce" : "text-[#33ff00]"} fill={isLowHp ? "#ff0000" : "#33ff00"} />
             <div className="h-4 flex-1 bg-[#111] border border-[#333] relative">
                <div
                  className={cn("h-full transition-all duration-300", isLowHp ? "bg-[#ff0000]" : "bg-[#33ff00]")}
                  style={{ width: `${localPlayer.hp}%` }}
                />
             </div>
             <span className="w-8 text-right">{localPlayer.hp}</span>
          </div>

          <div className="flex-1 text-center text-[#ffff00] animate-pulse">
             {gameState.events.length > 0 && "TRANSMISSION..."}
          </div>

          {/* Context Keys */}
          <div className="flex gap-4 text-sm">
             <div className="bg-[#0000ff] text-white px-2 rounded-sm">GUIDE</div>
             <div className="bg-[#ffff00] text-black px-2 rounded-sm">CORRECTION</div>
             <div className="bg-[#33ff00] text-black px-2 rounded-sm">ENVOI</div>
          </div>
       </div>

       {/* Screen Vignette for Damage */}
       <div
         className="absolute inset-0 pointer-events-none transition-opacity duration-300 mix-blend-overlay"
         style={{
            boxShadow: `inset 0 0 ${100 - localPlayer.hp}px rgba(255,0,0,${(100 - localPlayer.hp) / 100})`,
            opacity: (100 - localPlayer.hp) / 100
         }}
       />

    </div>
  );
}
