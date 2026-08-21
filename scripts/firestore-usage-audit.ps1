
param([string]$ProjectRoot = ".")

$ErrorActionPreference = "Stop"
$root = (Resolve-Path $ProjectRoot).Path
$outDir = Join-Path $root "_audit"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$csvPath = Join-Path $outDir "firestore-usage-$timestamp.csv"
$mdPath = Join-Path $outDir "FIRESTORE_USAGE_AUDIT_$timestamp.md"

$files = Get-ChildItem -Path $root -Recurse -File -Include *.js,*.mjs,*.cjs,*.html |
  Where-Object {
    $_.FullName -notmatch "\\node_modules\\" -and
    $_.FullName -notmatch "\\.git\\" -and
    $_.FullName -notmatch "\\_audit\\"
  }

$patterns = @(
  @{ Category="READ"; Type="full_collection_get"; Regex='\.collection\(\s*["'']([^"'']+)["'']\s*\)\s*\.get\s*\(' },
  @{ Category="READ"; Type="doc_get"; Regex='\.doc\s*\([^\r\n]+\)\s*\.get\s*\(' },
  @{ Category="READ"; Type="transaction_get"; Regex='transaction\.get\s*\(' },
  @{ Category="READ"; Type="listener_onSnapshot"; Regex='\.onSnapshot\s*\(' },
  @{ Category="WRITE"; Type="doc_set"; Regex='\.set\s*\(' },
  @{ Category="WRITE"; Type="doc_update"; Regex='\.update\s*\(' },
  @{ Category="WRITE"; Type="collection_add"; Regex='\.add\s*\(' },
  @{ Category="WRITE"; Type="doc_delete"; Regex='\.delete\s*\(' },
  @{ Category="WRITE"; Type="transaction_set"; Regex='transaction\.set\s*\(' },
  @{ Category="WRITE"; Type="transaction_update"; Regex='transaction\.update\s*\(' },
  @{ Category="WRITE"; Type="transaction_delete"; Regex='transaction\.delete\s*\(' }
)

$rows = @()

foreach ($file in $files) {
  $lines = Get-Content -LiteralPath $file.FullName -Encoding UTF8
  for ($i = 0; $i -lt $lines.Count; $i++) {
    foreach ($p in $patterns) {
      if ($lines[$i] -match $p.Regex) {
        $relative = $file.FullName.Substring($root.Length).TrimStart("\")
        $collection = ""
        if ($p.Type -eq "full_collection_get" -and $Matches.Count -gt 1) {
          $collection = $Matches[1]
        }
        $risk = "normal"
        if ($p.Type -eq "full_collection_get") { $risk = "HIGH" }
        elseif ($p.Type -eq "listener_onSnapshot") { $risk = "WATCH" }
        elseif ($p.Type -eq "transaction_get") { $risk = "WRITE_PATH_READ" }

        $rows += [PSCustomObject]@{
          Category=$p.Category
          Type=$p.Type
          Risk=$risk
          Collection=$collection
          File=$relative
          Line=$i+1
          Code=$lines[$i].Trim()
        }
      }
    }
  }
}

$rows | Export-Csv -NoTypeInformation -Encoding UTF8 -Path $csvPath

$reads = @($rows | Where-Object Category -eq "READ")
$writes = @($rows | Where-Object Category -eq "WRITE")
$high = @($rows | Where-Object Risk -eq "HIGH")
$watch = @($rows | Where-Object Risk -eq "WATCH")
$fullCarScans = @($high | Where-Object Collection -eq "cars")

$md = @()
$md += "# JLY Host System | Firestore Read / Write Audit"
$md += ""
$md += "Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
$md += ""
$md += "## Summary"
$md += ""
$md += "- Static READ call sites: **$($reads.Count)**"
$md += "- Static WRITE call sites: **$($writes.Count)**"
$md += "- Full collection get call sites: **$($high.Count)**"
$md += "- Full cars collection scan call sites: **$($fullCarScans.Count)**"
$md += "- onSnapshot listener call sites: **$($watch.Count)**"
$md += ""
$md += "## Highest priority: full collection reads"
$md += ""

foreach ($r in $high) {
  $md += "- **$($r.File):$($r.Line)** [$($r.Type)] collection=$($r.Collection)"
  $md += "  - $($r.Code)"
}

$md += ""
$md += "## Top files by READ call sites"
$md += ""
foreach ($g in ($reads | Group-Object File | Sort-Object Count -Descending | Select-Object -First 20)) {
  $md += "- **$($g.Count)** | $($g.Name)"
}

$md += ""
$md += "## Top files by WRITE call sites"
$md += ""
foreach ($g in ($writes | Group-Object File | Sort-Object Count -Descending | Select-Object -First 20)) {
  $md += "- **$($g.Count)** | $($g.Name)"
}

$md += ""
$md += "## Target architecture"
$md += ""
$md += "1. UI does not call Firestore directly."
$md += "2. UI reads JLY Local/View Store."
$md += "3. Cloud is Source of Truth + cross-device synchronization."
$md += "4. Changes update only affected entity/view snapshots."
$md += "5. My Cars renders saved View data, not a fresh cars scan."
$md += "6. One Car page reads one prepared Car View, not separate script/studio/people queries."
$md += "7. A lightweight version/change manifest is allowed; unchanged data is not downloaded again."

$md | Set-Content -Encoding UTF8 -Path $mdPath

Write-Host ""
Write-Host "JLY Firestore audit complete." -ForegroundColor Green
Write-Host "Markdown: $mdPath"
Write-Host "CSV: $csvPath"
