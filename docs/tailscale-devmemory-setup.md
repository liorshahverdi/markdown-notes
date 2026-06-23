# Tailscale + DevMemoryIndex Setup for Markdown Notes

This guide starts after Phase 0. The code changes are already committed and pushed:

- `markdown-notes`: Docker Compose support for running the Markdown Notes web/API server.
- `devmemoryindex`: remote `markdown-notes-api` connector.

Goal:

- Run Markdown Notes on the other laptop.
- Reach it privately from the DevMemoryIndex machine over Tailscale.
- Sync notes into DevMemoryIndex with a read-only Markdown Notes API token.

> Do not paste API tokens into shared chats or committed files. Store secrets only in local env files with `chmod 600`.

## Phase 1 — Install Tailscale on both computers

Install Tailscale on:

1. The DevMemoryIndex machine.
2. The other laptop that will run Markdown Notes.

### 1.1 DevMemoryIndex machine: Linux

```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
```

Log in with your Tailscale account using the browser/login URL.

Verify:

```bash
tailscale status
tailscale ip -4
```

Save the Tailscale IP if needed. It will look like `100.x.y.z`.

### 1.2 Other laptop

If macOS or Windows, install from:

```text
https://tailscale.com/download
```

Then open Tailscale and sign in with the same account.

If Linux:

```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
```

Verify on the other laptop:

```bash
tailscale status
tailscale ip -4
```

## Phase 2 — Confirm both machines can see each other

On each machine:

```bash
tailscale status
```

You should see both devices listed.

From the DevMemoryIndex machine, ping the other laptop by MagicDNS name if available:

```bash
ping OTHER_LAPTOP_MACHINE_NAME
```

If MagicDNS is not working yet, use the other laptop's Tailscale IP instead.

Example target URL forms:

```text
http://100.x.y.z:5173
http://OTHER_LAPTOP_MACHINE_NAME:5173
http://OTHER_LAPTOP_MACHINE_NAME.YOUR_TAILNET.ts.net:5173
```

For initial setup, the raw Tailscale IP is fine.

## Phase 3 — Run Markdown Notes on the other laptop

On the other laptop, pull the pushed Docker changes.

```bash
cd ~/projects/markdown-notes
git pull
```

If the clone lives somewhere else, adjust the path.

Start the app:

```bash
docker compose up -d --build
```

Check status:

```bash
docker compose ps
```

Expected result:

```text
markdown-notes   Up ... healthy
```

Local smoke test on the other laptop:

```bash
curl -i http://127.0.0.1:5173/api/notes
```

Expected unauthenticated response:

```text
HTTP/1.1 401 Unauthorized
{"error":"Unauthorized"}
```

That means the app/API is running.

## Phase 4 — Verify Tailscale access from DevMemoryIndex machine

From the DevMemoryIndex machine, replace `OTHER_LAPTOP_TAILSCALE_IP` with the other laptop's `tailscale ip -4` value:

```bash
curl -i http://OTHER_LAPTOP_TAILSCALE_IP:5173/api/notes
```

Or use MagicDNS if it works:

```bash
curl -i http://OTHER_LAPTOP_MACHINE_NAME:5173/api/notes
```

Expected response:

```text
HTTP/1.1 401 Unauthorized
{"error":"Unauthorized"}
```

If this works, the private Tailscale network path is ready.

## Phase 5 — Choose exposure mode

### Option A — Simple mode

Leave `docker-compose.yml` as-is:

```yaml
ports:
  - "5173:5173"
```

Use the Tailscale URL from DevMemoryIndex:

```text
http://OTHER_LAPTOP_TAILSCALE_IP:5173
```

This is easiest. It may also expose port `5173` on the other laptop's LAN interface depending on the host firewall/network.

### Option B — Bind Docker only to the Tailscale IP on a Linux host

Use this if the other laptop is Linux and you want Docker to listen only on Tailscale.

On the other laptop:

```bash
TAILSCALE_IP="$(tailscale ip -4)"
echo "$TAILSCALE_IP"
```

Create a local override file:

