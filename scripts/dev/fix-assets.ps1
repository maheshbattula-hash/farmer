Add-Type -AssemblyName System.Drawing

$assetsDir = Join-Path $PSScriptRoot "..\..\apps\mobile\assets"
$files = @("splash-light.png", "splash-dark.png")

foreach ($file in $files) {
    $fullPath = Join-Path $assetsDir $file
    if (Test-Path $fullPath) {
        $img = [System.Drawing.Image]::FromFile((Resolve-Path $fullPath))
        $tmpPath = "$fullPath.tmp"
        $img.Save($tmpPath, [System.Drawing.Imaging.ImageFormat]::Png)
        $img.Dispose()
        Move-Item -Force $tmpPath $fullPath
        Write-Host "Successfully re-encoded $file to valid PNG format."
    }
}
