#!/usr/bin/env bash
set -euo pipefail
project_dir="$(cd "$(dirname "$0")/.." && pwd)"
dist_dir="$project_dir/dist"
archive="$dist_dir/homelens-chrome-v1.0.1.zip"
mkdir -p "$dist_dir"
rm -f "$archive"
cd "$project_dir/extension"
zip -qr "$archive" . -x "*.DS_Store"
unzip -t "$archive" >/dev/null
echo "$archive"
