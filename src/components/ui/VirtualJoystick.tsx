import React, { useRef, useState, useEffect } from 'react';
import { inputState, useInputStore } from '../../stores/inputStore';

const JOYSTICK_SIZE = 120;
const HANDLE_SIZE = 50;
const MAX_RADIUS = JOYSTICK_SIZE / 2;

export const VirtualJoystick = () => {
  const { setDevice, activeDevice } = useInputStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [active, setActive] = useState(false);
  const touchId = useRef<number | null>(null);

  // Reset function
  const reset = () => {
    setPos({ x: 0, y: 0 });
    setActive(false);
    touchId.current = null;
    inputState.move = { x: 0, y: 0 };
  };

  const handleStart = (clientX: number, clientY: number) => {
    if (!containerRef.current) return;
    setDevice('TOUCH');
    setActive(true);
    handleMove(clientX, clientY);
  };

  const handleMove = (clientX: number, clientY: number) => {
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    let x = clientX - centerX;
    let y = clientY - centerY;

    // Distance
    const distance = Math.sqrt(x * x + y * y);

    // Clamp to Radius
    if (distance > MAX_RADIUS) {
      const angle = Math.atan2(y, x);
      x = Math.cos(angle) * MAX_RADIUS;
      y = Math.sin(angle) * MAX_RADIUS;
    }

    setPos({ x, y });

    // Normalize output for Game Logic (-1 to 1)
    const normX = x / MAX_RADIUS;
    const normY = y / MAX_RADIUS;

    inputState.move = { x: normX, y: normY };
  };

  // Touch Events
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      const touch = e.changedTouches[0];
      touchId.current = touch.identifier;
      handleStart(touch.clientX, touch.clientY);
    };

    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      if (touchId.current === null) return;

      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === touchId.current) {
          handleMove(e.changedTouches[i].clientX, e.changedTouches[i].clientY);
          break;
        }
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      e.preventDefault();
      if (touchId.current === null) return;

      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === touchId.current) {
          reset();
          break;
        }
      }
    };

    el.addEventListener('touchstart', onTouchStart, { passive: false });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd);
    el.addEventListener('touchcancel', onTouchEnd);

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
    };
  }, []);

  if (activeDevice !== 'TOUCH') return null;

  return (
    <div
      ref={containerRef}
      className="fixed bottom-8 left-8 rounded-full bg-slate-900/50 border-2 border-cyan-500/50 backdrop-blur-sm touch-none select-none z-50"
      style={{
        width: JOYSTICK_SIZE,
        height: JOYSTICK_SIZE,
      }}
    >
      {/* Handle */}
      <div
        className="absolute rounded-full bg-cyan-400/80 shadow-[0_0_15px_rgba(34,211,238,0.5)]"
        style={{
          width: HANDLE_SIZE,
          height: HANDLE_SIZE,
          left: `calc(50% - ${HANDLE_SIZE/2}px + ${pos.x}px)`,
          top: `calc(50% - ${HANDLE_SIZE/2}px + ${pos.y}px)`,
          transition: active ? 'none' : 'all 0.1s ease-out'
        }}
      />
    </div>
  );
};
