// BEGIN-REPO-WRITETOOL-PROBE (investigation artifact — safe to delete)
export const repoProbe = {
  tag: "REPO-WRITETOOL-PROBE-INTEGRITY",
  rows: [
    "r01", "r02", "r03", "r04", "r05", "r06", "r07", "r08", "r09", "r10",
    "r11", "r12", "r13", "r14", "r15", "r16", "r17", "r18", "r19", "r20",
    "r21", "r22", "r23", "r24", "r25", "r26", "r27", "r28", "r29", "r30",
    "r31", "r32", "r33", "r34", "r35", "r36", "r37", "r38", "r39", "r40",
  ],
  nested: {
    a: { b: { c: "deep-value-with-braces-}}}" } },
    list: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  },
  end: "OK",
};
function repoChecksum(): number {
  return repoProbe.rows.length + repoProbe.nested.list.length;
}
export function repoProbeMain(): string {
  if (repoProbe.rows.length !== 40) {
    throw new Error("REPO PROBE TRUNCATED: expected 40 rows");
  }
  return repoProbe.tag + ":" + repoChecksum();
}
// END-REPO-WRITETOOL-PROBE-LASTLINE-SENTINEL
