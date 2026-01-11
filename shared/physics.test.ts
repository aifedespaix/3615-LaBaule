import { describe, it, expect } from 'bun:test';
import { applyInput, checkCircleCollision } from './physics';
import { InputMask } from './netcode/masks';
import { PLAYER_SPEED, TICK_DT } from './config/constants';
import { Status } from './netcode/schema';

describe('Shared Physics', () => {
  it('moves up correctly', () => {
    const entity = { x: 0, y: 0, status: 0 };
    applyInput(entity, InputMask.UP, TICK_DT);
    expect(entity.y).toBeCloseTo(-PLAYER_SPEED * TICK_DT);
  });

  it('moves diagonally normalized', () => {
    const entity = { x: 0, y: 0, status: 0 };
    applyInput(entity, InputMask.RIGHT | InputMask.DOWN, TICK_DT);
    const expectedDist = PLAYER_SPEED * TICK_DT;
    const actualDist = Math.sqrt(entity.x ** 2 + entity.y ** 2);
    expect(actualDist).toBeCloseTo(expectedDist);
  });

  it('does not move if stunned', () => {
    const entity = { x: 0, y: 0, status: Status.STUNNED };
    applyInput(entity, InputMask.UP, TICK_DT);
    expect(entity.x).toBe(0);
    expect(entity.y).toBe(0);
  });

  it('checkCircleCollision detects overlap', () => {
      // Circle 1 at 0,0 r=1
      // Circle 2 at 1.5,0 r=1
      // Dist = 1.5. SumR = 2. 1.5 < 2 -> Collision
      expect(checkCircleCollision(0, 0, 1, 1.5, 0, 1)).toBe(true);
  });

  it('checkCircleCollision ignores separation', () => {
      // Circle 1 at 0,0 r=1
      // Circle 2 at 3,0 r=1
      // Dist = 3. SumR = 2. 3 > 2 -> No Collision
      expect(checkCircleCollision(0, 0, 1, 3, 0, 1)).toBe(false);
  });
});
