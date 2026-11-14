// Starts / stops the phone camera. Video never leaves the device:
// frames go straight from the camera into the <video> element and MediaPipe.

export type Facing = 'user' | 'environment';
export type CameraErrorKind = 'denied' | 'unsupported' | 'failed';

export class CameraError extends Error {
  constructor(public kind: CameraErrorKind, cause?: unknown) {
    super(`camera ${kind}`);
    this.cause = cause;
  }
}

export async function startCamera(video: HTMLVideoElement, facing: Facing): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) throw new CameraError('unsupported');
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: facing,
        width: { ideal: 640 },
        height: { ideal: 480 },
        frameRate: { ideal: 30, max: 30 },
      },
    });
  } catch (err) {
    const name = (err as DOMException)?.name;
    throw new CameraError(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'failed', err);
  }
  video.muted = true;
  video.playsInline = true;
  video.setAttribute('playsinline', '');
  video.srcObject = stream;
  try {
    await video.play();
  } catch (err) {
    stopStream(stream);
    throw new CameraError('failed', err);
  }
  return stream;
}

export function stopStream(stream: MediaStream | null | undefined): void {
  stream?.getTracks().forEach((t) => t.stop());
}

/** Keeps the screen from dimming during a workout, where supported. */
export async function keepScreenOn(): Promise<() => void> {
  try {
    const nav = navigator as Navigator & { wakeLock?: { request(type: 'screen'): Promise<{ release(): Promise<void> }> } };
    const lock = await nav.wakeLock?.request('screen');
    return () => {
      lock?.release().catch(() => {});
    };
  } catch {
    return () => {};
  }
}
