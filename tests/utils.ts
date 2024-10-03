export function _findNearestValidTick(tickSpacing, nearestToMin) {
  const MIN_TICK = -887272;
  const MAX_TICK = 887272;

  if (nearestToMin) {
    // Adjust to the nearest valid tick above MIN_TICK
    return Math.ceil(MIN_TICK / tickSpacing) * tickSpacing;
  } else {
    // Adjust to the nearest valid tick below MAX_TICK
    return Math.floor(MAX_TICK / tickSpacing) * tickSpacing;
  }
}