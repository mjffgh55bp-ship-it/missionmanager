import { useState, useCallback } from "react";

const STORAGE_KEY = "matrix_view_presets";

function readPresets() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(p => p && typeof p.id === "string" && typeof p.name === "string" && Array.isArray(p.workerIds));
  } catch {
    return [];
  }
}

function writePresets(presets) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
  } catch {}
}

export default function useViewPresets() {
  const [presets, setPresets] = useState(() => readPresets());

  const save = useCallback((next) => {
    setPresets(next);
    writePresets(next);
  }, []);

  const addPreset = useCallback((name, workerIds) => {
    const id = (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now());
    const next = [...presets, { id, name, workerIds }];
    save(next);
  }, [presets, save]);

  const updatePreset = useCallback((id, { name, workerIds }) => {
    const next = presets.map(p => p.id === id ? { ...p, name, workerIds } : p);
    save(next);
  }, [presets, save]);

  const removePreset = useCallback((id) => {
    const next = presets.filter(p => p.id !== id);
    save(next);
  }, [presets, save]);

  return { presets, addPreset, updatePreset, removePreset };
}