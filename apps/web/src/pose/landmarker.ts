// Loads MediaPipe PoseLandmarker from files hosted on our own site
// (public/mediapipe/), trying the GPU first and falling back to the CPU.
import { FilesetResolver, PoseLandmarker, type PoseLandmarkerOptions } from '@mediapipe/tasks-vision';

const BASE = `${import.meta.env.BASE_URL}mediapipe/`;

export type Delegate = 'GPU' | 'CPU';
export interface LoadedLandmarker {
  landmarker: PoseLandmarker;
  delegate: Delegate;
}

let cache: { cpuOnly: boolean; promise: Promise<LoadedLandmarker> } | null = null;

function options(delegate: Delegate): PoseLandmarkerOptions {
  return {
    baseOptions: { modelAssetPath: `${BASE}pose_landmarker_lite.task`, delegate },
    runningMode: 'VIDEO',
    numPoses: 1,
    minPoseDetectionConfidence: 0.5,
    minPosePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  };
}

async function create(cpuOnly: boolean): Promise<LoadedLandmarker> {
  const fileset = await FilesetResolver.forVisionTasks(`${BASE}wasm`);
  if (!cpuOnly) {
    try {
      return { landmarker: await PoseLandmarker.createFromOptions(fileset, options('GPU')), delegate: 'GPU' };
    } catch (err) {
      console.warn('[pose] GPU delegate failed, falling back to CPU', err);
    }
  }
  return { landmarker: await PoseLandmarker.createFromOptions(fileset, options('CPU')), delegate: 'CPU' };
}

/**
 * Returns a shared landmarker (created once). Pass cpuOnly=true to replace a GPU
 * instance that failed at runtime with a CPU one.
 */
export function loadPoseLandmarker(cpuOnly = false): Promise<LoadedLandmarker> {
  if (cache && (cache.cpuOnly || !cpuOnly)) return cache.promise;
  const old = cache;
  const promise = create(cpuOnly).catch((err) => {
    if (cache?.promise === promise) cache = null;
    throw err;
  });
  cache = { cpuOnly, promise };
  old?.promise.then((l) => l.landmarker.close()).catch(() => {});
  return promise;
}
