"use client";

import { Canvas } from "@react-three/fiber";
import { SettingsMenu } from "../components/ui/SettingsMenu";
import { VirtualJoystick } from "../components/ui/VirtualJoystick";
import { DebugInput } from "../components/DebugInput";
import { useState } from "react";
import { Settings } from "lucide-react";

export default function GameClient() {
  const [showSettings, setShowSettings] = useState(false);

  return (
    <div className="relative w-full h-screen bg-neutral-900 overflow-hidden">

      {/* 3D Scene */}
      <div className="absolute inset-0 z-0">
        <Canvas>
          <color attach="background" args={["#101015"]} />
          <ambientLight intensity={0.5} />
          <pointLight position={[10, 10, 10]} />

          {/* Input System & Debug Visuals */}
          <DebugInput />

          <mesh position={[2, 0, 0]}>
            <boxGeometry />
            <meshStandardMaterial color="orange" />
          </mesh>
        </Canvas>
      </div>

      {/* UI Overlay */}
      <div className="absolute inset-0 z-10 pointer-events-none">

        {/* Settings Toggle */}
        <div className="absolute top-4 right-4 pointer-events-auto z-50">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 bg-amber-600 text-black rounded hover:bg-amber-500 transition shadow-[0_0_10px_rgba(245,158,11,0.5)]"
          >
            <Settings size={24} />
          </button>
        </div>

        {/* Settings Menu Modal */}
        {showSettings && (
          <div className="absolute inset-0 bg-black/80 flex items-center justify-center pointer-events-auto p-4 z-40">
             <SettingsMenu />
          </div>
        )}

        {/* Virtual Joystick (Auto-shows if Touch) */}
        <div className="pointer-events-auto">
           <VirtualJoystick />
        </div>

        {/* Instructions */}
        <div className="absolute bottom-4 left-4 text-amber-500/50 font-mono text-xs">
           DEBUG MODE: INPUT SYSTEM
        </div>

      </div>
    </div>
  );
}
