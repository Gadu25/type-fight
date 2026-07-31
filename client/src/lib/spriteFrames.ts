export type AnimMode = 'loop' | 'once' | 'hold'

export function getFrameIndex(elapsed: number, frameCount: number, duration: number, mode: AnimMode): number {
  if (frameCount <= 0 || duration <= 0) return 0
  if (mode === 'loop') {
    const cycle = elapsed % duration
    return Math.min(Math.floor((cycle / duration) * frameCount), frameCount - 1)
  }
  const idx = Math.floor((elapsed / duration) * frameCount)
  return Math.min(idx, frameCount - 1)
}
