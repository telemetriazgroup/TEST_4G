#!/bin/sh
# Libera el puerto TCP 9912 deteniendo contenedores que lo publiquen.
PORT="${CLEAN_PORT:-9912}"
echo "[port_cleaner] buscando contenedores en puerto ${PORT}…"

docker ps --format '{{.ID}} {{.Ports}}' | while read -r cid ports; do
  case "$ports" in
    *":${PORT}->"*|*:${PORT}/*)
      echo "[port_cleaner] stop $cid"
      docker stop "$cid" || true
      ;;
  esac
done

sleep 1
echo "[port_cleaner] listo"
