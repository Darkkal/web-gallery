#!/bin/bash
set -e

# Create local bin folder
mkdir -p bin

# Detect OS
OS_NAME=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH_NAME=$(uname -m)

echo "Detected OS: $OS_NAME ($ARCH_NAME)"

# Define download urls
GALLERY_DL_VERSION="v1.28.5" # Fallback version if API fetch fails
FFMPEG_URL=""
FFPROBE_URL=""
GALLERY_DL_URL=""

# Fetch latest gallery-dl version from Codeberg API
echo "Fetching latest gallery-dl release version..."
LATEST_TAG=$(curl -s https://codeberg.org/api/v1/repos/mikf/gallery-dl/releases/latest | grep -o '"tag_name": *"[^"]*"' | head -n 1 | cut -d'"' -f4 || true)
if [ -n "$LATEST_TAG" ]; then
    GALLERY_DL_VERSION="$LATEST_TAG"
    echo "Latest version found: $GALLERY_DL_VERSION"
else
    echo "Failed to fetch latest version, falling back to $GALLERY_DL_VERSION"
fi

if [ "$OS_NAME" = "linux" ]; then
    GALLERY_DL_URL="https://codeberg.org/mikf/gallery-dl/releases/download/${GALLERY_DL_VERSION}/gallery-dl.bin"
    FFMPEG_URL="https://github.com/ffbinaries/ffbinaries-prebuilt/releases/download/v6.1/ffmpeg-6.1-linux-64.zip"
    FFPROBE_URL="https://github.com/ffbinaries/ffbinaries-prebuilt/releases/download/v6.1/ffprobe-6.1-linux-64.zip"
elif [ "$OS_NAME" = "darwin" ]; then
    GALLERY_DL_URL="https://codeberg.org/mikf/gallery-dl/releases/download/${GALLERY_DL_VERSION}/gallery-dl.bin"
    FFMPEG_URL="https://github.com/ffbinaries/ffbinaries-prebuilt/releases/download/v6.1/ffmpeg-6.1-osx-64.zip"
    FFPROBE_URL="https://github.com/ffbinaries/ffbinaries-prebuilt/releases/download/v6.1/ffprobe-6.1-osx-64.zip"
else
    echo "Unsupported OS for setup-deps.sh. Please install dependencies manually."
    exit 1
fi

# 1. Download gallery-dl
echo "Downloading gallery-dl..."
curl -L -o bin/gallery-dl "$GALLERY_DL_URL"
chmod +x bin/gallery-dl

# 2. Download and extract ffmpeg / ffprobe
echo "Downloading ffmpeg..."
curl -L -o bin/ffmpeg.zip "$FFMPEG_URL"
echo "Downloading ffprobe..."
curl -L -o bin/ffprobe.zip "$FFPROBE_URL"

echo "Extracting ffmpeg and ffprobe..."
if command -v unzip >/dev/null; then
    unzip -o bin/ffmpeg.zip -d bin
    unzip -o bin/ffprobe.zip -d bin
else
    echo "Error: unzip is not installed. Please install unzip or manually extract bin/ffmpeg.zip and bin/ffprobe.zip."
    exit 1
fi

# Cleanup zips
rm -f bin/ffmpeg.zip bin/ffprobe.zip
chmod +x bin/ffmpeg bin/ffprobe

echo "Dependencies successfully installed locally in ./bin/!"
./bin/gallery-dl --version
./bin/ffprobe -version | head -n 1
