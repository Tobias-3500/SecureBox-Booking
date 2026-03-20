# Deploy to VM

When you push to `main`, GitHub Actions builds the backend and frontend images, pushes them to GHCR, then deploys to your VM.

## What gets deployed

- **Copied to VM:** `docker-compose.prod.yml`, `.env` (from secret), `nginx.conf`, `website/`
- **Not touched on VM:** `certbot/`, `renew_ssl.sh`, your backup script, VPN config, or any file not in the list above.

So your VPN tunnel and nightly backup (e.g. `/root/backup.sh` and cron) keep working as before.

## VM layout

- **VM_PROJECT_PATH** (e.g. `/root/apps`) must be the directory that contains (or will contain):
  - `docker-compose.prod.yml` (deployed from repo)
  - `.env` (deployed from GitHub secret `ENV_FILE`)
  - `nginx.conf` (deployed from repo)
  - `website/` (deployed from repo)
  - `certbot/` (you keep this on the VM; not overwritten)
  - `renew_ssl.sh` (you keep this on the VM; not overwritten)

The deploy runs:

```bash
cd $VM_PROJECT_PATH
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d --remove-orphans
```

So the app runs from **docker-compose.prod.yml** (image-only, no build). Your existing `docker-compose.yml` on the VM is not overwritten.

## GitHub secrets

- **ENV_FILE** – Full contents of your production `.env` (one multiline secret). Include at least:
  - `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`
  - `DB_HOST=db`, `DB_PORT=5432`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
  - `BACKEND_PORT=3001`, `JWT_SECRET`, `CORS_ORIGIN` (e.g. `https://securebox.dk`)
  - `ADMIN_EMAIL=secureboxadminUCL@gmail.com`
  - Optional (for admin backup panel): `BACKUP_VM_HOST=10.0.0.1`, `BACKUP_SCRIPT_PATH=/root/backup.sh`, `BACKUP_LOG_PATH=/var/log/backup.log`
- **VM_HOST**, **VM_USER**, **VM_SSH_KEY**, **VM_PROJECT_PATH** (e.g. `/root/apps`)
- **REGISTRY_USERNAME**, **REGISTRY_PASSWORD** (for ghcr.io)

## First time on a new VM

1. Create the directory (e.g. `mkdir -p /root/apps`).
2. Create `certbot/conf`, `certbot/www` and get SSL certs (e.g. with `renew_ssl.sh`).
3. Put a `.env` on the VM once (or rely on ENV_FILE from the first deploy).
4. Push to `main`; the workflow will copy `docker-compose.prod.yml`, `nginx.conf`, `website/` and run compose.

Your backup script and VPN stay where they are and are not modified by the deploy.
