#!/system/bin/sh
# Restore /data/local/tmp/libsec if an app wiped tmp after boot.
MODDIR=${0%/*}
RUNTIME=/data/local/tmp/libsec
MIRROR="$MODDIR/runtime"

mkdir -p "$RUNTIME" "$MIRROR"

restore_if_missing() {
  name="$1"
  if [ ! -f "$RUNTIME/$name" ] && [ -f "$MIRROR/$name" ]; then
    cp -f "$MIRROR/$name" "$RUNTIME/$name"
    chmod 644 "$RUNTIME/$name"
  fi
}

if [ ! -f "$RUNTIME/config.json" ]; then
  if [ -f "$MIRROR/config.json" ]; then
    cp -f "$MIRROR/config.json" "$RUNTIME/config.json"
  else
    printf '%s\n' '{ "targets": [] }' > "$RUNTIME/config.json"
  fi
  chmod 644 "$RUNTIME/config.json"
fi

restore_if_missing "libsecmon.so"
restore_if_missing "libsecmon.config.so"

chmod 0755 "$RUNTIME"
chmod 0644 "$RUNTIME"/* 2>/dev/null || true
