export const PAN_SPEED = 0.03

export function advanceParallaxOffset(prevOffset: number, elapsedMs: number, viewportWidth: number): number {
  if (viewportWidth <= 0) return 0
  return (prevOffset + elapsedMs * PAN_SPEED) % viewportWidth
}

export function layerTranslate(layerSpeed: number, baseOffset: number): string {
  return `translate3d(${(-baseOffset * layerSpeed).toFixed(2)}px, 0, 0)`
}
