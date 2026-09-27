#!/bin/bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="${1:-$ROOT/../CPractice.app}"
mkdir -p "$DEST/Contents/MacOS" "$DEST/Contents/Resources" "$ROOT/.build/module-cache"
cp -R "$ROOT"/Resources/. "$DEST/Contents/Resources/"
# QA injects its own script/config only after building its isolated bundle.
rm -f "$DEST/Contents/Resources/selftest.js" "$DEST/Contents/Resources/qa-config.json"
mkdir -p "$DEST/Contents/Resources/ThirdParty"
cp "$ROOT"/ThirdParty/* "$DEST/Contents/Resources/ThirdParty/"
xcrun clang -mmacosx-version-min=13.0 -O2 "$ROOT/Sources/limit-runner.c" -o "$DEST/Contents/Resources/limit-runner"
swiftc -swift-version 5 -target "$(uname -m)-apple-macosx13.0" -O -module-cache-path "$ROOT/.build/module-cache" -framework AppKit -framework WebKit -framework UniformTypeIdentifiers "$ROOT/Sources/StudyService.swift" "$ROOT/Sources/AnalysisService.swift" "$ROOT/Sources/LanguageService.swift" "$ROOT/Sources/Runner.swift" "$ROOT/Sources/main.swift" -o "$DEST/Contents/MacOS/CPractice"
cat > "$DEST/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleExecutable</key><string>CPractice</string>
<key>CFBundleIdentifier</key><string>local.cpractice.studio</string>
<key>CFBundleName</key><string>CPractice</string>
<key>CFBundleDisplayName</key><string>CPractice · C 语言练习室</string>
<key>CFBundleVersion</key><string>11</string>
<key>CFBundleShortVersionString</key><string>5.0.0</string>
<key>LSMinimumSystemVersion</key><string>13.0</string>
<key>NSHighResolutionCapable</key><true/>
<key>CFBundleIconFile</key><string>AppIcon</string>
</dict></plist>
PLIST
codesign --force --deep --sign - "$DEST"
printf 'Built %s\n' "$DEST"
