export function _findNearestValidTick(tickSpacing: number, nearestToMin = false ): number {
    if (tickSpacing <= 0) {
      throw new Error("Tick spacing must be positive");
    }
  
    const MIN_TICK = -887272;
    const MAX_TICK = -MIN_TICK;
  
    if (nearestToMin) {
      // Adjust to find a tick greater than or equal to MIN_TICK.
      let adjustedMinTick = MIN_TICK + (tickSpacing - 1);
      // Prevent potential overflow.
      if (MIN_TICK < 0 && adjustedMinTick > 0) {
        adjustedMinTick = MIN_TICK;
      }
      let adjustedTick = Math.floor(adjustedMinTick / tickSpacing) * tickSpacing;
      // Ensure the adjusted tick does not fall below MIN_TICK.
      return adjustedTick > MIN_TICK ? adjustedTick - tickSpacing : adjustedTick;
    } else {
      // Find the nearest valid tick less than or equal to MAX_TICK, straightforward due to floor division.
      return Math.floor(MAX_TICK / tickSpacing) * tickSpacing;
    }
  }
  