```bash
cd ~/projects/markdown-notes

cat > docker-compose.override.yml <<EOF
services:
  markdown-notes:
    ports:
      - "${TAILSCALE_IP}:5173:5173"
EOF
```

Restart:

```bash
docker compose down
docker compose up -d
```

Test from the DevMemoryIndex machine:

```bash
curl -i http://TAILSCALE_IP_FROM_OTHER_LAPTOP:5173/api/notes
```

Expected:

```text
HTTP/1.1 401 Unauthorized
```

Do not commit `docker-compose.override.yml`; it is machine-specific.

### Option C — Tailscale Serve

Use this if you want Tailscale to privately proxy a local service inside your tailnet. Do not use Tailscale Funnel; Funnel is public internet exposure.

On the other laptop, first confirm Markdown Notes is running locally:

```bash
curl -i http://127.0.0.1:5173/api/notes
```

Then check current Tailscale Serve syntax:

```bash
tailscale serve --help
```

Serve local port `5173` using the syntax shown by your installed Tailscale version. Common forms are shaped like one of these:

```bash
tailscale serve --bg 5173
```

or:

```bash
tailscale serve --bg http://127.0.0.1:5173
```

Then use the private tailnet URL that Tailscale prints.

## Phase 6 — Create a read-only Markdown Notes API token

Create this token on the other laptop's Markdown Notes instance.

Preferred path:

1. Open Markdown Notes in a browser:
   ```text
   http://127.0.0.1:5173
   ```
2. Sign up or log in.
3. Open API token/settings UI if available.
4. Create a token named:
   ```text
   devmemory-readonly
   ```
5. Give it this scope:
   ```text
   notes:read
   ```
6. Copy the token once.

### Curl fallback for token creation

On the other laptop:

```bash
BASE="http://127.0.0.1:5173"
COOKIE="/tmp/markdown-notes-cookie.txt"
```

Log in:

```bash
curl -sS -c "$COOKIE" \
  -H "Content-Type: application/json" \
  -d '{"action":"login","username":"YOUR_USERNAME","password":"YOUR_PASSWORD"}' \
  "$BASE/api/auth"
```

Create the token:

```bash
curl -sS -b "$COOKIE" \
  -H "Content-Type: application/json" \
  -d '{"name":"devmemory-readonly","scopes":["notes:read"],"expiresInDays":3650}' \
  "$BASE/api/tokens"
```

Copy the returned token. Do not commit it.

## Phase 7 — Configure DevMemoryIndex env on the DevMemoryIndex machine

On the DevMemoryIndex machine:

```bash
mkdir -p ~/.config/devmemory
chmod 700 ~/.config/devmemory
nano ~/.config/devmemory/markdown-notes.env
```

Use the other laptop's Tailscale IP or MagicDNS name:

```bash
MARKDOWN_NOTES_URL=http://OTHER_LAPTOP_TAILSCALE_IP:5173
MARKDOWN_NOTES_TOKEN=PASTE_TOKEN_HERE
MARKDOWN_NOTES_REPO=markdown-notes
MARKDOWN_NOTES_TIMEOUT_SECONDS=5
```

Secure it:

```bash
chmod 600 ~/.config/devmemory/markdown-notes.env
```

Manual API verification:

```bash
set -a
source ~/.config/devmemory/markdown-notes.env
set +a

curl -i \
  -H "Authorization: Bearer $MARKDOWN_NOTES_TOKEN" \
  "$MARKDOWN_NOTES_URL/api/notes"
```

Expected authenticated response:

```text
HTTP/1.1 200 OK
```

with JSON containing notes.

## Phase 8 — Run a manual DevMemoryIndex ingest

On the DevMemoryIndex machine:

```bash
cd /home/lior/projects/devmemoryindex
set -a
source ~/.config/devmemory/markdown-notes.env
set +a

. .venv/bin/activate
devmemory ingest --source markdown-notes-api
```

Expected if notes are new:

```text
+N memories
Ingestion complete. N new memories added.
```

If it returns `+0 memories`, check:

- Are there notes in Markdown Notes?
- Did the authenticated curl return `200`?
- Were the notes already indexed?
- Is the other laptop online?

