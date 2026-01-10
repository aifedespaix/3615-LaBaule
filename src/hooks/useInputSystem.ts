import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useInputStore, inputState, BindableAction } from '../stores/inputStore';

const MOVEMENT_THRESHOLD = 0.1; // Deadzone for sticks
const MOUSE_NOISE_GATE = 2; // Pixels of movement required to switch device

export function useInputSystem() {
  const { bindings, setDevice, activeDevice } = useInputStore();

  // Track raw keyboard state efficiently
  const keysPressed = useRef<Set<string>>(new Set());

  // Track mouse position
  const mousePos = useRef({ x: 0, y: 0 });
  const lastMousePos = useRef({ x: 0, y: 0 });

  // Event Listeners (Keyboard & Mouse & Touch)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysPressed.current.add(e.code);
      setDevice('KEYBOARD');
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current.delete(e.code);
    };

    const handleMouseDown = (e: MouseEvent) => {
      keysPressed.current.add(`Mouse${e.button}`); // Mouse0, Mouse1, etc.
      setDevice('KEYBOARD');
    };

    const handleMouseUp = (e: MouseEvent) => {
      keysPressed.current.delete(`Mouse${e.button}`);
    };

    const handleMouseMove = (e: MouseEvent) => {
      mousePos.current.x = e.clientX;
      mousePos.current.y = e.clientY;

      // Noise Gate for Device Switching
      const dx = Math.abs(e.clientX - lastMousePos.current.x);
      const dy = Math.abs(e.clientY - lastMousePos.current.y);

      if (dx > MOUSE_NOISE_GATE || dy > MOUSE_NOISE_GATE) {
        setDevice('KEYBOARD');
        lastMousePos.current = { x: e.clientX, y: e.clientY };
      }
    };

    // Prevent default context menu for RMB if it's bound to something
    const handleContextMenu = (e: MouseEvent) => {
       e.preventDefault();
    };

    // Global Touch Listener to activate TOUCH device
    const handleTouchStart = (e: TouchEvent) => {
       // We use passive: false to allow preventing default if needed (e.g. scroll)
       // But for global listener we mainly want to detect device switch
       setDevice('TOUCH');
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('touchstart', handleTouchStart, { passive: false });

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('touchstart', handleTouchStart);
    };
  }, [setDevice]);

  // The Loop (Runs every frame)
  useFrame(() => {
    const gamepads = navigator.getGamepads();
    const gp = gamepads[0]; // Assuming Player 1 is index 0 for now

    // --- Device Auto-Switching for Gamepad ---
    if (gp) {
      // Check if any button is pressed or stick moved significantly
      const anyButton = gp.buttons.some(b => b.pressed);
      const anyAxis = gp.axes.some(a => Math.abs(a) > 0.5);

      if (anyButton || anyAxis) {
        setDevice('GAMEPAD');
      }
    }

    // --- Process Actions based on Active Device ---

    // 1. MOVE (Vector2) - Aggregated from Directional Bindings
    if (activeDevice === 'KEYBOARD') {
      // Read separate directional bindings
      const upKey = bindings[BindableAction.MOVE_UP].keyboard;
      const downKey = bindings[BindableAction.MOVE_DOWN].keyboard;
      const leftKey = bindings[BindableAction.MOVE_LEFT].keyboard;
      const rightKey = bindings[BindableAction.MOVE_RIGHT].keyboard;

      const up = (upKey && keysPressed.current.has(upKey)) ? 1 : 0;
      const down = (downKey && keysPressed.current.has(downKey)) ? 1 : 0;
      const left = (leftKey && keysPressed.current.has(leftKey)) ? 1 : 0;
      const right = (rightKey && keysPressed.current.has(rightKey)) ? 1 : 0;

      let x = right - left;
      let y = down - up; // Screen coords: Down is +Y, Up is -Y. (Matches WASD y -= 1 logic)
      // Actually standard 3D usually has Up/Forward as negative Z or positive Y.
      // But let's stick to the previous logic: W was y -= 1. S was y += 1.
      // So y = down - up.
      // Wait, user said `y = up - down` in pseudo code example.
      // "const up = ...; inputState.move.y = y;"
      // If I use `y = up - down`, then pressing W (Up) gives y=1.
      // If I use `y = down - up`, then pressing W (Up) gives y=-1.
      // 2D Canvas coordinate system: 0,0 is top-left. Y increases downwards.
      // So moving "Up" visually means decreasing Y.
      // So `y = down - up` (1 - 0 = 1 => Down). (0 - 1 = -1 => Up).
      // I will stick to `y = down - up` to match visual screen coordinates.

      // Normalize
      const length = Math.sqrt(x * x + y * y);
      if (length > 0) {
        x /= length;
        y /= length;
      }

      inputState.move = { x, y };

    } else if (activeDevice === 'GAMEPAD' && gp) {
      let x = gp.axes[0]; // Left Stick X
      let y = gp.axes[1]; // Left Stick Y

      // Deadzone
      if (Math.abs(x) < MOVEMENT_THRESHOLD) x = 0;
      if (Math.abs(y) < MOVEMENT_THRESHOLD) y = 0;

      inputState.move = { x, y };
    }
    // Touch handled by VirtualJoystick writing directly to inputState.move

    // 2. AIM (Vector2)
    if (activeDevice === 'KEYBOARD') {
       inputState.aim = { x: mousePos.current.x, y: mousePos.current.y };
    } else if (activeDevice === 'GAMEPAD' && gp) {
       let x = gp.axes[2];
       let y = gp.axes[3];
       if (Math.abs(x) < MOVEMENT_THRESHOLD) x = 0;
       if (Math.abs(y) < MOVEMENT_THRESHOLD) y = 0;
       inputState.aim = { x, y };
    }

    // 3. Digital Actions (Buttons)
    const checkButton = (action: BindableAction, targetProp: keyof typeof inputState) => {
      // Skip Move actions
      if (action === BindableAction.MOVE_UP ||
          action === BindableAction.MOVE_DOWN ||
          action === BindableAction.MOVE_LEFT ||
          action === BindableAction.MOVE_RIGHT) return;

      const binding = bindings[action];
      if (!binding) return;

      let isPressed = false;

      if (activeDevice === 'KEYBOARD') {
        const key = binding.keyboard;
        if (key) {
           isPressed = keysPressed.current.has(key);
        }
      } else if (activeDevice === 'GAMEPAD' && gp) {
         const buttonName = binding.gamepad;
         if (buttonName) {
            // Map common names to indices
            let buttonIndex = -1;
            switch(buttonName) {
              case 'ButtonSouth': buttonIndex = 0; break;
              case 'ButtonEast': buttonIndex = 1; break;
              case 'ButtonWest': buttonIndex = 2; break;
              case 'ButtonNorth': buttonIndex = 3; break;
              case 'LeftBumper': buttonIndex = 4; break;
              case 'RightBumper': buttonIndex = 5; break;
              case 'LeftTrigger': buttonIndex = 6; break;
              case 'RightTrigger': buttonIndex = 7; break;
              case 'ButtonSelect': buttonIndex = 8; break;
              case 'ButtonStart': buttonIndex = 9; break;
              case 'LeftStick': buttonIndex = 10; break;
              case 'RightStick': buttonIndex = 11; break;
            }
            if (buttonIndex >= 0 && gp.buttons[buttonIndex]) {
               isPressed = gp.buttons[buttonIndex].pressed;
            }
         }
      }

      // We can't dynamically access type-safe properties easily without casting or map
      // But we know the mapping.
      // inputState[targetProp] = isPressed;
      // Let's do it explicitly to be safe
      (inputState as any)[targetProp] = isPressed;
    };

    checkButton(BindableAction.SHOOT, 'shoot');
    checkButton(BindableAction.THROW, 'throw');
    checkButton(BindableAction.INTERACT, 'interact');
    checkButton(BindableAction.RELOAD, 'reload');
    checkButton(BindableAction.PAUSE, 'pause');

  });
}
