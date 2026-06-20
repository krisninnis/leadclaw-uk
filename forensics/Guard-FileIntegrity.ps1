<#
.SYNOPSIS
  LeadClaw file-integrity guard: scan for NUL-byte corruption, repair trailing
  NULs safely, and write files atomically with post-write verification.

  Root cause this defends against: agent/editor file tools overwriting an
  existing file across the Windows<->sandbox virtiofs mount do not resize the
  file to the new content length. Longer new content -> tail truncated;
  shorter new content -> tail zero-filled (trailing NUL bytes).

  Dot-source it:   . .\forensics\Guard-FileIntegrity.ps1
  Then call:       Find-NulFiles ; Repair-TrailingNul -Path src\lib\foo.ts
                   Write-FileAtomic -Path out.ts -Content $text -ExpectedTail "}`n"
  Works on Windows PowerShell 5.1 and PowerShell 7+.
#>

# ---------------------------------------------------------------------------
# 1) SCANNER — list every file containing a NUL byte (skips .git/node_modules/binaries)
# ---------------------------------------------------------------------------
function Find-NulFiles {
    [CmdletBinding()]
    param(
        [string]   $Root        = ".",
        [string[]] $SkipDirs    = @('.git','node_modules','.next','dist','build','out','coverage'),
        [string[]] $BinaryExt   = @('.png','.jpg','.jpeg','.gif','.webp','.ico','.pdf','.zip','.woff','.woff2','.ttf','.eot','.mp4','.mov','.wasm','.gz','.br')
    )
    $skipRegex = '[\\/](' + (($SkipDirs | ForEach-Object {[regex]::Escape($_)}) -join '|') + ')[\\/]'
    Get-ChildItem -LiteralPath $Root -Recurse -File -ErrorAction SilentlyContinue | Where-Object {
        ($_.FullName -notmatch $skipRegex) -and ($BinaryExt -notcontains $_.Extension.ToLower())
    } | ForEach-Object {
        try {
            $bytes = [System.IO.File]::ReadAllBytes($_.FullName)
            $first = [Array]::IndexOf($bytes, [byte]0)
            if ($first -ge 0) {
                $trail = 0
                for ($i = $bytes.Length - 1; $i -ge 0 -and $bytes[$i] -eq 0; $i--) { $trail++ }
                [pscustomobject]@{
                    File        = $_.FullName
                    Bytes       = $bytes.Length
                    FirstNulAt  = $first
                    TrailingNul = $trail
                    PureTail    = ($trail -eq ($bytes.Length - $first))   # $true => clean trailing-only padding
                }
            }
        } catch { Write-Warning "Could not read $($_.FullName): $_" }
    }
}

# ---------------------------------------------------------------------------
# 2) REPAIR — strip ONLY trailing NUL bytes, atomically, then verify
# ---------------------------------------------------------------------------
function Repair-TrailingNul {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string] $Path,
        [switch] $WhatIf
    )
    if (-not (Test-Path -LiteralPath $Path)) { throw "Not found: $Path" }
    $bytes = [System.IO.File]::ReadAllBytes($Path)
    $end = $bytes.Length
    while ($end -gt 0 -and $bytes[$end - 1] -eq 0) { $end-- }
    $removed = $bytes.Length - $end
    if ($removed -eq 0) { Write-Host "OK  no trailing NUL bytes: $Path"; return }
    # Refuse if there are INTERIOR NULs (not a clean trailing-pad case) -> needs manual / git restore
    if ([Array]::IndexOf($bytes, [byte]0) -lt $end) {
        Write-Warning "INTERIOR NUL bytes in $Path -- not a pure trailing pad. Restore from git instead: git checkout -- `"$Path`""
        return
    }
    if ($WhatIf) { Write-Host "WHATIF would strip $removed trailing NUL byte(s): $Path ($($bytes.Length) -> $end B)"; return }
    $out = New-Object byte[] $end
    if ($end -gt 0) { [System.Array]::Copy($bytes, $out, $end) }
    $tmp = "$Path.repairtmp"
    [System.IO.File]::WriteAllBytes($tmp, $out)
    $check = [System.IO.File]::ReadAllBytes($tmp)
    if ($check.Length -ne $end -or [Array]::IndexOf($check, [byte]0) -ge 0) {
        Remove-Item -LiteralPath $tmp -Force
        throw "REPAIR VERIFY FAILED for $Path"
    }
    Move-Item -LiteralPath $tmp -Destination $Path -Force
    Write-Host "FIXED stripped $removed trailing NUL byte(s): $Path -> $end B, 0 NUL remaining"
}

# Repair every NUL file found under a root (trailing-pad cases only)
function Repair-AllTrailingNul {
    param([string] $Root = ".", [switch] $WhatIf)
    Find-NulFiles -Root $Root | ForEach-Object { Repair-TrailingNul -Path $_.File -WhatIf:$WhatIf }
}

# ---------------------------------------------------------------------------
# 3) ATOMIC WRITE-THEN-VERIFY — use this instead of Set-Content for generated files
# ---------------------------------------------------------------------------
function Write-FileAtomic {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string] $Path,
        [Parameter(Mandatory)][string] $Content,
        [string] $ExpectedTail            # optional: file must end with this exact string
    )
    $enc   = New-Object System.Text.UTF8Encoding($false)   # UTF-8, NO BOM
    $bytes = $enc.GetBytes($Content)
    $full  = [System.IO.Path]::GetFullPath($Path)
    $dir   = [System.IO.Path]::GetDirectoryName($full)
    if (-not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
    $tmp   = [System.IO.Path]::Combine($dir, [System.IO.Path]::GetFileName($full) + '.' + ([guid]::NewGuid().ToString('N')) + '.tmp')

    [System.IO.File]::WriteAllBytes($tmp, $bytes)
    $fs = [System.IO.File]::Open($tmp, 'Open', 'ReadWrite'); $fs.Flush($true); $fs.Close()   # force OS flush

    $disk = [System.IO.File]::ReadAllBytes($tmp)
    if ($disk.Length -ne $bytes.Length) { Remove-Item -LiteralPath $tmp -Force; throw "ATOMIC WRITE FAILED (length $($disk.Length) != $($bytes.Length)): $Path" }
    if ([Array]::IndexOf($disk, [byte]0) -ge 0) { Remove-Item -LiteralPath $tmp -Force; throw "ATOMIC WRITE FAILED (NUL bytes present): $Path" }
    if ($ExpectedTail) {
        $t = $enc.GetBytes($ExpectedTail); $ok = $disk.Length -ge $t.Length
        if ($ok) { for ($i = 0; $i -lt $t.Length; $i++) { if ($disk[$disk.Length - $t.Length + $i] -ne $t[$i]) { $ok = $false; break } } }
        if (-not $ok) { Remove-Item -LiteralPath $tmp -Force; throw "ATOMIC WRITE FAILED (expected tail missing): $Path" }
    }
    Move-Item -LiteralPath $tmp -Destination $full -Force
    Write-Host "OK  wrote $($bytes.Length) B (verified length + no-NUL$(if($ExpectedTail){' + tail'})): $Path"
}

# Quick one-liner equivalent of the scanner (paste-and-run):
#   Get-ChildItem -Recurse -File | ? { $_.FullName -notmatch '\\(\.git|node_modules|\.next)\\' -and
#     [Array]::IndexOf([IO.File]::ReadAllBytes($_.FullName),[byte]0) -ge 0 } | Select FullName
