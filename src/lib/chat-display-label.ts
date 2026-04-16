/**
 * When several chats share the same visible title, append a short id fragment
 * so pills and lists stay distinguishable.
 */
export function disambiguateLabels<T extends string>(
  ids: readonly T[],
  getBaseLabel: (id: T) => string,
): Map<T, string> {
  const groups = new Map<string, T[]>();
  for (const id of ids) {
    const base = (getBaseLabel(id).trim() || "(untitled)").toLowerCase();
    const g = groups.get(base) ?? [];
    g.push(id);
    groups.set(base, g);
  }
  const out = new Map<T, string>();
  for (const [, groupIds] of groups) {
    if (groupIds.length <= 1) {
      const id = groupIds[0];
      out.set(id, getBaseLabel(id).trim() || "(untitled)");
    } else {
      for (const id of groupIds) {
        const raw = getBaseLabel(id).trim() || "(untitled)";
        out.set(id, `${raw} · ${id.slice(0, 8)}`);
      }
    }
  }
  return out;
}
