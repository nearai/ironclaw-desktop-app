#!/usr/bin/env bash
#
# Build the standalone ironclaw-reborn sidecar for every macOS target used by
# the desktop release. The legacy ironclaw release tarballs do not currently
# publish ironclaw-reborn; until nearai/ironclaw#3483 is resolved, release CI
# builds this one sidecar from a checked-out IronClaw source tree.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

IRONCLAW_REPO_DIR="${IRONCLAW_REPO_DIR:-${REPO_ROOT}/.deps/ironclaw}"
OUTPUT_DIR="${IRONCLAW_REBORN_OUTPUT_DIR:-${REPO_ROOT}/src-tauri/binaries}"
FEATURES="${IRONCLAW_REBORN_FEATURES:-webui-v2-beta,slack-v2-host-beta,root-llm-provider}"
PACKAGE="${IRONCLAW_REBORN_PACKAGE:-ironclaw_reborn_cli}"
BIN="${IRONCLAW_REBORN_BIN:-ironclaw-reborn}"
TARGETS="${IRONCLAW_REBORN_TARGETS:-aarch64-apple-darwin x86_64-apple-darwin}"

usage() {
  cat <<'EOF'
Usage: bash scripts/build-reborn-sidecars.sh [options]

Builds ironclaw-reborn sidecar binaries from an IronClaw checkout.

Options:
  --repo <dir>       IronClaw source checkout (default: $IRONCLAW_REPO_DIR or .deps/ironclaw)
  --output <dir>     Destination for Tauri externalBin files (default: src-tauri/binaries)
  --targets <list>   Space-separated Rust targets (default: both macOS release targets)
  --features <list>  Cargo features for ironclaw_reborn_cli (default: webui-v2-beta,slack-v2-host-beta,root-llm-provider)
  --help             Show this help
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo)
      IRONCLAW_REPO_DIR="${2:?--repo requires a directory}"
      shift 2
      ;;
    --output)
      OUTPUT_DIR="${2:?--output requires a directory}"
      shift 2
      ;;
    --targets)
      TARGETS="${2:?--targets requires a space-separated list}"
      shift 2
      ;;
    --features)
      FEATURES="${2:?--features requires a feature list}"
      shift 2
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "[ironclaw] unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

IRONCLAW_REPO_DIR="$(cd "${IRONCLAW_REPO_DIR}" 2>/dev/null && pwd || true)"
if [[ -z "${IRONCLAW_REPO_DIR}" || ! -f "${IRONCLAW_REPO_DIR}/Cargo.toml" ]]; then
  echo "[ironclaw] IronClaw checkout not found. Set IRONCLAW_REPO_DIR or pass --repo." >&2
  exit 1
fi

mkdir -p "${OUTPUT_DIR}"

for target in ${TARGETS}; do
  echo "[ironclaw] building ${BIN} for ${target} from ${IRONCLAW_REPO_DIR}"
  rustup target add "${target}" >/dev/null
  cargo build \
    --manifest-path "${IRONCLAW_REPO_DIR}/Cargo.toml" \
    --release \
    --target "${target}" \
    -p "${PACKAGE}" \
    --features "${FEATURES}" \
    --bin "${BIN}"

  source_bin="${IRONCLAW_REPO_DIR}/target/${target}/release/${BIN}"
  dest_bin="${OUTPUT_DIR}/${BIN}-${target}"
  if [[ ! -x "${source_bin}" ]]; then
    echo "[ironclaw] built binary missing or not executable: ${source_bin}" >&2
    exit 1
  fi
  cp "${source_bin}" "${dest_bin}"
  chmod +x "${dest_bin}"
  lipo -archs "${dest_bin}" >/dev/null
  echo "[ironclaw] staged ${dest_bin}"
done
