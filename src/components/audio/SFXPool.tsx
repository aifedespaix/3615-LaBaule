import { useFrame, useThree } from "@react-three/fiber";
import { useRef, useMemo, useEffect, useState } from "react";
import * as THREE from "three";
import { useSoundStore } from "../../stores/useSoundStore";

const POOL_SIZE = 20;

export function SFXPool() {
  const { camera } = useThree();
  const [listener] = useState(() => new THREE.AudioListener());

  // Attach listener to camera
  useEffect(() => {
    camera.add(listener);
    return () => {
      camera.remove(listener);
    };
  }, [camera, listener]);

  const audioRefs = useRef<(THREE.PositionalAudio | null)[]>([]);

  const { consumeSoundQueue, sfxVolume, masterVolume, isMuted } = useSoundStore();

  const audioLoader = useMemo(() => new THREE.AudioLoader(), []);
  const bufferCache = useRef<Map<string, AudioBuffer>>(new Map());

  // Initialize refs array
  if (audioRefs.current.length !== POOL_SIZE) {
    audioRefs.current = Array(POOL_SIZE).fill(null);
  }

  const loadBuffer = async (key: string): Promise<AudioBuffer | null> => {
    if (bufferCache.current.has(key)) {
      return bufferCache.current.get(key)!;
    }

    const url = `/assets/sounds/sfx/${key}.mp3`;

    return new Promise((resolve) => {
      audioLoader.load(
        url,
        (buffer) => {
          bufferCache.current.set(key, buffer);
          resolve(buffer);
        },
        undefined, // onProgress
        (err) => {
          console.warn(`[SFXPool] Missing sound file: ${url}`);
          resolve(null);
        }
      );
    });
  };

  useFrame(() => {
    const queue = consumeSoundQueue();
    if (queue.length === 0) return;

    const currentVolume = isMuted ? 0 : sfxVolume * masterVolume;
    const reservedIndices = new Set<number>();

    queue.forEach((event) => {
      // Find a free emitter that is NOT playing AND NOT reserved in this frame
      const freeIndex = audioRefs.current.findIndex(
        (a, i) => a && !a.isPlaying && !reservedIndices.has(i)
      );

      if (freeIndex === -1) {
        return;
      }

      // Synchronously reserve this index
      reservedIndices.add(freeIndex);

      const audioNode = audioRefs.current[freeIndex];
      if (!audioNode) return; // Should not happen if findIndex worked

      // Fire and forget loading
      loadBuffer(event.key).then((buffer) => {
        if (!buffer) return;

        // Verify node is still valid (component didn't unmount)
        if (!audioNode) return;

        // If something else started playing on this node (very unlikely given logic), stop it
        if (audioNode.isPlaying) audioNode.stop();

        audioNode.setBuffer(buffer);
        audioNode.setVolume(currentVolume);

        if (event.position) {
          audioNode.position.set(event.position[0], event.position[1], event.position[2]);
          audioNode.updateMatrixWorld();
        } else {
          audioNode.position.set(0, 0, 0);
        }

        audioNode.play();
      });
    });
  });

  // Init/Update volumes and physics
  useEffect(() => {
    const vol = isMuted ? 0 : sfxVolume * masterVolume;
    audioRefs.current.forEach(audio => {
      if (audio) {
        audio.setRefDistance(10);
        audio.setRolloffFactor(1);

        if (audio.isPlaying) {
          audio.setVolume(vol);
        }
      }
    });
  }, [sfxVolume, masterVolume, isMuted]);

  return (
    <group name="sfx-pool">
      {Array.from({ length: POOL_SIZE }).map((_, i) => (
        <positionalAudio
          key={i}
          ref={(el) => {
            audioRefs.current[i] = el;
          }}
          args={[listener]}
          loop={false}
        />
      ))}
    </group>
  );
}
