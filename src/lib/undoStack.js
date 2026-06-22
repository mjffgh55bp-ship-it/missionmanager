/**
 * Session-only undo stack for TemplateRow.values edits.
 * In-memory only — resets on page reload.
 * Max depth: 50 entries.
 */

const MAX_DEPTH = 50;
const stack = [];

/**
 * Record a change before writing to the database.
 * @param {{ rowId: string, beforeValues: object, afterValues: object }} entry
 */
export function recordChange({ rowId, beforeValues, afterValues }) {
  stack.push({ rowId, beforeValues: { ...beforeValues }, afterValues: { ...afterValues } });
  if (stack.length > MAX_DEPTH) stack.shift();
}

/**
 * Pop the last undo entry and return it, or null if stack is empty.
 * @returns {{ rowId: string, beforeValues: object, afterValues: object } | null}
 */
export function popUndo() {
  return stack.length > 0 ? stack.pop() : null;
}

/** How many entries are currently in the stack (for debugging). */
export function undoStackSize() {
  return stack.length;
}