export const PLAYBACK_END_RESTART_EPSILON_SECONDS = 1 / 60;

export function isAtTimelineEnd(
  playheadPosition: number,
  timelineEnd: number,
  epsilonSeconds = PLAYBACK_END_RESTART_EPSILON_SECONDS,
): boolean {
  if (
    !Number.isFinite(playheadPosition) ||
    !Number.isFinite(timelineEnd) ||
    timelineEnd <= 0
  ) {
    return false;
  }

  return (
    Math.max(0, playheadPosition) >=
    Math.max(0, timelineEnd - Math.max(0, epsilonSeconds))
  );
}
