export function remainingSeconds(
  deadline: number | null,
  serverNow: number,
  receivedAt: number,
  now: number,
): number {
  return deadline === null
    ? 0
    : Math.max(
        0,
        Math.ceil((deadline - serverNow - (now - receivedAt)) / 1000),
      );
}
export function createChoiceLock() {
  let locked = false;
  return {
    acquire() {
      if (locked) return false;
      locked = true;
      return true;
    },
    reset() {
      locked = false;
    },
  };
}
