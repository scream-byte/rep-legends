// Where progress lives: two copies, merged so nothing is ever lost.
//   1. localStorage on this phone — instant, works offline (+ a backup of the previous save)
//   2. Telegram CloudStorage — survives app-data wipes, reinstalls, new phones and site moves
// On start: local + old-style records + cloud are merged (see merge() in progress.ts).
// After every set: saved locally first, then pushed to the cloud.

import { useEffect, useState } from 'react';
import { keys, load, save } from '../storage';
import { cloudAvailable, cloudGet, cloudSet } from '../telegram/tg';
import {
  applySet,
  DEVICE_ID,
  differs,
  emptyProgress,
  fromLegacyRecords,
  merge,
  newDeviceId,
  sanitize,
  type Progress,
  type SetInput,
  type SetOutcome,
} from './progress';

export type { SetOutcome } from './progress';

const CLOUD_KEY = 'progress';

/** 'local' = saved only on this phone (outside Telegram / old Telegram / offline). */
export type SyncState = 'local' | 'syncing' | 'cloud' | 'error';

let current: Progress = emptyProgress();
let deviceId = '';
let syncState: SyncState = 'local';
let initialized = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((fn) => fn());

function readLocal(key: string): Progress | null {
  const raw = load(key);
  if (!raw) return null;
  try {
    return sanitize(JSON.parse(raw));
  } catch {
    return null; // corrupted: ignored, the backup / cloud copy will be used
  }
}

function writeLocal(p: Progress) {
  const prev = load(keys.progress);
  if (prev) save(keys.progressBackup, prev); // keep the previous good save
  save(keys.progress, JSON.stringify(p));
}

function setCurrent(p: Progress) {
  current = p;
  notify();
}

function setSync(s: SyncState) {
  syncState = s;
  notify();
}

/** Pulls the cloud copy, merges it in, and pushes the merged result back if needed. */
export async function syncWithCloud(): Promise<void> {
  if (!cloudAvailable()) return setSync('local');
  setSync('syncing');
  try {
    const raw = await cloudGet(CLOUD_KEY);
    let cloud = emptyProgress();
    if (raw) {
      try {
        cloud = sanitize(JSON.parse(raw));
      } catch {
        /* corrupted cloud copy: treated as empty, then overwritten by the merged one */
      }
    }
    const merged = merge(current, cloud);
    if (differs(merged, current)) {
      writeLocal(merged);
      setCurrent(merged);
    }
    if (!raw || differs(merged, cloud)) {
      const ok = await cloudSet(CLOUD_KEY, JSON.stringify(merged));
      return setSync(ok ? 'cloud' : 'error');
    }
    setSync('cloud');
  } catch (err) {
    console.warn('[progress] cloud sync failed', err);
    setSync('error');
  }
}

/** Call once at startup. Safe to call more than once. */
export function initProgress(): void {
  if (initialized) return;
  initialized = true;

  const savedId = load(keys.deviceId);
  deviceId = savedId && DEVICE_ID.test(savedId) ? savedId : newDeviceId();
  if (deviceId !== savedId) save(keys.deviceId, deviceId);

  // local copy (or its backup if the main one is damaged) + records from older versions
  const local = readLocal(keys.progress) ?? readLocal(keys.progressBackup) ?? emptyProgress();
  const merged = merge(local, fromLegacyRecords(load));
  if (differs(merged, local) || !load(keys.progress)) writeLocal(merged);
  current = merged;

  void syncWithCloud();
  // Coming back to the app: pick up progress made on another device / retry a failed upload.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) void syncWithCloud();
  });
}

export function getProgress(): Progress {
  return current;
}

/**
 * Adds a finished set and saves it.
 * Returns the outcome IMMEDIATELY (already saved on the phone) plus a promise that
 * tells where it finally landed: 'cloud' (phone + Telegram cloud) or 'local' (phone only).
 */
export function recordSet(input: SetInput): { outcome: SetOutcome; saved: Promise<'cloud' | 'local'> } {
  const outcome = applySet(current, input, deviceId);
  writeLocal(outcome.progress); // 1) instantly on the phone
  setCurrent(outcome.progress);
  if (!cloudAvailable()) {
    setSync('local');
    return { outcome, saved: Promise.resolve('local') };
  }
  // 2) the cloud: merge with whatever is there (another device may have played meanwhile)
  const saved = syncWithCloud().then(() => (syncState === 'cloud' ? 'cloud' : 'local') as 'cloud' | 'local');
  return { outcome, saved };
}

/** React hook: the current progress and cloud-sync state, re-rendering on changes. */
export function useProgress(): { progress: Progress; sync: SyncState } {
  const [, force] = useState(0);
  useEffect(() => {
    const fn = () => force((n) => n + 1);
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, []);
  return { progress: current, sync: syncState };
}
