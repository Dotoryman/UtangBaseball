param(
  [Parameter(Mandatory = $true)][string]$InputPath,
  [Parameter(Mandatory = $true)][string]$OutputPath,
  [int]$Threshold = 238,
  [switch]$GreenBackground
)

Add-Type -AssemblyName System.Drawing

$source = [System.Drawing.Bitmap]::new((Resolve-Path -LiteralPath $InputPath).Path)
$bitmap = [System.Drawing.Bitmap]::new($source.Width, $source.Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.DrawImageUnscaled($source, 0, 0)
$graphics.Dispose()
$source.Dispose()

$width = $bitmap.Width
$height = $bitmap.Height

if ($GreenBackground) {
  for ($y = 0; $y -lt $height; $y++) {
    for ($x = 0; $x -lt $width; $x++) {
      $color = $bitmap.GetPixel($x, $y)
      if ($color.G -ge ($color.R + 14) -and $color.G -ge ($color.B + 14)) {
        $bitmap.SetPixel($x, $y, [System.Drawing.Color]::Transparent)
      }
    }
  }
  $destination = [System.IO.Path]::GetFullPath($OutputPath)
  $bitmap.Save($destination, [System.Drawing.Imaging.ImageFormat]::Png)
  $bitmap.Dispose()
  exit 0
}

$visited = [System.Collections.BitArray]::new($width * $height)
$queue = [System.Collections.Generic.Queue[int]]::new()

function Test-BackgroundPixel([System.Drawing.Color]$color) {
  if ($GreenBackground) {
    return $color.G -ge ($color.R + 18) -and $color.G -ge ($color.B + 18)
  }
  return $color.R -ge $Threshold -and $color.G -ge $Threshold -and $color.B -ge $Threshold
}

function Add-Pixel([int]$x, [int]$y) {
  if ($x -lt 0 -or $x -ge $width -or $y -lt 0 -or $y -ge $height) { return }
  $index = $y * $width + $x
  if ($visited[$index]) { return }
  $visited[$index] = $true
  if (Test-BackgroundPixel $bitmap.GetPixel($x, $y)) { $queue.Enqueue($index) }
}

for ($x = 0; $x -lt $width; $x++) { Add-Pixel $x 0; Add-Pixel $x ($height - 1) }
for ($y = 0; $y -lt $height; $y++) { Add-Pixel 0 $y; Add-Pixel ($width - 1) $y }

while ($queue.Count -gt 0) {
  $index = $queue.Dequeue()
  $x = $index % $width
  $y = [Math]::Floor($index / $width)
  $bitmap.SetPixel($x, $y, [System.Drawing.Color]::Transparent)
  Add-Pixel ($x - 1) $y
  Add-Pixel ($x + 1) $y
  Add-Pixel $x ($y - 1)
  Add-Pixel $x ($y + 1)
}

$destination = [System.IO.Path]::GetFullPath($OutputPath)
$bitmap.Save($destination, [System.Drawing.Imaging.ImageFormat]::Png)
$bitmap.Dispose()
