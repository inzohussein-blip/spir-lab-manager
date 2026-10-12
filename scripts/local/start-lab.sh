#!/usr/bin/env bash
# النسخة المحلية: يشغّل التطبيق على هذا الحاسوب (Linux / macOS) على http://localhost:3000
# يحتاج Node.js 20 أو أحدث. أول تشغيل يثبّت الحزم ويبني التطبيق (دقائق)، وبعده يبدأ فوراً.
# البيانات في المجلد lab-data بجانب المشروع (غيّره بـ PGLITE_DATA_DIR)، ولا يُطلب رمز مختبر
# ما لم يُضبط LICENSE_ADMIN_PASSWORD. لخادم الشبكة المحلية اضبط LAN_HUB_KEY قبل التشغيل.
set -e
cd "$(dirname "$0")/../.."
command -v node >/dev/null 2>&1 || { echo "ثبّت Node.js 20 أو أحدث من https://nodejs.org ثم أعد التشغيل."; exit 1; }
[ -d node_modules ] || npm ci
# Build on the first run, and again after the project was updated.
if [ ! -f .next/BUILD_ID ] || [ package.json -nt .next/BUILD_ID ] || [ -n "$(find src public -newer .next/BUILD_ID -type f -print -quit 2>/dev/null)" ]; then npm run build; fi
# LAB_LOCAL_HTTP: the lab's other computers sign in to the admin panel over http://192.168.… too.
export PORT="${PORT:-3000}" PGLITE_DATA_DIR="${PGLITE_DATA_DIR:-$PWD/lab-data}" NEXT_TELEMETRY_DISABLED=1 LAB_LOCAL_HTTP=1
echo "افتح في المتصفح: http://localhost:$PORT/welcome  (أوقفه بـ Ctrl+C)"
exec npm start
