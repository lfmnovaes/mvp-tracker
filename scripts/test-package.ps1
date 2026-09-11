param([Parameter(Mandatory=$true)][string]$ArchivePath)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
Add-Type -AssemblyName System.IO.Compression
$temporary = Join-Path ([IO.Path]::GetTempPath()) ('mvp-package-test-' + [guid]::NewGuid().ToString('N') + '.zip')
try {
  Copy-Item -LiteralPath $ArchivePath -Destination $temporary
  $zip = [IO.Compression.ZipFile]::Open($temporary, [IO.Compression.ZipArchiveMode]::Update)
  try {
    $entry = @($zip.Entries | Where-Object { $_.FullName -match '^MVP-Tracker-[^/]+/README.md$' })[0]
    $stream = $entry.Open(); $stream.Position = $stream.Length
    $writer = [IO.StreamWriter]::new($stream)
    try { $writer.WriteLine('Changed after packaging.') } finally { $writer.Dispose() }
  } finally { $zip.Dispose() }
  try {
    & (Join-Path $PSScriptRoot 'verify-portable.ps1') -ArchivePath $temporary
    throw 'Tampered ZIP was accepted.'
  } catch {
    if ($_.Exception.Message -notlike '*Manifest content mismatch:*') { throw }
  }
  'Tampered package correctly rejected.'
} finally {
  if ([IO.Path]::GetDirectoryName([IO.Path]::GetFullPath($temporary)) -ne [IO.Path]::GetTempPath().TrimEnd('\') -or [IO.Path]::GetFileName($temporary) -notmatch '^mvp-package-test-[a-f0-9]{32}\.zip$') { throw 'Unsafe temporary path.' }
  if (Test-Path -LiteralPath $temporary) { Remove-Item -LiteralPath $temporary -Force }
}
