#!/bin/bash
# Copy Vite build output to chrome-extension root for Chrome extension loading
# Usage: ./copy-build-to-root.sh

set -e

BUILD_DIR="dist"
EXT_DIR="."  # run from chrome-extension/

# Copy popup.html and popup.js to extension root
cp "$BUILD_DIR/popup.html" "$EXT_DIR/popup.html"
cp "$BUILD_DIR/popup.js" "$EXT_DIR/popup.js"

echo "Copied popup.html and popup.js to chrome-extension root."
