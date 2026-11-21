#!/usr/bin/env bash
# Checks a running stack from the outside: the API is ready, the seeded account
# can sign in, the sample invoices are listed, and the frontend is served.
# Reads ports and credentials from .env in the repository root.
set -euo pipefail

cd "$(dirname "$0")/../.."
set -a
# shellcheck disable=SC1091
. ./.env
set +a

api="http://localhost:${BACKEND_PORT}"
frontend="http://localhost:${FRONTEND_PORT}"

echo "API readiness"
curl --fail --silent --show-error "${api}/ready" > /dev/null

echo "Sign in as the seeded account"
login_body=$(printf '{"email":"%s","password":"%s"}' "${SEED_USER_EMAIL}" "${SEED_USER_PASSWORD}")
token=$(curl --fail --silent --show-error \
  --request POST "${api}/auth/login" \
  --header 'Content-Type: application/json' \
  --data "${login_body}" |
  node --eval 'process.stdin.on("data", (body) => console.log(JSON.parse(body).accessToken))')

echo "List the seeded invoices"
total=$(curl --fail --silent --show-error \
  "${api}/invoices?pageSize=1" \
  --header "Authorization: Bearer ${token}" |
  node --eval 'process.stdin.on("data", (body) => console.log(JSON.parse(body).paging.total))')
if [ "${total}" -lt 41 ]; then
  echo "Expected at least 41 seeded invoices, found ${total}" >&2
  exit 1
fi

echo "Invoices need a token"
status=$(curl --silent --output /dev/null --write-out '%{http_code}' "${api}/invoices")
if [ "${status}" != "401" ]; then
  echo "Expected 401 without a token, got ${status}" >&2
  exit 1
fi

echo "API documentation"
curl --fail --silent --show-error "${api}/api/docs-json" > /dev/null

echo "Frontend, including a deep link"
curl --fail --silent --show-error "${frontend}/" | grep --quiet '<div id="root">'
curl --fail --silent --show-error "${frontend}/invoices/new" > /dev/null

echo "Smoke test passed: ${total} invoices"
