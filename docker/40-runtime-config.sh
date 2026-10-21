#!/bin/sh
# Per-deployment settings for the portal, read by the app at start-up (assets/config.json).
#   PORTAL_COMPANY_CODE   courier company whose customers sign in here (blank shows a Company code field)
#   PORTAL_COMPANY_NAME   brand shown in the app (default OCCPL SOFTECH)
#   PORTAL_SUPPORT_EMAIL  shown on the sign-in page
set -eu
json_escape() { printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'; }
cat > /usr/share/nginx/html/assets/config.json <<JSON
{
  "companyCode": "$(json_escape "${PORTAL_COMPANY_CODE:-}")",
  "companyName": "$(json_escape "${PORTAL_COMPANY_NAME:-OCCPL SOFTECH}")",
  "supportEmail": "$(json_escape "${PORTAL_SUPPORT_EMAIL:-}")"
}
JSON
