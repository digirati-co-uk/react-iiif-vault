export function resolveCameraInteractionMode(
  override: 'manifest' | 'orbit' | 'fly',
  freeView: boolean,
  authoredModes: readonly string[]
) {
  if (override === 'fly') return 'fly';
  if (override === 'orbit' || freeView) return 'orbit';
  return (
    authoredModes.find((value) => ['locked', 'orbit', 'hemisphere-orbit', 'free', 'free-direction'].includes(value)) ||
    'orbit'
  );
}
