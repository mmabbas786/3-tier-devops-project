#!/usr/bin/env bash
# ==============================================================================
# 3-Tier DevOps Application - Kubernetes & Monitoring Deployment Script
# ==============================================================================
set -e

NAMESPACE="devops-project"
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "=========================================================="
echo "🚀 Deploying 3-Tier DevOps Stack & Observability to K8s"
echo "Namespace: ${NAMESPACE}"
echo "Root Path: ${PROJECT_ROOT}"
echo "=========================================================="

# 1. Verify Prerequisites
if ! command -v kubectl &> /dev/null; then
    echo "❌ Error: kubectl is not installed or not in PATH."
    exit 1
fi

# 2. Check Kubernetes Cluster Connectivity
echo "🔍 Checking cluster connectivity..."
if ! kubectl cluster-info &> /dev/null; then
    echo "⚠️ Kubernetes cluster is not currently reachable."
    if command -v minikube &> /dev/null; then
        echo "💡 Minikube detected! You can start minikube with:"
        echo "   minikube start --driver=docker"
        echo "   minikube addons enable ingress"
        echo "   minikube addons enable metrics-server"
    fi
    echo "Please ensure your cluster (Minikube / EKS / GKE / AKS / K3s) is running and configured in ~/.kube/config."
    exit 1
fi

CURRENT_CONTEXT=$(kubectl config current-context 2>/dev/null || echo "default")
echo "✅ Connected to Kubernetes context: ${CURRENT_CONTEXT}"

# 3. Apply K8s Manifests using Kustomize
echo "📦 Applying declarative manifests (Database, API, Client, Ingress, Prometheus, Alertmanager, Grafana)..."
kubectl apply -k "${PROJECT_ROOT}/k8s/"

# 4. Wait for Rollouts
echo "⏳ Waiting for deployments in namespace '${NAMESPACE}' to become ready..."
DEPLOYMENTS=("mysql" "api" "client" "alertmanager" "prometheus" "grafana")

for dep in "${DEPLOYMENTS[@]}"; do
    echo "   Checking deployment: ${dep}..."
    kubectl rollout status deployment/"${dep}" -n "${NAMESPACE}" --timeout=180s || {
        echo "⚠️ Warning: Deployment ${dep} took longer than 180s to become ready. Checking pods..."
        kubectl get pods -l app="${dep}" -n "${NAMESPACE}"
    }
done

echo ""
echo "=========================================================="
echo "🎉 Deployment Summary"
echo "=========================================================="
kubectl get all -n "${NAMESPACE}"
echo ""
kubectl get ingress -n "${NAMESPACE}" 2>/dev/null || true

echo ""
echo "=========================================================="
echo "🌐 Access Instructions"
echo "=========================================================="
echo "To expose services locally via port-forwarding, run:"
echo "   ./scripts/k8s-port-forward.sh"
echo ""
echo "Or forward services individually:"
echo "   React Frontend:   kubectl port-forward -n ${NAMESPACE} svc/client-svc 3000:80"
echo "   Node.js API:      kubectl port-forward -n ${NAMESPACE} svc/api-svc 5000:5000"
echo "   Grafana:          kubectl port-forward -n ${NAMESPACE} svc/grafana-svc 3001:3000   (admin / admin)"
echo "   Prometheus:       kubectl port-forward -n ${NAMESPACE} svc/prometheus-svc 9090:9090"
echo "   Alertmanager:     kubectl port-forward -n ${NAMESPACE} svc/alertmanager-svc 9093:9093"
echo "=========================================================="
