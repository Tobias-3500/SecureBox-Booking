#!/usr/bin/env bash
# ============================================================================
# backup.sh — Automatisk databasebackup (kører på produktions-VM'en via cron).
#
# HVAD FILEN GØR:
# Tager en komprimeret dump af PostgreSQL-databasen og overfører den sikkert til en
# separat backup-VM med scp. Hvert trin logges som JSON til combined.log/error.log,
# som admin-dashboardet læser for at vise backup-status.
#
# HVORFOR: Koden kan altid genskabes fra GitHub, men kundedata og bookinger findes kun
# i databasen. Derfor er databasebackup det vigtigste driftspunkt.
# ============================================================================
set -uo pipefail   # Stop ved brug af udefinerede variabler; fang fejl i pipes

# --- Indstillinger: container, databasenavn/bruger og hvor backuppen sendes hen ---
CONTAINER_NAME="salon_db"
DB_NAME="salon_db"
DB_USER="salon_user"
REMOTE_DEST="root@10.0.0.1:/backups/postgres/"

LOG_DIR="/root/apps/logs"
COMBINED_LOG="${LOG_DIR}/combined.log"
ERROR_LOG="${LOG_DIR}/error.log"
BACKUP_FILE="/tmp/${DB_NAME}_$(date +%Y%m%d_%H%M%S).sql.gz"

mkdir -p "$LOG_DIR"

# Skriver én struktureret JSON-loglinje (samme format som backend bruger).
# Fejl-niveau skrives også til error.log.
log_message() {
  local level="$1"
  local message="$2"
  shift 2

  local line
  line="$(python3 - "$level" "$message" "$@" <<'PY'
import json
import sys
from datetime import datetime, timezone

level = sys.argv[1]
message = sys.argv[2]
metadata = {}

for item in sys.argv[3:]:
    if "=" in item:
        key, value = item.split("=", 1)
        metadata[key] = value

payload = {
    "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    "level": level,
    "message": message,
    "service": "postgres-backup",
}
payload.update(metadata)

print(json.dumps(payload, separators=(",", ":")))
PY
)"

  printf '%s\n' "$line" >> "$COMBINED_LOG"

  if [ "$level" = "error" ]; then
    printf '%s\n' "$line" >> "$ERROR_LOG"
  fi
}

cleanup_failed_backup() {
  if [ -f "$BACKUP_FILE" ]; then
    rm -f "$BACKUP_FILE"
  fi
}

log_message "info" "PostgreSQL backup started" \
  "container=${CONTAINER_NAME}" \
  "database=${DB_NAME}" \
  "backupFile=${BACKUP_FILE}"

# Trin 1: Lav en komprimeret database-dump. Fejler det, ryddes op og scriptet stopper.
if ! docker exec "$CONTAINER_NAME" pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$BACKUP_FILE"; then
  log_message "error" "PostgreSQL backup dump failed" \
    "container=${CONTAINER_NAME}" \
    "database=${DB_NAME}" \
    "backupFile=${BACKUP_FILE}"
  cleanup_failed_backup
  exit 1
fi

log_message "info" "PostgreSQL backup dump completed" \
  "backupFile=${BACKUP_FILE}" \
  "sizeBytes=$(stat -c%s "$BACKUP_FILE" 2>/dev/null || echo unknown)"

log_message "info" "PostgreSQL backup transfer started" \
  "backupFile=${BACKUP_FILE}" \
  "remoteDest=${REMOTE_DEST}"

# Trin 2: Overfør dumpen til backup-VM'en. Lykkes det, slettes den midlertidige lokale fil.
if scp "$BACKUP_FILE" "$REMOTE_DEST"; then
  log_message "info" "PostgreSQL backup transfer completed" \
    "backupFile=${BACKUP_FILE}" \
    "remoteDest=${REMOTE_DEST}"
  rm -f "$BACKUP_FILE"
  log_message "info" "Temporary PostgreSQL backup file deleted" \
    "backupFile=${BACKUP_FILE}"
else
  log_message "error" "PostgreSQL backup transfer failed" \
    "backupFile=${BACKUP_FILE}" \
    "remoteDest=${REMOTE_DEST}"
  log_message "warn" "Temporary PostgreSQL backup file kept for inspection" \
    "backupFile=${BACKUP_FILE}"
  exit 1
fi
