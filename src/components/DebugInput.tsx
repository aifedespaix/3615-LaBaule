import { useFrame } from '@react-three/fiber';
import { useRef, useState } from 'react';
import { useInputSystem } from '../hooks/useInputSystem';
import { inputState } from '../stores/inputStore';
import { Text } from '@react-three/drei';

export const DebugInput = () => {
  // 1. Run the system
  useInputSystem();

  // 2. Visualize State
  const [debugText, setDebugText] = useState("");

  useFrame((state) => {
    // Update every frame for smooth debug text
    // Create a clean object for display (removing internal keys if any, though inputState is clean)
    const display = {
       move: inputState.move,
       aim: inputState.aim,
       shoot: inputState.shoot,
       throw: inputState.throw,
       interact: inputState.interact,
       reload: inputState.reload,
       pause: inputState.pause,
    };

    const str = JSON.stringify(display, (key, val) => {
      if (typeof val === 'number') return Number(val.toFixed(2));
      return val;
    }, 2);
    setDebugText(`DEVICE: ${inputState.activeDevice}\n${str}`);
  });

  return (
    <group position={[-2, 1, 0]}>
       <Text
        color="lime"
        fontSize={0.2}
        maxWidth={2}
        lineHeight={1.2}
        font="/fonts/VT323-Regular.ttf"
        anchorX="left"
        anchorY="top"
      >
        {debugText}
      </Text>
    </group>
  );
};
