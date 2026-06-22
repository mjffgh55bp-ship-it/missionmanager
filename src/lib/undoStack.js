/**
 * Session-only undo/redo stack for TemplateRow.values edits.
 * In-memory only — resets on page reload.
 * Max depth: 50 entries per stack.
 */

const MAX_DEPTH = 50;
const stack = [];
const redoStack = [];

/**
 * Record a change before writing to the database.
 * Clears the redo stack — new edits invalidate the redo future.
 * @param {{ rowId: string, beforeValues: object, afterValues: object }} entry
 */
export function recordChange({ rowId, beforeValues, afterValues }) {
  stack.push({ rowId, beforeValues: { ...beforeValues }, afterValues: { ...afterValues } });
  if (stack.length > MAX_DEPTH) stack.shift();
  redoStack.length = 0;
}

/**
 * Pop the last undo entry, push it onto the redo stack, and return it.
 * @returns {{ rowId: string, beforeValues: object, afterValues: object } | null}
 */
export function popUndo() {
  if (stack.length === 0) return null;
  const entry = stack.pop();
  redoStack.push(entry);
  if (redoStack.length > MAX_DEPTH) redoStack.shift();
  return entry;
}

/**
 * Pop the last redo entry, push it back onto the undo stack, and return it.
 * @returns {{ rowId: string, beforeValues: object, afterValues: object } | null}
 */
export function popRedo() {
  if (redoStack.length === 0) return null;
  const entry = redoStack.pop();
  stack.push(entry);
  if (stack.length > MAX_DEPTH) stack.shift();
  return entry;
}

/** How many entries are currently in the undo stack (for debugging). */
export function undoStackSize() {
  return stack.length;
}

/** How many entries are currently in the redo stack (for debugging). */
export function redoStackSize() {
  return redoStack.length;
}