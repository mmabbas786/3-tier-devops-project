#!/usr/bin/env bash
# ==============================================================================
# Helper Script to Port-Forward all Services in devops-project Namespace
# ==============================================================================

NAMESPACE="devops-project"

echo "=========================================================="
echo "🔌 Starting Kubernetes Port-Forwards (${NAMESPACE})"
echo "=========================================================="

PIDS=()

cleanup() {
    echo ""
    echo "🛑 Terminating port-forward processes..."
    for pid in "${PIDS[@]}"; do
        kill "$pid" 2>/dev/null || true
    done
    echo "Done."
    exit 0
}

trap cleanup SIGINT SIGTERM EXIT

# Start port-forwards in background
kubectl port-forward -n "${NAMESPACE}" svc/client-svc 3000:80 > /dev/null 2>&1 &
PIDS+=($!)
echo "  [✓] Frontend Client:  http://localhost:3000"

kubectl port-forward -n "${NAMESPACE}" svc/api-svc 5000:5000 > /dev/null 2>&1 &
PIDS+=($!)
echo "  [✓] REST API:         http://localhost:5000 (Health: /health, Metrics: /metrics)"

kubectl port-forward -n "${NAMESPACE}" svc/grafana-svc 3001:3000 > /dev/null 2>&1 &
PIDS+=($!)
echo "  [✓] Grafana:          http://localhost:3001 (User: admin, Pass: admin)"

kubectl port-forward -n "${NAMESPACE}" svc/prometheus-svc 9090:9090 > /dev/null 2>&1 &
PIDS+=($!)
echo "  [✓] Prometheus:       http://localhost:9090 (Alerts: /alerts, Targets: /targets)"

kubectl port-forward -n "${NAMESPACE}" svc/alertmanager-svc 9093:9093 > /dev/null 2>&1 &
PIDS+=($!)
echo "  [✓] Alertmanager:     http://localhost:9093 (#/alerts)"

echo "=========================================================="
echo "All tunnels active. Press CTRL+C to stop all port-forwards."
echo "=========================================================="

# Keep alive
wait
