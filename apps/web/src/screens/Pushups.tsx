import { PoseLandmarker, type NormalizedLandmark } from '@mediapipe/tasks-vision';
import { useCallback, useEffect, useRef, useState } from 'react';
import { sfx } from '../audio/sfx';
import {
  calibrationHint,
  measurePushup,
  PushupCounter,
  type CalibrationHint,
  type PushupFrame,
  type RepHint,
} from '../exercises/pushup';
import type { Dict } from '../i18n';
import { CameraError, keepScreenOn, startCamera, stopStream, type Facing } from '../pose/camera';
import { loadPoseLandmarker, type LoadedLandmarker } from '../pose/landmarker';
import { keys, load, save } from '../storage';
import { haptic, hapticNotify, showBackButton } from '../telegram/tg';
import './workout.css';

type Phase = 'setup' | 'loading' | 'calibrating' | 'countdown' | 'active' | 'result' | 'error';

interface Props {
  t: Dict;
  onExit: () => void;
}

interface Result {
  reps: number;
  ms: number;
  best: number;
  newBest: boolean;
}

interface DebugStats {
  fps: number;
  delegate: string;
  side: string;
  elbow: number | null;
  body: number | null;
}

const HOLD_MS = 1000; // how long the player must hold the start pose
const COUNTDOWN_FROM = 3;

