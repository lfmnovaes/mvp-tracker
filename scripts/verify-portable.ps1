param([Parameter(Mandatory=$true)][string]$ArchivePath, [string]$SourceArchivePath)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$packageFile = [IO.Path]::GetFullPath($ArchivePath)
$zip = [IO.Compression.ZipFile]::OpenRead($packageFile)
$sourceZip = $null
try {
  $metadataEntry = @($zip.Entries | Where-Object { $_.FullName -match '^MVP-Tracker-[0-9.]+-windows-x64/release-manifest.json$' })
  if ($metadataEntry.Count -ne 1) { throw 'Package manifest missing or duplicated.' }
  function Read-Text($entry) { $reader = [IO.StreamReader]::new($entry.Open()); try { return $reader.ReadToEnd() } finally { $reader.Dispose() } }
  $metadata = (Read-Text $metadataEntry[0]) | ConvertFrom-Json
  if ($metadata.version -notmatch '^\d+\.\d+\.\d+(?:\.\d+)?$' -or $metadata.sourceArchive -ne ('MVP-Tracker-' + $metadata.version + '-source.zip')) { throw 'Invalid source archive metadata.' }
  $prefix = 'MVP-Tracker-' + $metadata.version + '-windows-x64/'
  $files = @{}
  foreach ($entry in $zip.Entries) {
    $name = $entry.FullName.Replace('\','/')
    if (!$name.StartsWith($prefix) -or $name -match '(^|/)\.\.(/|$)' -or $name.Contains(':')) { throw 'Unsafe archive path.' }
    $relative = $name.Substring($prefix.Length)
    if ($relative.EndsWith('/') -or !$relative) { continue }
    if ($files.ContainsKey($relative)) { throw 'Duplicate archive entry.' }
    if ($relative -notin @('MVP Tracker.exe','resources.neu','LICENSE.txt','NOTICE.txt','HELP.txt','release-manifest.json','extensions/bin/bun.exe','extensions/bin/mvp-shell.exe','extensions/bin/icon.ico','extensions/backend/index.js') -and $relative -notmatch '^licenses/[^/]+$') { throw 'Unexpected runtime file.' }
    if ($relative -match '\.md$') { throw 'Markdown found in runtime archive.' }
    if ($relative -match '(^|/)(data|logs|node_modules|research|\.git|\.convex|\.tmp)(/|$)|sharing-secrets|\.env' -and $relative -notin @('source/.env.local.sample','.env.local.sample')) { throw 'Local state or configuration found in archive.' }
    $files[$relative] = $entry
  }
  $runtimeCount = $files.Count
  if (@($files.Keys | Where-Object { $_ -like 'licenses/*' }).Count -lt 5) { throw 'Dependency notices missing.' }
  if (!$SourceArchivePath) { $SourceArchivePath = Join-Path ([IO.Path]::GetDirectoryName($packageFile)) $metadata.sourceArchive }
  $sourceZip = [IO.Compression.ZipFile]::OpenRead([IO.Path]::GetFullPath($SourceArchivePath))
  $sourcePrefix = 'MVP-Tracker-' + $metadata.version + '-source/'
  foreach ($entry in $sourceZip.Entries) {
    $name = $entry.FullName.Replace('\','/')
    if (!$name.StartsWith($sourcePrefix) -or $name -match '(^|/)\.\.?(/|$)' -or $name.Contains(':')) { throw 'Unsafe source archive path.' }
    $relative = $name.Substring($sourcePrefix.Length)
    if (!$relative -or $relative.EndsWith('/')) { continue }
    if ($relative -match '(^|/)(data|logs|node_modules|research|\.git|\.convex|\.tmp)(/|$)|secrets|\.env|\.(exe|dll|so|dylib|zip|log)$' -and $relative -ne '.env.local.sample') { throw 'Private state or binary found in source archive.' }
    if ($files.ContainsKey('source/' + $relative)) { throw 'Duplicate source archive entry.' }
    $files['source/' + $relative] = $entry
  }
  $required = @('MVP Tracker.exe','resources.neu','extensions/bin/bun.exe','extensions/bin/mvp-shell.exe','extensions/bin/icon.ico','extensions/backend/index.js','HELP.txt','LICENSE.txt','NOTICE.txt','source/package.json','source/bun.lock','source/neutralino.config.json','source/src/shared/protocol.ts','source/convex/schema.ts','source/convex/timers.ts','source/.env.local.sample','source/docs/plan.md','source/docs/testing.md','source/.github/workflows/windows.yml')
  foreach ($file in $required) { if (!$files.ContainsKey($file) -or $files[$file].Length -eq 0) { throw ('Required file missing: ' + $file) } }
  $readme = Read-Text $files['source/README.md']
  foreach ($link in [regex]::Matches($readme, '\]\(([^)#]+)(?:#[^)]*)?\)')) {
    $path = $link.Groups[1].Value
    if ($path -notmatch '^https?://' -and !$files.ContainsKey('source/' + $path)) { throw ('Broken source README link: ' + $path) }
  }
  $config = (Read-Text $files['source/neutralino.config.json']) | ConvertFrom-Json
  $protocol = Read-Text $files['source/src/shared/protocol.ts']
  $packageMetadata = (Read-Text $files['source/package.json']) | ConvertFrom-Json
  if ($packageMetadata.version -ne $metadata.version -or $config.version -ne $metadata.version -or $protocol -notmatch ('VERSION = "' + [regex]::Escape($metadata.version) + '"')) { throw 'Version metadata mismatch.' }
  if (!$files.ContainsKey('release-manifest.json')) { throw 'Release manifest missing.' }
  $manifest = (Read-Text $files['release-manifest.json']) | ConvertFrom-Json
  if ($manifest.schemaVersion -ne 2 -or $manifest.version -ne $metadata.version -or $manifest.target -ne 'windows-x64' -or !$manifest.unsigned) { throw 'Invalid release manifest.' }
  if (!(Read-Text $files['NOTICE.txt']).Contains($manifest.sourceArchive)) { throw 'Source download notice missing.' }
  $listed = @{}
  $records = @($manifest.files) + @($manifest.sourceFiles | ForEach-Object { [pscustomobject]@{path=('source/' + $_.path); bytes=$_.bytes; sha256=$_.sha256} })
  foreach ($entry in $records) {
    if ($listed.ContainsKey($entry.path) -or !$files.ContainsKey($entry.path) -or $entry.path -eq 'release-manifest.json') { throw 'Invalid manifest path.' }
    $listed[$entry.path] = $true
    $stream = $files[$entry.path].Open(); $hasher = [Security.Cryptography.SHA256]::Create()
    try { $hash = [BitConverter]::ToString($hasher.ComputeHash($stream)).Replace('-','').ToLowerInvariant() } finally { $stream.Dispose(); $hasher.Dispose() }
    if ($hash -ne $entry.sha256 -or $files[$entry.path].Length -ne $entry.bytes) { throw ('Manifest content mismatch: ' + $entry.path) }
  }
  if ($listed.Count -ne $files.Count - 1) { throw 'Unlisted package files.' }
  $executables = @('MVP Tracker.exe','extensions/bin/bun.exe','extensions/bin/mvp-shell.exe')
  foreach ($file in $files.Keys) { if ($file.EndsWith('.exe') -and $file -notin $executables) { throw 'Unexpected executable.' } }
  foreach ($file in $executables) {
    $reader = [IO.BinaryReader]::new($files[$file].Open())
    try {
      $header = $reader.ReadBytes(64)
      if ($header.Length -ne 64 -or $header[0] -ne 77 -or $header[1] -ne 90) { throw 'Invalid Windows executable.' }
      $offset = [BitConverter]::ToInt32($header,60)
      if ($offset -lt 64 -or $offset -gt 1048576) { throw 'Invalid PE header.' }
      [void]$reader.ReadBytes($offset - 64)
      if ($reader.ReadUInt32() -ne 17744 -or $reader.ReadUInt16() -ne 34404) { throw 'Executable is not Windows x64.' }
    } finally { $reader.Dispose() }
  }
  [pscustomobject]@{ Version=$metadata.version; RuntimeFiles=$runtimeCount; SourceFiles=($files.Count-$runtimeCount); Executables='3 Windows x64'; LocalState='excluded'; Manifest='both archives verified'; ZipBytes=(Get-Item -LiteralPath $packageFile).Length; SHA256=(Get-FileHash -LiteralPath $packageFile -Algorithm SHA256).Hash } | ConvertTo-Json
} finally { if ($sourceZip) { $sourceZip.Dispose() }; $zip.Dispose() }
