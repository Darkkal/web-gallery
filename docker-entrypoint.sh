#!/bin/sh
set -e

# Ensure data subdirectories exist when DATA_DIR is set.
if [ -n "$DATA_DIR" ]; then
  mkdir -p "$DATA_DIR/scrapers/gallery-dl/archives" \
           "$DATA_DIR/scrapers/gallery-dl/logs"
fi

# Ensure media subdirectories exist when MEDIA_DIR is set.
if [ -n "$MEDIA_DIR" ]; then
  mkdir -p "$MEDIA_DIR/downloads" \
           "$MEDIA_DIR/avatars"
fi

# Execute the main container command (e.g. node server.js)
exec "$@"
