param([Parameter(Mandatory=$true)][string]$ArchivePath)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$packageFile = [IO.Path]::GetFullPath($ArchivePath)
$zip = [IO.Compression.ZipFile]::OpenRead($packageFile)
try {
  $metadataEntry = @($zip.Entries | Where-Object { $_.FullName -match '/source/package.json$' })
  if ($metadataEntry.Count -ne 1) { throw 'Package metadata missing or duplicated.' }
  function Read-Text($entry) { $reader = [IO.StreamReader]::new($entry.Open()); try { return $reader.ReadToEnd() } finally { $reader.Dispose() } }
  $metadata = (Read-Text $metadataEntry[0]) | ConvertFrom-Json
  $prefix = 'MVP-Tracker-' + $metadata.version + '-windows-x64/'
  $files = @{}
  foreach ($entry in $zip.Entries) {
    $name = $entry.FullName.Replace('\','/')
    if (!$name.StartsWith($prefix) -or $name -match '(^|/)\.\.(/|$)' -or $name.Contains(':')) { throw 'Unsafe archive path.' }
    $relative = $name.Substring($prefix.Length)
    if ($relative.EndsWith('/') -or !$relative) { continue }
    if ($files.ContainsKey($relative)) { throw 'Duplicate archive entry.' }
    if ($relative -match '(^|/)(data|logs|node_modules|research|\.git|\.convex|\.tmp)(/|$)|sharing-secrets|\.env' -and $relative -notin @('source/.env.local.sample','.env.local.sample')) { throw 'Local state or configuration found in archive.' }
    $files[$relative] = $entry
  }
  $required = @('MVP Tracker.exe','resources.neu','extensions/bin/bun.exe','extensions/bin/mvp-shell.exe','extensions/bin/icon.ico','extensions/backend/index.js','README.md','LICENSE.txt','THIRD_PARTY_NOTICES.md','source/package.json','source/bun.lock','source/neutralino.config.json','source/src/shared/protocol.ts','source/convex/schema.ts','source/convex/timers.ts','source/.env.local.sample','source/docs/step-8-verification.md')
  foreach ($file in $required) { if (!$files.ContainsKey($file) -or $files[$file].Length -eq 0) { throw ('Required file missing: ' + $file) } }
  $readme = Read-Text $files['README.md']
  foreach ($link in [regex]::Matches($readme, '\]\(([^)#]+)(?:#[^)]*)?\)')) {
    $path = $link.Groups[1].Value
    if ($path -notmatch '^https?://' -and !$files.ContainsKey($path)) { throw ('Broken portable README link: ' + $path) }
  }
  $config = (Read-Text $files['source/neutralino.config.json']) | ConvertFrom-Json
  $protocol = Read-Text $files['source/src/shared/protocol.ts']
  if ($config.version -ne $metadata.version -or $protocol -notmatch ('VERSION = "' + [regex]::Escape($metadata.version) + '"')) { throw 'Version metadata mismatch.' }
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
  [pscustomobject]@{ Version=$metadata.version; Files=$files.Count; Executables='3 Windows x64'; LocalState='excluded'; ZipBytes=(Get-Item -LiteralPath $packageFile).Length; SHA256=(Get-FileHash -LiteralPath $packageFile -Algorithm SHA256).Hash } | ConvertTo-Json
} finally { $zip.Dispose() }
