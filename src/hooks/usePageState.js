import { useState, useEffect, useRef } from "react";

/**
 * usePageState - like useState, but persists to sessionStorage.
 * State is restored when navigating back to the page.
 *
 * @param {string} pageKey - unique key for this page (e.g. "matrix", "reports")
 * @param {string} stateKey - key for this specific state value
 * @param {*} defaultValue - default value if nothing saved
 */
export function usePageState(pageKey, stateKey, defaultValue) {
  const storageKey = `page_state__${pageKey}__${stateKey}`;

  const [value, setValue] = useState(() => {
    try {
      const saved = sessionStorage.getItem(storageKey);
      if (saved !== null) {
        const parsed = JSON.parse(saved);
        return parsed;
      }
    } catch {}
    return defaultValue;
  });

  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(value));
    } catch {}
  }, [value, storageKey]);

  return [value, setValue];
}