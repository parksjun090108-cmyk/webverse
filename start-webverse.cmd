@echo off
cd /d "%~dp0"
title WebVerse
echo Starting WebVerse...
echo Open http://localhost:4173 if the browser does not open.
echo Press Ctrl+C to stop.
start "WebVerse API" /min "C:\Users\parks\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" ".\node_modules\tsx\dist\cli.mjs" "server\index.ts"
start "" "http://localhost:4173"
"C:\Users\parks\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" ".\node_modules\vite\bin\vite.js" --host localhost --port 4173
pause