The connector is intentionally safe when offline: it returns `0` and keeps previously indexed memories.

## Phase 9 — Add the env file to the existing DevMemoryIndex user service

The local DevMemoryIndex service on the DevMemoryIndex machine is expected at:

```text
~/.config/systemd/user/devmemory.service
```

Create a systemd user override:

```bash
systemctl --user edit devmemory.service
```

Add:

```ini
[Service]
EnvironmentFile=/home/lior/.config/devmemory/markdown-notes.env
```

Reload and restart:

```bash
systemctl --user daemon-reload
systemctl --user restart devmemory.service
systemctl --user status devmemory.service --no-pager
```

Check logs:

```bash
tail -100 ~/.local/share/devmemory/daemon.log
tail -100 ~/.local/share/devmemory/daemon-error.log
```

## Phase 10 — Add recurring sync

Use either a Hermes cron job or a systemd user timer.

### Option A — Hermes cron

Create a recurring Hermes job that runs every 30 minutes with this command:

```bash
cd /home/lior/projects/devmemoryindex
set -a
source /home/lior/.config/devmemory/markdown-notes.env
set +a
/home/lior/projects/devmemoryindex/.venv/bin/devmemory ingest --source markdown-notes-api
```

Recommended schedule:

```text
every 30m
```

### Option B — systemd user timer

Create the sync script:

```bash
mkdir -p ~/.local/bin

cat > ~/.local/bin/devmemory-sync-markdown-notes.sh <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

cd /home/lior/projects/devmemoryindex

set -a
source /home/lior/.config/devmemory/markdown-notes.env
set +a

/home/lior/projects/devmemoryindex/.venv/bin/devmemory ingest --source markdown-notes-api
EOF

chmod +x ~/.local/bin/devmemory-sync-markdown-notes.sh
```

Create service:

```bash
mkdir -p ~/.config/systemd/user

cat > ~/.config/systemd/user/devmemory-sync-markdown-notes.service <<'EOF'
[Unit]
Description=Sync remote Markdown Notes into DevMemoryIndex

[Service]
Type=oneshot
ExecStart=/home/lior/.local/bin/devmemory-sync-markdown-notes.sh
EOF
```

Create timer:

```bash
cat > ~/.config/systemd/user/devmemory-sync-markdown-notes.timer <<'EOF'
[Unit]
Description=Run Markdown Notes to DevMemoryIndex sync periodically

[Timer]
OnBootSec=2m
OnUnitActiveSec=30m
Persistent=true

[Install]
WantedBy=timers.target
EOF
```

Enable:

```bash
systemctl --user daemon-reload
systemctl --user enable --now devmemory-sync-markdown-notes.timer
systemctl --user list-timers --all | grep markdown-notes
```

Manual test:

```bash
systemctl --user start devmemory-sync-markdown-notes.service
journalctl --user -u devmemory-sync-markdown-notes.service -n 100 --no-pager
```

## Phase 11 — Verify search/context works

After a successful sync, search for a phrase from a note:

```bash
cd /home/lior/projects/devmemoryindex
. .venv/bin/activate

devmemory search "some exact phrase from one of your notes"
```

Or build context:

```bash
devmemory context "what did I decide about X?"
```

If Hermes MCP does not immediately see newly indexed content, restart the DevMemoryIndex service:

```bash
systemctl --user restart devmemory.service
```

Then restart the Hermes gateway/session if needed.

## Quick checklist

- [ ] Tailscale installed on both machines.
- [ ] Both machines visible in `tailscale status`.
- [ ] Markdown Notes pulled on other laptop.
- [ ] `docker compose up -d --build` works on other laptop.
- [ ] DevMemoryIndex machine gets `401` from `http://OTHER_LAPTOP_TAILSCALE_IP:5173/api/notes`.
- [ ] Read-only `notes:read` token created.
- [ ] `~/.config/devmemory/markdown-notes.env` created and `chmod 600`.
- [ ] Authenticated curl returns `200 OK`.
- [ ] `devmemory ingest --source markdown-notes-api` succeeds.
- [ ] Recurring sync configured.
- [ ] Search finds note content in DevMemoryIndex.