function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function Pushups({ t, onExit }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Mutable per-frame state lives in refs so the 30 fps loop doesn't re-render React.
  const streamRef = useRef<MediaStream | null>(null);
  const lmRef = useRef<LoadedLandmarker | null>(null);
  const rafRef = useRef(0);
  const timersRef = useRef<number[]>([]);
  const releaseWakeRef = useRef<() => void>(() => {});
  const phaseRef = useRef<Phase>('setup');
  const counterRef = useRef(new PushupCounter());
  const holdSinceRef = useRef<number | null>(null);
  const calibRef = useRef<CalibrationHint | null>(null);
  const lostRef = useRef(false);
  const startedAtRef = useRef(0);
  const debugRef = useRef(false);
  const switchingDelegateRef = useRef(false);

  const [phase, setPhaseState] = useState<Phase>('setup');
  const [facing, setFacing] = useState<Facing>('user');
  const [loadingText, setLoadingText] = useState('');
  const [errorText, setErrorText] = useState('');
  const [calib, setCalib] = useState<CalibrationHint>('notVisible');
  const [countdown, setCountdown] = useState(COUNTDOWN_FROM);
  const [reps, setReps] = useState(0);
  const [hint, setHint] = useState<{ key: RepHint; id: number } | null>(null);
  const [lost, setLost] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const [debug, setDebug] = useState(false);
  const [stats, setStats] = useState<DebugStats>({ fps: 0, delegate: '—', side: '—', elbow: null, body: null });

  const setPhase = (p: Phase) => {
    phaseRef.current = p;
    setPhaseState(p);
  };

  const clearTimers = () => {
    timersRef.current.forEach((id) => clearInterval(id));
    timersRef.current = [];
  };

  /** Stops the camera, the detection loop and all timers. */
  const stopAll = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    clearTimers();
    stopStream(streamRef.current);
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    releaseWakeRef.current();
    releaseWakeRef.current = () => {};
  }, []);

  const exit = useCallback(() => {
    stopAll();
    onExit();
  }, [stopAll, onExit]);

  // Telegram's native back arrow + cleanup when leaving the screen.
  useEffect(() => showBackButton(exit), [exit]);
  useEffect(() => stopAll, [stopAll]);

  // Start downloading the model while the player reads the instructions.
  useEffect(() => {
    loadPoseLandmarker().catch(() => {});
  }, []);

  useEffect(() => {
    debugRef.current = debug;
  }, [debug]);

  // Hints disappear on their own after a moment.
  useEffect(() => {
    if (!hint) return;
    const id = setTimeout(() => setHint(null), 1200);
    return () => clearTimeout(id);
  }, [hint]);

  // ---------- per-frame handling ----------

  function startCountdown() {
    setPhase('countdown');
    let n = COUNTDOWN_FROM;
    setCountdown(n);
    haptic('light');
    sfx.countdown();
    const id = window.setInterval(() => {
      n -= 1;
      if (n > 0) {
        setCountdown(n);
        haptic('light');
        sfx.countdown();
        return;
      }
      sfx.go();
      clearInterval(id);
      counterRef.current = new PushupCounter();
      setReps(0);
      startedAtRef.current = performance.now();
      setElapsed(0);
      setPhase('active');
      hapticNotify('success');
      timersRef.current.push(window.setInterval(() => setElapsed(performance.now() - startedAtRef.current), 250));
    }, 1000);
    timersRef.current.push(id);
  }

  function handleFrame(f: PushupFrame, now: number) {
    const p = phaseRef.current;
    if (p === 'calibrating') {
      const h = calibrationHint(f);
      if (h !== calibRef.current) {
        calibRef.current = h;
        setCalib(h);
      }
      if (h === 'hold') {
        holdSinceRef.current ??= now;
        if (now - holdSinceRef.current >= HOLD_MS) {
          holdSinceRef.current = null;
          startCountdown();
        }
      } else {
        holdSinceRef.current = null;
      }
      return;
    }
    if (p !== 'active') return;

    const u = counterRef.current.update(f, now);
    const isLost = u.hint === 'lost';
    if (isLost !== lostRef.current) {
      lostRef.current = isLost;
      setLost(isLost);
    }
    if (u.counted) {
      setReps(counterRef.current.reps);
      haptic('medium');
      sfx.rep();
    } else if (u.hint && !isLost) {
      setHint({ key: u.hint, id: now });
      hapticNotify('warning');
      sfx.warn();
    }
  }

  function drawDebug(lms: NormalizedLandmark[] | undefined, f: PushupFrame) {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;
    if (canvas.width !== video.videoWidth) canvas.width = video.videoWidth;
    if (canvas.height !== video.videoHeight) canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!lms) return;
    const W = canvas.width;
    const H = canvas.height;
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    for (const c of PoseLandmarker.POSE_CONNECTIONS) {
      const a = lms[c.start];
      const b = lms[c.end];
      ctx.beginPath();
      ctx.moveTo(a.x * W, a.y * H);
      ctx.lineTo(b.x * W, b.y * H);
      ctx.stroke();
    }
    if (f.points) {
      const [sh, el, wr, hip, ank] = f.points;
      ctx.lineWidth = 6;
      ctx.strokeStyle = f.visible ? '#ffd400' : '#ff3d5a';
      ctx.beginPath();
      ctx.moveTo(sh.x, sh.y);
      ctx.lineTo(el.x, el.y);
      ctx.lineTo(wr.x, wr.y);
      ctx.moveTo(sh.x, sh.y);
      ctx.lineTo(hip.x, hip.y);
      ctx.lineTo(ank.x, ank.y);
      ctx.stroke();
      ctx.fillStyle = '#ff8a1f';
      for (const pt of f.points) {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 7, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function runLoop() {
    let lastVideoTime = -1;
    let lastTs = 0;
    let frames = 0;
    let fpsWindowStart = performance.now();
    let lastFrame: PushupFrame | null = null;

    const tick = () => {
      rafRef.current = requestAnimationFrame(tick);
      const video = videoRef.current;
      const L = lmRef.current;
      if (!video || !L || video.readyState < 2 || video.currentTime === lastVideoTime) return;
      lastVideoTime = video.currentTime;

      let now = performance.now();
      if (now <= lastTs) now = lastTs + 1; // MediaPipe needs strictly increasing timestamps
      lastTs = now;

      let lms: NormalizedLandmark[] | undefined;
      try {
        lms = L.landmarker.detectForVideo(video, now).landmarks[0];
      } catch (err) {
        // Some phones accept the GPU at startup but fail later: switch to the CPU once.
        if (L.delegate === 'GPU' && !switchingDelegateRef.current) {
          switchingDelegateRef.current = true;
          console.warn('[pose] GPU detection failed, switching to CPU', err);
          lmRef.current = null;
          loadPoseLandmarker(true)
            .then((l) => (lmRef.current = l))
            .catch(() => fail(t.workout.modelError))
            .finally(() => (switchingDelegateRef.current = false));
        }
        return;
      }

      const f = measurePushup(lms, video.videoWidth, video.videoHeight);
      lastFrame = f;
      handleFrame(f, now);
      if (debugRef.current) drawDebug(lms, f);

      frames += 1;
      if (now - fpsWindowStart >= 1000) {
        const fps = Math.round((frames * 1000) / (now - fpsWindowStart));
        frames = 0;
        fpsWindowStart = now;
        if (debugRef.current) {
          setStats({
            fps,
            delegate: lmRef.current?.delegate ?? '—',
            side: lastFrame?.side ?? '—',
            elbow: lastFrame?.elbow != null ? Math.round(lastFrame.elbow) : null,
            body: lastFrame?.bodyLine != null ? Math.round(lastFrame.bodyLine) : null,
          });
        }
      }
    };
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);
  }

  // ---------- actions ----------

  function fail(message: string) {
    stopAll();
    setErrorText(message);
    setPhase('error');
  }

  async function begin(cameraFacing: Facing = facing) {
    const video = videoRef.current;
    if (!video) return;
    stopAll();
    setPhase('loading');
    setLoadingText(t.workout.loadingModel);

    const [model, camera] = await Promise.allSettled([
      loadPoseLandmarker(),
      startCamera(video, cameraFacing),
    ]);

    if (camera.status === 'rejected') {
      if (model.status === 'fulfilled') lmRef.current = model.value;
      const kind = camera.reason instanceof CameraError ? camera.reason.kind : 'failed';
      fail(kind === 'denied' ? t.workout.cameraDenied : t.workout.cameraError);
      return;
    }
    streamRef.current = camera.value;
    if (model.status === 'rejected') {
      fail(t.workout.modelError);
      return;
    }
    lmRef.current = model.value;
    releaseWakeRef.current = await keepScreenOn();

    holdSinceRef.current = null;
    calibRef.current = null;
    lostRef.current = false;
    setLost(false);
    setCalib('notVisible');
    setPhase('calibrating');
    runLoop();
  }

  function switchCamera() {
    const next: Facing = facing === 'user' ? 'environment' : 'user';
    setFacing(next);
    void begin(next);
  }

  function finish() {
    const ms = performance.now() - startedAtRef.current;
    const count = counterRef.current.reps;
    const prev = Number(load(keys.bestPushups) ?? 0) || 0;
    const newBest = count > prev;
    if (newBest) save(keys.bestPushups, String(count));
    stopAll();
    setResult({ reps: count, ms, best: Math.max(prev, count), newBest });
    setPhase('result');
    hapticNotify('success');
    sfx.finish();
  }

  // ---------- render ----------

  const hintText = (h: RepHint) => (h === 'plank' ? t.workout.calibrate.notPlank : h === 'lost' ? t.workout.hints.lost : t.workout.hints[h]);
  const cameraOn = phase === 'calibrating' || phase === 'countdown' || phase === 'active';
  const mirror = facing === 'user' ? 'mirror' : '';

  return (
    <div className="workout">
      <div className={`cam ${cameraOn ? '' : 'cam-off'}`}>
        <video ref={videoRef} className={mirror} playsInline muted autoPlay />
        <canvas ref={canvasRef} className={`overlay ${mirror}`} hidden={!debug} />
      </div>

      {phase === 'setup' && (
        <div className="w-panel-wrap">
          <div className="panel">
            <h2 className="outlined">{t.workout.setupTitle}</h2>
            <PhoneSetupArt />
            <ol className="panel-list">
              {t.workout.setup.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
            <button className="btn3d primary" onClick={() => begin()}>
              {t.workout.startCamera}
            </button>
          </div>
        </div>
      )}

      {phase === 'loading' && (
        <div className="w-center">
          <div className="spinner" />
          <p className="outlined">{loadingText}</p>
        </div>
      )}

      {phase === 'error' && (
        <div className="w-panel-wrap">
          <div className="panel">
            <h2 className="outlined">😕</h2>
            <p className="panel-text">{errorText}</p>
            <button className="btn3d primary" onClick={() => begin()}>
              {t.workout.tryAgain}
            </button>
            <button className="btn3d secondary" onClick={exit}>
              {t.workout.home}
            </button>
          </div>
        </div>
      )}

      {phase === 'calibrating' && (
        <>
          <div className={`banner ${calib === 'hold' ? 'ok' : ''}`}>{t.workout.calibrate[calib]}</div>
          <div className="w-bottom">
            <button className="btn3d small" onClick={switchCamera}>
              🔄 {t.workout.switchCamera}
            </button>
            <button className={`btn3d small ${debug ? 'on' : ''}`} onClick={() => setDebug((d) => !d)}>
              🐞 {t.workout.debug}
            </button>
          </div>
        </>
      )}

      {phase === 'countdown' && (
        <div className="w-center">
          <div key={countdown} className="big-number outlined">
            {countdown}
          </div>
        </div>
      )}

      {phase === 'active' && (
        <>
          <div className="w-top">
            <div className="rep-counter">
              <b key={reps} className="outlined">
                {reps}
              </b>
              <span className="outlined">{t.workout.reps}</span>
            </div>
            <div className="timer outlined">{formatTime(elapsed)}</div>
          </div>
          {lost && <div className="banner warn-banner">{t.workout.hints.lost}</div>}
          {hint && !lost && (
            <div key={hint.id} className="hint-pop outlined">
              {hintText(hint.key)}
            </div>
          )}
          <div className="w-bottom">
            <button className={`btn3d small ${debug ? 'on' : ''}`} onClick={() => setDebug((d) => !d)}>
              🐞
            </button>
            <button className="btn3d stop" onClick={finish}>
              {t.workout.stop}
            </button>
          </div>
        </>
      )}

      {phase === 'result' && result && (
        <div className="w-panel-wrap">
          <div className="panel">
            <h2 className="outlined">{t.workout.resultTitle}</h2>
            <div className="result-reps outlined">{result.reps}</div>
            <p className="result-label">{t.workout.reps}</p>
            {result.newBest && result.reps > 0 && <p className="new-best outlined">🏆 {t.workout.newBest}</p>}
            <div className="result-row">
              <span>
                {t.workout.time}: <b>{formatTime(result.ms)}</b>
              </span>
              <span>
                {t.workout.best}: <b>{result.best}</b>
              </span>
            </div>
            <button className="btn3d primary" onClick={() => begin()}>
              {t.workout.again}
            </button>
            <button className="btn3d secondary" onClick={exit}>
              {t.workout.home}
            </button>
          </div>
        </div>
      )}

      {debug && cameraOn && (
        <div className="debug-info">
          FPS {stats.fps} · {stats.delegate} · {stats.side}
          <br />
          elbow {stats.elbow ?? '—'}° · body {stats.body ?? '—'}°
        </div>
      )}
    </div>
  );
}

/** Simple picture: phone standing on the floor, player in a plank side-on. */
function PhoneSetupArt() {
  const ink = '#1b1d4a';
  return (
    <svg className="setup-art" viewBox="0 0 300 120" aria-hidden>
      <path d="M10 104 H290" stroke={ink} strokeWidth="4" strokeLinecap="round" />
      {/* phone */}
      <rect x="22" y="52" width="28" height="50" rx="5" fill="#fff" stroke={ink} strokeWidth="4" />
      <circle cx="36" cy="60" r="3" fill={ink} />
      {/* field of view */}
      <path d="M50 66 L285 30 M50 66 L285 104" stroke="#5cc8ff" strokeWidth="3" strokeDasharray="6 6" />
      {/* distance */}
      <path d="M56 109 H150 M56 106 v6 M150 106 v6" stroke={ink} strokeWidth="2" />
      <text x="103" y="119" textAnchor="middle" fontSize="10" fontWeight="800" fill={ink}>
        2–2.5 m
      </text>
      {/* player in plank */}
      <g stroke={ink} strokeWidth="7" strokeLinecap="round" fill="none">
        <path d="M170 70 L272 96" stroke="#ff8a1f" />
        <path d="M178 72 L178 101" />
        <path d="M272 96 L284 101" />
      </g>
      <circle cx="160" cy="66" r="10" fill="#ff8a1f" stroke={ink} strokeWidth="4" />
    </svg>
  );
}
