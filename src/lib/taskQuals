// Resolve a task's qualification map tolerant of id-keyed (new) or name-keyed (legacy) storage.
export function getTaskQuals(taskQualifications, task) {
  if (!taskQualifications || !task) return {};
  // task may be an object {name, mapping_id} or a bare string (legacy)
  const id = typeof task === "object" ? task.mapping_id : null;
  const name = typeof task === "object" ? task.name : task;
  if (id && taskQualifications[id]) return taskQualifications[id];
  if (name && taskQualifications[name]) return taskQualifications[name];
  return {};
}