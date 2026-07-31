export const PAN_SPEED = 0.03

export function advanceParallaxOffset(prevOffset: number, elapsedMs: number, viewportWidth: number): number {
  if (viewportWidth <= 0) return 0
  return prevOffset + elapsedMs * PAN_SPEED
}

export function layerTranslate(layerSpeed: number, baseOffset: number, viewportWidth: number): string {
  const dist = (baseOffset * layerSpeed) % viewportWidth
  return `translate3d(${(-dist).toFixed(2)}px, 0, 0)`
}
