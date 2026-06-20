# LeadClaw — Agent Instructions

> Canonical agent rules for this repo. `CLAUDE.md` mirrors the critical guard below;
> keep the two in sync.

## ⚠ File-integrity guard (READ FIRST)

This repo is edited through a mounted filesystem that **silently corrupts in-place
overwrites of existing files**. The overwrite rewrites bytes but does **not resize the
file**, so it stays pinned at its previous on-disk length:

- new content **longer** than the old file → overflow tail dropped → **truncation
  mid-statement** (missing closing braces/tags, no NUL byte);
- new content **shorter** → leftover tail zero-filled → **trailing NUL bytes** (`\x00`).

Content is correct up to the cut. **New-file creation and single-pass stream-writes are
unaffected** — the fault is specific to overwriting an existing file.

### Rules

1. **Never** use the Edit/Write tools to modify an **existing** file. Creating a
   brand-new file is fine.
2. To change an existing file, rewrite the whole file in **one stream-write** —
   bash `cat > path <<'EOF' … EOF` — **or** use the atomic write-then-verify wrapper
   `Write-FileAtomic` in `forensics/Guard-FileIntegrity.ps1` (writes to a temp file,
   flushes, verifies length + no-NUL + expected tail, then renames over the target).
3. **After every write, verify on disk:**
   - byte length matches what you intended;
   - **zero NUL bytes** — `tr -cd '\000' < FILE | wc -c` must print `0`
     (PowerShell: `[Array]::IndexOf([IO.File]::ReadAllBytes($f),[byte]0)` must be `-1`);
   - the file ends with its expected final line / closing token (`}`, `;`, `</…>`).
4. **Repair:** trailing-NUL padding → `Repair-TrailingNul -Path <file>` (strips only
   trailing NULs, atomically, verified). Truncated with no NUL (cut mid-statement) →
   `git checkout -- <file>` — the bytes are gone, stripping cannot help.
5. **Install the commit guard once:**
   `Copy-Item .\forensics\pre-commit .\.git\hooks\pre-commit -Force` — it rejects any
   staged file containing a NUL byte. Keep `tsc` / `next build` in CI as the truncation
   backstop (the hook cannot see truncation, which leaves no NUL).

Full diagnosis, evidence, and tooling: **`forensics/FILE-CORRUPTION-FORENSICS.md`**.

## Build / test in the sandbox

`npm run build` (next build) cannot run in the Linux sandbox (native SWC binary +
frequently-corrupt `package-lock.json`). Validate with `npx jest <pattern>` and
`npx tsc --noEmit` scoped to your files; recommend the user run `npm run build` on
Windows.
