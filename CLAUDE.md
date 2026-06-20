# LeadClaw — Claude / Cowork Instructions

> The canonical agent rules live in **`AGENTS.md`**. The critical file-integrity guard
> is mirrored here so it applies even if only this file is read. Keep both in sync.

## ⚠ File-integrity guard (READ FIRST)

This repo is edited through a mounted filesystem that **silently corrupts in-place
overwrites of existing files**. The overwrite does **not resize the file**, so it stays
pinned at its previous on-disk length:

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
   `Write-FileAtomic` in `forensics/Guard-FileIntegrity.ps1` (temp → flush → verify
   length + no-NUL + expected tail → rename over the target).
3. **After every write, verify on disk:** byte length is as intended; **zero NUL bytes**
   (`tr -cd '\000' < FILE | wc -c` prints `0`); and the file ends with its expected
   final line / closing token (`}`, `;`, `</…>`).
4. **Repair:** trailing-NUL padding → `Repair-TrailingNul -Path <file>`. Truncated with
   no NUL (cut mid-statement) → `git checkout -- <file>` (bytes are gone).
5. **Commit guard:** `Copy-Item .\forensics\pre-commit .\.git\hooks\pre-commit -Force`
   rejects any staged file containing a NUL byte. Keep `tsc`/`build` in CI as the
   truncation backstop.

Full diagnosis and tooling: **`forensics/FILE-CORRUPTION-FORENSICS.md`**.
