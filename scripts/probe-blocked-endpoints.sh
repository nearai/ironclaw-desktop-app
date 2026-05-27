#!/usr/bin/env bash
#
# Probe the live IronClaw gateway for endpoints we know are currently blocked
# (return 404/405 today). When any of them start responding successfully, the
# gateway has shipped support and we should rush to wire UI for it.
#
# This is a discovery tool, NOT a CI gate. Always exits 0.
#
# Requirements:
#   - SSH config alias `ironclaw-nearai` reachable
#   - `pgrep`, `curl`, `awk`, `tr` available on the remote host
#   - The IronClaw process exposes IRONCLAW_GATEWAY_TOKEN in its environment
#
# Usage:
#   bash scripts/probe-blocked-endpoints.sh

set -uo pipefail

SSH_ALIAS="${IRONCLAW_SSH_ALIAS:-ironclaw-nearai}"
GATEWAY_URL="${IRONCLAW_GATEWAY_URL:-http://127.0.0.1:18789}"

# Colors (disabled when stdout is not a tty)
if [[ -t 1 ]]; then
  RED=$'\033[31m'
  GREEN=$'\033[32m'
  YELLOW=$'\033[33m'
  DIM=$'\033[2m'
  BOLD=$'\033[1m'
  RESET=$'\033[0m'
else
  RED="" GREEN="" YELLOW="" DIM="" BOLD="" RESET=""
fi

echo "${BOLD}IronClaw blocked-endpoint probe${RESET}"
echo "${DIM}Target: ${SSH_ALIAS} -> ${GATEWAY_URL}${RESET}"
echo

# Resolve the gateway token from the live process env. The IronClaw PID may
# vary across restarts, so we discover it with pgrep -af and read /proc/<pid>/environ.
echo "${DIM}Resolving gateway token from live IronClaw process...${RESET}"
TOKEN="$(ssh -o BatchMode=yes -o ConnectTimeout=10 "${SSH_ALIAS}" '
  set -eo pipefail
  PID="$(pgrep -af "ironclaw" | grep -v "pgrep\|probe-blocked" | awk "NR==1 {print \$1}")"
  if [ -z "$PID" ]; then
    echo "ERR_NO_PID" >&2
    exit 2
  fi
  # /proc/<pid>/environ is NUL-separated; extract the token line.
  sudo tr "\0" "\n" < "/proc/${PID}/environ" 2>/dev/null \
    | awk -F= "/^IRONCLAW_GATEWAY_TOKEN=/ {print substr(\$0, index(\$0, \"=\")+1); exit}"
' 2>/tmp/probe-token-err.$$)"

TOKEN_ERR="$(cat /tmp/probe-token-err.$$ 2>/dev/null || true)"
rm -f /tmp/probe-token-err.$$

if [[ -z "${TOKEN}" ]]; then
  echo "${RED}ERROR${RESET} Could not resolve IRONCLAW_GATEWAY_TOKEN."
  if [[ -n "${TOKEN_ERR}" ]]; then
    echo "${DIM}ssh stderr: ${TOKEN_ERR}${RESET}"
  fi
  echo "${DIM}Check: ssh ${SSH_ALIAS} 'pgrep -af ironclaw'${RESET}"
  exit 0
fi

echo "${DIM}Token resolved (length ${#TOKEN}).${RESET}"
echo

# Build the probe table: name|method|path|body|expected_blocked_code
# expected_blocked_code is the HTTP status that means "still blocked, no change".
# Anything in the 2xx range = the gateway started serving it (yellow warning).
PROBES=(
  "thread_delete|DELETE|/api/chat/threads/_probe_id||404"
  "routine_create|POST|/api/routines|{\"name\":\"_probe\",\"schedule\":\"never\",\"prompt\":\"\"}|405"
  "memory_delete_query|DELETE|/api/memory?path=_probe||404"
  "memory_delete_post|POST|/api/memory/delete|{\"path\":\"_probe\"}|404"
  "auth_signout|POST|/api/auth/signout||404"
  "routines_recent_runs|GET|/api/routines/recent-runs||404"
)

# Each probe runs over SSH so the gateway sees a loopback request from the host.
# We capture only the HTTP status code (curl -o /dev/null -w "%{http_code}").
probe_one() {
  local method="$1" path="$2" body="$3"
  local args=(
    -sS -o /dev/null -w "%{http_code}"
    --max-time 8
    -X "${method}"
    -H "Authorization: Bearer ${TOKEN}"
  )
  if [[ -n "${body}" ]]; then
    args+=(-H "Content-Type: application/json" --data "${body}")
  fi
  args+=("${GATEWAY_URL}${path}")

  # shellcheck disable=SC2029
  ssh -o BatchMode=yes -o ConnectTimeout=10 "${SSH_ALIAS}" \
    "curl $(printf '%q ' "${args[@]}")" 2>/dev/null || echo "ERR"
}

# Render the result row.
render_row() {
  local name="$1" method="$2" path="$3" expected="$4" actual="$5"
  local marker color note

  if [[ "${actual}" == "ERR" || -z "${actual}" ]]; then
    marker="X"; color="${RED}"; note="probe failed (network / ssh)"
  elif [[ "${actual}" == "${expected}" ]]; then
    marker="OK"; color="${GREEN}"; note="still blocked (no change)"
  elif [[ "${actual}" =~ ^2 ]]; then
    marker="!!"; color="${YELLOW}"; note="now responding (wire UI!)"
  elif [[ "${actual}" == "401" || "${actual}" == "403" ]]; then
    marker="!!"; color="${YELLOW}"; note="auth-gated now (wire UI / re-auth)"
  elif [[ "${actual}" == "400" || "${actual}" == "422" ]]; then
    marker="!!"; color="${YELLOW}"; note="validation-rejected (route exists, wire UI)"
  else
    marker="X"; color="${RED}"; note="unexpected status"
  fi

  printf "  %s%-3s%s  %-22s %-6s %-32s expected=%-3s got=%-3s  %s%s%s\n" \
    "${color}" "${marker}" "${RESET}" \
    "${name}" "${method}" "${path}" \
    "${expected}" "${actual}" \
    "${DIM}" "${note}" "${RESET}"
}

echo "${BOLD}Probes:${RESET}"
echo

HITS=0
for entry in "${PROBES[@]}"; do
  IFS='|' read -r name method path body expected <<< "${entry}"
  actual="$(probe_one "${method}" "${path}" "${body}")"
  render_row "${name}" "${method}" "${path}" "${expected}" "${actual}"
  if [[ "${actual}" != "${expected}" && "${actual}" != "ERR" && -n "${actual}" ]]; then
    HITS=$((HITS + 1))
  fi
done

echo
if [[ "${HITS}" -gt 0 ]]; then
  echo "${YELLOW}${BOLD}!! ${HITS} endpoint(s) changed behavior.${RESET} Time to wire UI."
else
  echo "${GREEN}OK All endpoints still blocked.${RESET} No client work needed yet."
fi
echo "${DIM}(Discovery tool only; always exits 0.)${RESET}"

exit 0
