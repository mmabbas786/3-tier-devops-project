#!/usr/bin/env bash
# ==============================================================================
# Observability & Alerting Testing Tool
# ==============================================================================

ALERTMANAGER_HOST="${ALERTMANAGER_HOST:-localhost:9093}"
PROMETHEUS_HOST="${PROMETHEUS_HOST:-localhost:9090}"
LIVE_API_URL="${LIVE_API_URL:-https://3-tier-devops-project-production.up.railway.app}"

echo "=========================================================="
echo "🔔 Alertmanager & Prometheus Alert Verification Tool"
echo "Alertmanager: http://${ALERTMANAGER_HOST}"
echo "Prometheus:   http://${PROMETHEUS_HOST}"
echo "Live API:     ${LIVE_API_URL}"
echo "=========================================================="

echo ""
echo "1. Checking Alertmanager Status..."
if curl -s -f "http://${ALERTMANAGER_HOST}/-/ready" > /dev/null; then
    echo "   ✅ Alertmanager is reachable and ready!"
else
    echo "   ⚠️ Alertmanager not responding on http://${ALERTMANAGER_HOST}."
    echo "   Make sure Docker Compose (port 9093) or K8s port-forward is running."
fi

echo ""
echo "2. Checking Active Prometheus Alert Rules..."
if curl -s -f "http://${PROMETHEUS_HOST}/api/v1/rules" > /dev/null; then
    echo "   ✅ Prometheus rules API reachable. Configured alert rules:"
    curl -s "http://${PROMETHEUS_HOST}/api/v1/rules" | grep -o '"name":"[^"]*"' | head -n 10
else
    echo "   ⚠️ Prometheus not responding on http://${PROMETHEUS_HOST}."
fi

echo ""
echo "3. Testing Live Railway Production API Target..."
LIVE_HEALTH=$(curl -s "${LIVE_API_URL}/health" || echo "FAILED")
echo "   Live Health Check: ${LIVE_HEALTH}"

echo ""
echo "4. Injecting a Test Alert directly into Alertmanager..."
TEST_PAYLOAD='[
  {
    "labels": {
      "alertname": "TestSyntheticAlert",
      "severity": "warning",
      "service": "devops-api-test",
      "instance": "test-runner"
    },
    "annotations": {
      "summary": "Synthetic Verification Alert for DevOps Pipeline",
      "description": "This is a verified test alert sent to validate Alertmanager routing and receiver delivery."
    },
    "generatorURL": "http://localhost:9090/graph"
  }
]'

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "http://${ALERTMANAGER_HOST}/api/v2/alerts" \
  -H "Content-Type: application/json" \
  -d "${TEST_PAYLOAD}")

HTTP_CODE=$(echo "${RESPONSE}" | tail -n 1)

if [ "${HTTP_CODE}" == "200" ]; then
    echo "   🎉 Successfully fired test alert to Alertmanager (HTTP 200)!"
    echo "   View alert in UI: http://${ALERTMANAGER_HOST}/#/alerts"
else
    echo "   Note: Alert injection returned HTTP ${HTTP_CODE} (Alertmanager may not be currently running on port 9093)."
fi

echo ""
echo "=========================================================="
echo "Verification complete."
echo "=========================================================="
