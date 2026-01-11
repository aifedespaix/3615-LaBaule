import { describe, it, expect } from 'bun:test';
import { applyInput } from './physics';
import { InputMask } from './netcode/masks';
import { PLAYER_SPEED, TICK_DT } from './config/constants';

describe('Shared Physics', () => {
  it('moves up correctly', () => {
    const entity = { x: 0, y: 0 };
    applyInput(entity, InputMask.UP, TICK_DT);
    // Up is negative Y
    const expectedDist = PLAYER_SPEED * TICK_DT;
    expect(entity.y).toBeCloseTo(-expectedDist);
    expect(entity.x).toBe(0);
  });

  it('moves diagonally normalized', () => {
    const entity = { x: 0, y: 0 };
    applyInput(entity, InputMask.RIGHT | InputMask.DOWN, TICK_DT);

    const expectedDist = PLAYER_SPEED * TICK_DT;
    const component = expectedDist / Math.sqrt(2);

    expect(entity.x).toBeCloseTo(component);
    expect(entity.y).toBeCloseTo(component);
  });
});
