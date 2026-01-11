import { useEffect, useState } from 'react';
import { useLobbyStore } from '../../stores/lobbyStore';
import { cn } from '../../lib/utils';

export function MainMenu() {
  const { roomCode, setRoomCode, connect, errorMessage } = useLobbyStore();
  const [blink, setBlink] = useState(true);

  // Blinking cursor effect
  useEffect(() => {
    const interval = setInterval(() => setBlink(b => !b), 530); // 530ms standard terminal blink
    return () => clearInterval(interval);
  }, []);

  const handleConnect = (e: React.FormEvent) => {
    e.preventDefault();
    if (roomCode.length > 0) {
       connect(roomCode);
    }
  };

  return (
    <div className="absolute inset-0 bg-black flex flex-col items-center justify-center font-vt323 text-[#00ffff] p-4 z-50 pointer-events-auto">

      {/* Header */}
      <div className="mb-12 text-center space-y-2">
        <h1 className="text-6xl md:text-8xl text-[#ff00ff] drop-shadow-[0_0_10px_rgba(255,0,255,0.8)] animate-pulse">
          3615 LA BAULE
        </h1>
        <p className="text-xl md:text-2xl text-[#33ff00]">
           &gt; SYSTEME VIDEOTEX V.23
        </p>
      </div>

      {/* Terminal Interface */}
      <div className="w-full max-w-md bg-black border-2 border-[#00ffff] p-6 shadow-[0_0_15px_rgba(0,255,255,0.3)] relative overflow-hidden">

        {/* Scanline decoration */}
        <div className="absolute inset-0 bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.5)_50%)] bg-[length:100%_4px] pointer-events-none opacity-20"></div>

        <form onSubmit={handleConnect} className="relative z-10 flex flex-col gap-6">

          <div className="space-y-4">
             <div className="flex justify-between text-[#ffff00]">
                <span>BAUD: 1200/75</span>
                <span>VRAM: 8KB</span>
             </div>

             <div className="border-b border-[#00ffff] pb-2">
                <label className="block text-xl mb-2 text-[#00ffff]">
                  CODE SALLE:
                </label>
                <div className="flex items-center text-3xl">
                   <span className="mr-2 text-[#33ff00]">&gt;</span>
                   <input
                      type="text"
                      value={roomCode}
                      onChange={(e) => setRoomCode(e.target.value)}
                      className="bg-transparent border-none outline-none text-[#33ff00] w-full uppercase placeholder-[#33ff00]/30"
                      placeholder="ENTREZ LE CODE..."
                      maxLength={6}
                      autoFocus
                   />
                   <span className={cn("w-3 h-8 bg-[#33ff00] ml-1", blink ? "opacity-100" : "opacity-0")}></span>
                </div>
             </div>
          </div>

          {errorMessage && (
             <div className="text-[#ff0000] bg-[#ff0000]/10 p-2 border border-[#ff0000] animate-pulse">
                *** ERREUR: {errorMessage} ***
             </div>
          )}

          <button
             type="submit"
             disabled={roomCode.length === 0}
             className="w-full py-3 bg-[#33ff00] text-black text-2xl font-bold hover:bg-[#00ffff] hover:text-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed group"
          >
             <span className="group-hover:hidden">CONNEXION</span>
             <span className="hidden group-hover:inline">ENVOI...</span>
          </button>

        </form>

      </div>

      <div className="mt-8 text-center text-[#0000ff] text-sm">
         (C) 198X - 3615 CORP. <br/>
         COUT DE LA CONNEXION: 3615 FF/MIN
      </div>

    </div>
  );
}
