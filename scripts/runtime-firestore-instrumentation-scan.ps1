param([string]$ProjectRoot=".")
$root=(Resolve-Path $ProjectRoot).Path
$outDir=Join-Path $root "_audit"
New-Item -ItemType Directory -Force -Path $outDir|Out-Null
$out=Join-Path $outDir ("RUNTIME_FIRESTORE_INSTRUMENTATION_"+(Get-Date -Format "yyyyMMdd-HHmmss")+".md")
$files=Get-ChildItem $root -Recurse -File -Include *.js,*.html | Where-Object {$_.FullName -notmatch "\\node_modules\\|\\.git\\|\\_audit\\"}
$rows=@()
foreach($f in $files){
 $lines=Get-Content $f.FullName -Encoding UTF8
 for($i=0;$i -lt $lines.Count;$i++){
  if($lines[$i] -match '\.get\s*\(|\.onSnapshot\s*\(|transaction\.get\s*\(|\.set\s*\(|\.update\s*\(|\.add\s*\(|\.delete\s*\('){
   $rel=$f.FullName.Substring($root.Length).TrimStart("\")
   if($rel -match 'mycar|cardetail|car-data|car\\detail|identity|car-relations|seat|player|application|matching|reminder|accounting'){
    $rows += [PSCustomObject]@{File=$rel;Line=$i+1;Code=$lines[$i].Trim()}
   }
  }
 }
}
$md=@("# JLY Runtime Firestore Instrumentation Scan","","Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')","","## Candidate call sites","")
foreach($r in $rows){$md+="- $($r.File):$($r.Line)";$md+="  - $($r.Code)"}
$md+="";$md+="## Runtime test cases";$md+="";$md+="1. Fresh load My Cars, no interaction.";$md+="2. Page 1 -> 2 -> 3.";$md+="3. Search and clear.";$md+="4. Open one Car Detail and idle 60 seconds.";$md+="5. Edit one field.";$md+="6. Return to My Cars."
$md|Set-Content $out -Encoding UTF8
Write-Host "Runtime instrumentation scan complete." -ForegroundColor Green
Write-Host "Markdown: $out"
