import { useEffect, useRef, useState } from 'react';
import type { AppData } from '../domain/app-data';
import type { DataStore, Snapshot } from '../data/cloud';

/** Keep a single committed snapshot; failed or ambiguous writes block all edits until reload. */
export function useCloudData(store: DataStore, initial: Snapshot, showError: (message: string) => void, onRefreshed: () => void) {
  const [data, setData] = useState<AppData>(initial.data);
  const committed = useRef(data);
  const pending = useRef(false);
  const active = useRef(true);
  const [saving, setSaving] = useState(false);
  const [showSaving, setShowSaving] = useState(false);
  const indicatorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      if (indicatorTimer.current !== null) window.clearTimeout(indicatorTimer.current);
    };
  }, []);
  function startSaving() {
    pending.current = true;
    setSaving(true);
    indicatorTimer.current = window.setTimeout(() => {
      indicatorTimer.current = null;
      if (active.current) setShowSaving(true);
    }, 400);
  }
  function finishSaving() {
    pending.current = false;
    if (indicatorTimer.current !== null) window.clearTimeout(indicatorTimer.current);
    indicatorTimer.current = null;
    if (active.current) { setSaving(false); setShowSaving(false); }
  }
  const [blocked, setBlockedState] = useState(false);
  const blockedRef = useRef(false);
  function setBlocked(value: boolean) { blockedRef.current = value; setBlockedState(value); }
  async function commitData(next: AppData): Promise<boolean> {
    if (!active.current || blockedRef.current || pending.current) return false;
    startSaving();
    try {
      const saved = await store.save(next);
      if (!active.current) return false;
      committed.current = saved.data;
      setData(saved.data);
      return true;
    } catch (error) {
      if (active.current) { showError(error instanceof Error ? error.message : '保存できません。'); setBlocked(true); }
      return false;
    } finally { finishSaving(); }
  }
  async function refresh() {
    if (!active.current || pending.current) return;
    startSaving();
    try {
      const saved = await store.load();
      if (!saved) throw new Error('クラウドデータが見つかりません。再ログインしてください。');
      if (!active.current) return;
      committed.current = saved.data; setData(saved.data); setBlocked(false);
      onRefreshed();
    } catch (error) { if (active.current) { showError(error instanceof Error ? error.message : '再取得できません。'); setBlocked(true); } }
    finally { finishSaving(); }
  }

  return { data, committed, saving, showSaving, blocked, commitData, refresh };
}
