#!/usr/bin/env bash
#
# Manage IronClaw scheduled routines (automations) on the server.
#
# IronClaw v0.29 has NO gateway endpoint to CREATE routines (the desktop
# app's Routines screen is read/list only — POST /api/routines → 405). The
# only create path is the server CLI: `ironclaw routines create`. This
# wrapper runs that CLI over SSH so you don't have to remember the binary
# path + sudo dance.
#
# Routines are scoped PER USER. One created under the server's default CLI
# account will fire on schedule but won't appear in the desktop app if the
# app connects as a different account. List/manage from here either way.
#
# Usage:
#   scripts/ironclaw-routine.sh list
#   scripts/ironclaw-routine.sh create --name daily-digest \
#       --schedule '0 0 9 * * *' --prompt 'Summarize today'
#   scripts/ironclaw-routine.sh disable <id|name>
#   scripts/ironclaw-routine.sh enable  <id|name>
#   scripts/ironclaw-routine.sh delete  <id|name>
#
# Schedule is a 6-field cron: <sec> <min> <hour> <dom> <mon> <dow>.
#   '0 0 9 * * *'   = every day at 09:00:00
#   '0 */30 * * * *'= every 30 minutes
#
# `delete` prompts for confirmation; pass `-y` to skip it
# (e.g. `delete <name> -y`) since this wrapper has no interactive TTY.
#
# Env:
#   IRONCLAW_SSH_ALIAS   SSH host alias (default: abby)
#   IRONCLAW_BIN         server binary (default: auto-detected from systemd)

set -euo pipefail

SSH_ALIAS="${IRONCLAW_SSH_ALIAS:-abby}"

if [[ $# -lt 1 ]]; then
  sed -n '2,40p' "$0"
  exit 2
fi

# Resolve the binary from the running unit so version bumps don't break us.
REMOTE_BIN="${IRONCLAW_BIN:-}"
resolve_bin='BIN="'"${REMOTE_BIN}"'"; if [ -z "$BIN" ]; then BIN=$(systemctl show ironclaw -p ExecStart 2>/dev/null | grep -oE "/opt/ironclaw[^ ;]*ironclaw[^ ;]*" | head -1); fi; [ -n "$BIN" ] || { echo "could not resolve ironclaw binary" >&2; exit 3; }'

# Forward all args to `ironclaw routines <args>` as the openclaw user.
# Args are passed through SSH as a single quoted string; callers must quote
# their own --prompt / --schedule values (as in the examples above).
printf -v ARGS '%q ' "$@"

# shellcheck disable=SC2029
ssh -o ConnectTimeout=15 "${SSH_ALIAS}" "${resolve_bin}; sudo -u openclaw \"\$BIN\" routines ${ARGS}"
