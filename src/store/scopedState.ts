export function updateScopedState<T>(states: Record<string, T>, scope: string, initial: T, update: T | ((previous: T) => T)): Record<string, T> {
  const previous = states[scope] ?? initial;
  const next = typeof update === 'function' ? (update as (value: T) => T)(previous) : update;
  return { ...states, [scope]: next };
}
