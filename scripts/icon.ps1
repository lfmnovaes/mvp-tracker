$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public class IconHandles { [DllImport("user32.dll")] public static extern bool DestroyIcon(IntPtr handle); }
'@
$bitmap = New-Object Drawing.Bitmap 256,256
$graphics = [Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.Clear([Drawing.Color]::FromArgb(22,31,44))
$pen = New-Object Drawing.Pen ([Drawing.Color]::FromArgb(98,219,194)),16
$graphics.DrawArc($pen,44,44,168,168,0,360)
$graphics.DrawLine($pen,128,77,128,132)
$graphics.DrawLine($pen,128,132,165,150)
$graphics.FillEllipse([Drawing.Brushes]::White,115,115,26,26)
$bitmap.Save((Join-Path $PSScriptRoot '../resources/icon.png'), [Drawing.Imaging.ImageFormat]::Png)
$handle = $bitmap.GetHicon()
$icon = [Drawing.Icon]::FromHandle($handle)
$stream = [IO.File]::Create((Join-Path $PSScriptRoot '../extensions/bin/icon.ico'))
try { $icon.Save($stream) } finally { $stream.Dispose(); $icon.Dispose(); [IconHandles]::DestroyIcon($handle) | Out-Null; $pen.Dispose(); $graphics.Dispose(); $bitmap.Dispose() }
