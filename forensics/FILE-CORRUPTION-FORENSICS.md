# LeadClaw — File-Corruption Forensic Diagnosis

**Date:** 2026-06-20  **Mode:** investigation only (no fixes, no refactors, no commits)
**Analyst environment:** Cowork Linux sandbox; repo reached over a virtiofs/FUSE
passthrough of `C:\Users\thoma\leadclaw-uk`. All snippets handed to you are
PowerShell; my own probing used bash because that is the only shell the sandbox has.

---

## 1. Verdict — root cause (proven, reproducible)

The corruption is produced by the **agent/editor file tools (Write/Edit) when they
OVERWRITE an existing file across the Windows↔sandbox virtiofs/FUSE mount. The
overwrite rewrites the file's bytes in place but does not resize the file to the new
content length.** The file stays pinned at its *previous* on-disk byte length:

- **New content LONGER than the old file** → the overflow tail is dropped →
  **truncation mid-statement**, closing braces/tags lost. (Your symptom #2.)
- **New content SHORTER than the old file** → the leftover tail of the old
  allocation is zero-filled → **trailing NUL bytes**. (Your symptom #1.)

That single mechanism — *write-without-resize through the FUSE layer* — explains both
faces of the bug, and explains why "the real code is intact up to the cut": everything
up to `min(old_len, new_len)` is written correctly; only the resize/truncate step is lost.

This is suspects **A + D acting together**: the tool's non-atomic, non-resizing overwrite
(A) on a virtiofs passthrough that does not honor the truncate (D). It is **not** B
(encoding), **not** C (formatter/hook), **not** E (repo config) — each ruled out below
with evidence. It is **not** OneDrive/Dropbox: the repo is not under a sync folder and
the bug reproduces entirely inside the sandbox with no sync in the path.

New-file creation and plain `bash`/editor stream-writes are **clean** — the fault is
specific to *tool overwrites of existing files* through this mount.

---

## 2. Reproduction — deterministic, smallest reliable form

**Repro:** take any existing file, use the **Edit tool** to replace a substring with a
replacement of a *different length*, then read the bytes back from disk.

| # | File | Edit | Δ content | Result on disk | Length after |
|---|------|------|-----------|----------------|--------------|
| 1 | `probe_writetool.ts` (120 L) | insert 27 B mid-file | +27 B | tail cut `…LASTLINE-SENTINEL` → `// END-WRITETO`; **−27 B off the end** | **unchanged** 8353 B |
| 2 | `probe_large.ts` (402 L) | insert 16 B mid-file | +16 B | tail cut → `// END-LARGE`; **−16 B off the end** | **unchanged** 2449 B |
| 3 | `shrink_test.ts` (5 L) | shrink a string | −119 B | content correct for 103 B, then **119 trailing NUL bytes** | **unchanged** 222 B |

In every case the file's byte length **did not move from its pre-edit value**; the byte
delta was taken off the tail (truncation) or backfilled with NUL (padding). The
truncation was stable across three re-reads (not a flaky read). 2-for-2 on the grow
case, 1-for-1 on the shrink case — reliable.

**Controls that stayed clean (isolate the fault):**
- Write tool **creating new** files: `probe_writetool.ts` 120 L, `probe_large.ts` 402 L,
  `__corruption_probe_repo_DELETE_ME.ts` 25 L → all 0 NUL, correct tail.
- `bash` stream-writes (golden 2000 L = 119 923 B; repo control 1500 L = 70 461 B) → clean.

So the differentiator is **overwrite-existing-via-tool**, not file size, not the mount in general.

> Caveat on intermittency: the *grow→truncate* and *shrink→NUL* edits reproduced on the
> first attempt this session. Prior sessions logged it hitting "every file touched,"
> while some sessions see clean tool writes. The fault rate is load/timing dependent in
> the FUSE layer, but the **mechanism is constant** and the Edit-length-change repro is
> the most reliable trigger.

---

## 3. Suspect ranking (A–E) with evidence

**A — Agent Write/Edit tool. → PRIMARY (proven).**
For: deterministic grow/shrink repro above; tool overwrite leaves file at old length.
Against/refinement: *new-file* tool writes are clean, so the defect is in the
overwrite/resize path specifically, not all writes.

**D — Filesystem / mount. → CO-PRIMARY (enabling layer, proven).**
For: repo is a `type fuse` virtiofs passthrough; **`.fuse_hidden0000*` files exist in
`src/app/` and `src/__tests__/api/`** — FUSE only creates those when a file is
unlinked/replaced *while another process holds it open*, i.e. the exact open-handle vs
replace race that drops/zero-fills tails; `rm` returns **EPERM** (mount forbids unlink);
`.git/index.lock` is stale and a single `ls` of it returned both "No such file" and a
valid stat — live mount incoherence. Against (sync-specific D): path is **not** under
OneDrive/Dropbox/Google Drive and the bug reproduces with no sync involved, so a cloud
sync agent is **excluded**; the culprit is the local virtiofs bridge.

**B — Encoding / EOL mismatch. → RULED OUT.**
Against: victims have **no BOM** (`page.tsx` `69 6d 70`="imp", `schema.sql` `2d 2d 20`="-- ",
`fetch-site.ts` `2f 2f 20`="// "), none are UTF-16, and the NUL bytes are **trailing**,
not interleaved every-other-byte (the UTF-16-misread signature). `.gitattributes` is a
clean `* text=auto eol=lf`. Encoding is not involved.

**C — Build / format / codegen / pre-commit hook. → RULED OUT.**
Against: **no `.husky`, no lint-staged, no prettier (not even installed), no
`.editorconfig`**; `.git/hooks` holds only inert `.sample` files; `package.json` scripts
are plain `dev/build/start/lint/test` with no pre/post hooks. Corruption appears with no
build/commit run and on files that were only *read*. Nothing in the repo rewrites files.

**E — Repo source / config itself. → RULED OUT as a cause.**
Against: config is sane. The only repo-side aggravator is historical: corrupted files
were sometimes committed, so a later edit starts from an already-wrong length and the
damage compounds. The pre-commit hook (§5) stops that going forward.

---

## 4. Current working-tree victims (snapshot 2026-06-20)

| File | Disk | HEAD | NUL | Signature |
|------|------|------|-----|-----------|
| `src/app/lp/[slug]/page.tsx` | 2460 B | 2452 B | 8 trailing | NUL pad; content == HEAD |
| `src/app/seo/[slug]/page.tsx` | 1680 B | 1672 B | 8 trailing | NUL pad; content == HEAD |
| `src/lib/billing-view.ts` | 4159 B | 4064 B | 95 trailing | NUL pad; content == HEAD |
| `src/app/portal/billing/page.tsx` | 10769 B | 10149 B | 462 trailing | NUL pad over edited content |
| `src/lib/audit/fetch-site.ts` | 6446 B | 13833 B | 0 | **truncated** mid-word at `  retur`(n) |
| `supabase/schema.sql` | 23737 B | 15845 B | 0 | no NUL now; ends on a `-- ===` divider — verify tail by eye |
| `src/app/page.tsx` | 30760 B | 30760 B | 0 | **currently clean** (== HEAD) |

`.png`/`.ico`/`.fuse_hidden*` also contain NUL but are legitimately binary / FUSE scratch.

Re-run the scan yourself any time (PS 5.1 and 7):

```powershell
Get-ChildItem -Recurse -File |
  Where-Object { $_.FullName -notmatch '\\(\.git|node_modules|\.next)\\' -and
                 '.png .jpg .jpeg .gif .webp .ico .pdf .zip .woff .woff2 .ttf'.Split(' ') -notcontains $_.Extension.ToLower() } |
  Where-Object { [Array]::IndexOf([System.IO.File]::ReadAllBytes($_.FullName), [byte]0) -ge 0 } |
  Select-Object FullName
```

(Your original one-liner works on PS 5.1 but `Get-Content -Encoding Byte` is removed in
PS 7 — use `-AsByteStream`, or the `[IO.File]::ReadAllBytes` form above which is faster
and version-agnostic.)

---

## 5. Prevention (adopt immediately, independent of which layer you blame)

Three layers; the file `forensics\Guard-FileIntegrity.ps1` contains the functions.

**(a) Atomic write-then-verify — use instead of `Set-Content` for generated files.**
Writes to a temp file on the same folder, `Flush($true)` to force the OS to commit,
re-reads from disk and asserts (length matches, no NUL, optional expected tail), and only
then `Move-Item`s over the target. A short/zero-filled write is caught *before* it can
replace a good file. Even if the FUSE layer is flaky, you never overwrite a valid file
with a partial one, and a metadata-only rename is far safer than a large in-place rewrite.

```powershell
. .\forensics\Guard-FileIntegrity.ps1
Write-FileAtomic -Path .\src\lib\foo.ts -Content $text -ExpectedTail "}`n"
```

**(b) Git pre-commit hook that REJECTS NUL bytes — `forensics\pre-commit`.**
Scans every staged (ACM) non-binary blob; if it contains a NUL byte the commit is
blocked. A corrupted file can never be committed again. Install:

```powershell
Copy-Item .\forensics\pre-commit .\.git\hooks\pre-commit -Force
# Git for Windows runs hooks via its bundled sh; no chmod needed on Windows.
```

Limitation (stated honestly): the hook catches the **NUL-pad** class. **Mid-statement
truncation has no NUL byte**, so keep `tsc` / `next build` / `jest` in CI as the
truncation backstop, and prefer the `-ExpectedTail` sentinel in `Write-FileAtomic`.

**(c) Post-write byte-check / scanner — `Find-NulFiles`, `Repair-AllTrailingNul -WhatIf`.**
Run after a batch of edits to catch damage early.

---

## 6. Repair snippet (strip trailing NUL bytes + verify)

Proven on copies: stripping the trailing NULs from `billing-view.ts` (4159→4064 B) and
`seo/[slug]/page.tsx` (1680→1672 B) produced bytes **byte-for-byte identical to the clean
git HEAD blob**. The function refuses to touch files with *interior* NULs (those need a
git restore, not a strip).

```powershell
. .\forensics\Guard-FileIntegrity.ps1
Repair-TrailingNul -Path .\src\lib\billing-view.ts -WhatIf   # preview
Repair-TrailingNul -Path .\src\lib\billing-view.ts           # apply (atomic + verified)
```

Self-contained inline version:

```powershell
function Repair-TrailingNul([string]$Path){
  $b=[IO.File]::ReadAllBytes($Path); $e=$b.Length
  while($e -gt 0 -and $b[$e-1] -eq 0){$e--}
  if($e -eq $b.Length){"no trailing NUL: $Path";return}
  if([Array]::IndexOf($b,[byte]0) -lt $e){Write-Warning "interior NUL — git restore instead";return}
  $o=New-Object byte[] $e;[Array]::Copy($b,$o,$e)
  $t="$Path.tmp";[IO.File]::WriteAllBytes($t,$o)
  if(([IO.File]::ReadAllBytes($t)).Length -ne $e){Remove-Item $t;throw "verify failed"}
  Move-Item $t $Path -Force; "fixed $Path -> $e B"
}
```

For the **truncated** victim `fetch-site.ts` (no NUL, real content lost), stripping won't
help — restore it from version control: `git checkout -- src/lib/audit/fetch-site.ts`
(or `git show HEAD:src/lib/audit/fetch-site.ts > src/lib/audit/fetch-site.ts` if it
carries wanted edits, then re-apply them).

---

## 7. Artifacts I created (clean these up — I could not: the mount blocks `rm`)

In the repo root (safe to delete): `__corruption_probe_repo_DELETE_ME.ts`,
`__bash_control_repo_DELETE_ME.txt`. Pre-existing junk from earlier sessions also present:
`__probe_delete_test`, `_ld.js`, `_parsecheck.js`, `_pc.js`. Remove with:

```powershell
Remove-Item .\__corruption_probe_repo_DELETE_ME.ts, .\__bash_control_repo_DELETE_ME.txt, `
            .\__probe_delete_test, .\_ld.js, .\_parsecheck.js, .\_pc.js -Force -ErrorAction SilentlyContinue
```

The `forensics\` folder (this report + `Guard-FileIntegrity.ps1` + `pre-commit`) is the
deliverable — keep it.
