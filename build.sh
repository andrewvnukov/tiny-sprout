#!/usr/bin/env sh
# Собирает архив для загрузки в консоль Яндекс Игр.
# В архив попадает только то, что нужно игре в рантайме: index.html лежит в корне,
# внешних зависимостей нет (SDK подключается скриптом с домена Яндекса).
#
#   sh build.sh   ->   dist/tiny-sprout-yandex.zip
set -eu

OUT=dist
NAME=tiny-sprout-yandex.zip

rm -rf "$OUT"
mkdir -p "$OUT"

zip -r -q "$OUT/$NAME" \
    index.html \
    i18n.js data.js game.js render.js sfx.js ui.js \
    littlejs.release.js \
    art fonts \
    -x '*.DS_Store'

echo "$OUT/$NAME"
unzip -l "$OUT/$NAME" | tail -n 1
