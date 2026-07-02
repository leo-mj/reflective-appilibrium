/** Groups relations: entails/precludes/jointly_* with the same argumentId become one entry. */
export function groupRelationsByArgument(rels) {
  const groups = [];
  const seenArgIds = new Set();
  for (const r of rels) {
    if (
      (r.type === "entails" || r.type === "precludes" ||
       r.type === "jointly_entails" || r.type === "jointly_precludes") &&
      r.argumentId
    ) {
      if (seenArgIds.has(r.argumentId)) continue;
      seenArgIds.add(r.argumentId);
      groups.push({
        argId: r.argumentId,
        rels: rels.filter((x) => x.argumentId === r.argumentId),
      });
    } else {
      groups.push({ argId: null, rels: [r] });
    }
  }
  return groups;
}
