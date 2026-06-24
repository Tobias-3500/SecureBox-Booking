#!/usr/bin/env bash
# ============================================================================
# check-security.sh — Hurtigt sikkerhedsoverblik på serveren.
#
# HVAD FILEN GØR:
# Et hjælpescript til drift, der samler status ét sted: om Fail2ban kører, hvilke
# "jails" der er aktive, hvilke IP-adresser der er blokeret, samt de seneste linjer
# fra backendens log. Bruges til hurtigt at se, om nogen er ved at angribe serveren.
# ============================================================================
set -euo pipefail

# Sti til backendens log (kan overstyres med miljøvariablen BACKEND_LOG).
BACKEND_LOG="${BACKEND_LOG:-$(pwd)/logs/combined.log}"

echo "== Fail2Ban service =="
sudo systemctl --no-pager --full status fail2ban || true

echo
echo "== Fail2Ban jails =="
sudo fail2ban-client status || true

echo
echo "== Banned IPs =="
for jail in $(sudo fail2ban-client status 2>/dev/null | sed -n 's/.*Jail list:[[:space:]]*//p' | tr ',' ' '); do
  jail="$(echo "$jail" | xargs)"
  [ -z "$jail" ] && continue
  echo "-- $jail --"
  sudo fail2ban-client status "$jail" | sed -n 's/^[[:space:]]*`- Banned IP list:[[:space:]]*/Banned: /p'
done

echo
echo "== Backend combined.log last 10 lines =="
if [ -f "$BACKEND_LOG" ]; then
  tail -n 10 "$BACKEND_LOG"
else
  echo "Backend log not found at: $BACKEND_LOG"
  echo "Set BACKEND_LOG=/path/to/combined.log if your deployment path differs."
fi
