$ErrorActionPreference = "Stop"

# Create local bin directory
If (!(Test-Path -Path "bin")) {
    New-Item -ItemType Directory -Path "bin" | Out-Null
}

Write-Host "Fetching latest gallery-dl release version..."
$GalleryDlVersion = "v1.28.5" # Fallback version if request fails
try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    $Response = Invoke-RestMethod -Uri "https://codeberg.org/api/v1/repos/mikf/gallery-dl/releases/latest" -UseBasicParsing
    If ($Response.tag_name) {
        $GalleryDlVersion = $Response.tag_name
        Write-Host "Latest version found: $GalleryDlVersion"
    }
} catch {
    Write-Host "Failed to fetch latest version, falling back to $GalleryDlVersion"
}

$GalleryDlUrl = "https://codeberg.org/mikf/gallery-dl/releases/download/$GalleryDlVersion/gallery-dl.exe"
$FfmpegUrl = "https://github.com/ffbinaries/ffbinaries-prebuilt/releases/download/v6.1/ffmpeg-6.1-win-64.zip"
$FfprobeUrl = "https://github.com/ffbinaries/ffbinaries-prebuilt/releases/download/v6.1/ffprobe-6.1-win-64.zip"

Write-Host "Downloading gallery-dl.exe..."
Invoke-WebRequest -Uri $GalleryDlUrl -OutFile "bin\gallery-dl.exe" -UseBasicParsing

Write-Host "Downloading ffmpeg..."
Invoke-WebRequest -Uri $FfmpegUrl -OutFile "bin\ffmpeg.zip" -UseBasicParsing
Write-Host "Downloading ffprobe..."
Invoke-WebRequest -Uri $FfprobeUrl -OutFile "bin\ffprobe.zip" -UseBasicParsing

Write-Host "Extracting ffmpeg and ffprobe..."
Expand-Archive -Path "bin\ffmpeg.zip" -DestinationPath "bin" -Force
Expand-Archive -Path "bin\ffprobe.zip" -DestinationPath "bin" -Force

# Clean up zips
Remove-Item -Path "bin\ffmpeg.zip" -Force
Remove-Item -Path "bin\ffprobe.zip" -Force

Write-Host "Dependencies successfully installed locally in .\bin\!"
& .\bin\gallery-dl.exe --version
& .\bin\ffprobe.exe -version | Select-Object -First 1
