"use client";

import { Canvas } from "@react-three/fiber";
import { SettingsMenu } from "../components/ui/SettingsMenu";
import { VirtualJoystick } from "../components/ui/VirtualJoystick";
import { DebugInput } from "../components/DebugInput";
import { MusicManager } from "../components/audio/MusicManager";
import { SFXPool } from "../components/audio/SFXPool";
import { useState } from "react";
import { Settings } from "lucide-react";
import { NetworkedWorld } from "../components/game/NetworkedWorld";
import { DungeonMap } from "../components/debug/DungeonMap";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { Minitel } from "../components/effects/MinitelEffect";
import { MainMenu } from "../components/ui/MainMenu";
import { HUD } from "../components/ui/HUD";
import { useLobbyStore, LobbyState } from "../stores/lobbyStore";
import * as THREE from 'three';

// Add THREE to global for debugging
if (typeof window !== 'undefined') {
  (window as any).THREE = THREE;
}

export default function GameClient() {
  const [showSettings, setShowSettings] = useState(false);
  const lobbyState = useLobbyStore((state) => state.state);

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden font-vt323">
      <MusicManager />

      {/* 3D Scene - Only render if GAME or CONNECTING (to preload) */}
      {(lobbyState === LobbyState.GAME || lobbyState === LobbyState.CONNECTING) && (
        <div className="absolute inset-0 z-0">
          <Canvas>
            <color attach="background" args={["#101015"]} />
            <ambientLight intensity={0.5} />
            {/* <pointLight position={[10, 10, 10]} /> */}

            <SFXPool />

            <DebugInput />
            <NetworkedWorld />

            {/* TEMPORARY: Disable Post-Processing to diagnose WebGL crash
            <EffectComposer>
              <Bloom
                intensity={0.5}
                luminanceThreshold={0.8}
                luminanceSmoothing={0.02}
                kernelSize={3}
              />
              <Minitel
                curvature={3.0}
                scanlineIntensity={0.15}
                noiseIntensity={0.08}
                vignette={1.5}
              />
            </EffectComposer>
            */}
          </Canvas>
        </div>
      )}

      {/* UI Overlay */}
      <div className="absolute inset-0 z-10 pointer-events-none">

        {/* Main Menu (Handles its own visibility / mount) */}
        {lobbyState !== LobbyState.GAME && (
           <MainMenu />
        )}

        {/* HUD (Only in Game) */}
        {lobbyState === LobbyState.GAME && (
           <HUD />
        )}

        {/* Settings Toggle */}
        <div className="absolute top-8 right-4 pointer-events-auto z-50">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 bg-[#ff00ff] text-black rounded hover:bg-[#00ffff] transition shadow-[0_0_10px_rgba(255,0,255,0.5)]"
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

        {/* Virtual Joystick (Auto-shows if Touch and in Game) */}
        {lobbyState === LobbyState.GAME && (
          <div className="pointer-events-auto">
             <VirtualJoystick />
          </div>
        )}

        {lobbyState === LobbyState.GAME && <DungeonMap />}

      </div>
    </div>
  );
}
