# Kubernetes (K8s) & Full-Stack Observability Guide

Comprehensive guide for deploying, operating, and monitoring the **3-Tier DevOps Application** and its **Live Production Environment** using **Kubernetes**, **Prometheus**, **Alertmanager**, and **Grafana**.

---

## 1. System Architecture

```
                                  +---------------------------------------+
                                  |        Live Railway Production        |
                                  |  https://3-tier-devops-project-       |
                                  |       production.up.railway.app       |
                                  |      (/health, /metrics, /api)        |
                                  +-------------------+-------------------+
                                                      |
                                                      | HTTPS Scrape (5s)
                                                      v
+-----------------------------------------------------------------------------------------+
|                               Kubernetes Cluster (devops-project)                       |
|                                                                                         |
|   +------------------------------------+        +-----------------------------------+   |
|   |         Ingress Controller         |        |            Prometheus             |   |
|   |          (devops-ingress)          |        |        (prometheus-svc:9090)      |   |
|   +-----------------+------------------+        +---------+---------------+---------+   |
|                     |                                     |               |             |
|          +----------+----------+                          | Scrapes       | Fires       |
|          |                     |                          | Cluster       | Alerts      |
|          v                     v                          v               v             |
|   +--------------+      +--------------+        +--------------+   +----------------+   |
|   |  client-svc  |      |   api-svc    |        |  mysql:3306  |   |  Alertmanager  |   |
|   |   (React)    |      |  (Node.js)   |        |  (Stateful/  |   | (alertmanager- |   |
|   |   (Port 80)  |      | (Port 5000)  |        |  Persistent) |   |    svc:9093)   |   |
|   +--------------+      +-------+------+        +--------------+   +--------+-------+   |
|                                 |                                           |           |
|                                 +-----------------------+                   | Notifies  |
|                                                         v                   v           |
|                                              +---------------------+   +------------+   |
|                                              |       Grafana       |   | Webhook /  |   |
|                                              |  (grafana-svc:3000) |   | Slack /    |   |
|                                              +---------------------+   | Discord    |   |
+-----------------------------------------------------------------------------------------+
```

---

## 2. Directory Structure

```
├── k8s/
│   ├── namespace.yaml                  # devops-project namespace
│   ├── mysql.yaml                      # MySQL deployment, PVC, service, secrets
│   ├── api.yaml                        # Node.js API deployment, HPA, service, config
│   ├── client.yaml                     # React frontend deployment & service
│   ├── ingress.yaml                    # Nginx Ingress routing (/ -> client, /api -> api)
│   ├── kustomization.yaml              # Master Kustomize manifest
│   └── monitoring/
│       ├── alertmanager.yaml           # Alertmanager deployment, config & service
│       ├── prometheus.yaml             # Prometheus deployment, RBAC, rules & service
│       ├── grafana.yaml                # Grafana deployment, datasources & service
│       ├── dashboard.yaml              # Pre-provisioned 3-tier DevOps dashboard
│       └── kustomization.yaml          # Monitoring sub-bundle
├── monitoring/                         # Docker Compose / local configs
│   ├── alertmanager/
│   │   └── alertmanager.yml            # Alertmanager routing & receivers
│   ├── prometheus/
│   │   ├── prometheus.yml              # Prometheus scrape targets (Live + Local)
│   │   └── alert_rules.yml             # Prometheus alert definitions
│   └── grafana/
│       ├── provisioning/               # Auto-provisioned datasources and dashboards
│       └── dashboards/
│           └── devops-api-dashboard.json # JSON telemetry dashboard
└── scripts/
    ├── k8s-deploy.sh                   # One-command k8s deployment automation
    ├── k8s-port-forward.sh             # Exposes all cluster services locally
    └── test-alerts.sh                  # Synthetic alert injection and verification
```

---

## 3. Quickstart: Deploying to Kubernetes

### Prerequisites
- `kubectl` installed
- Access to a Kubernetes cluster:
  - **Minikube**: `minikube start --driver=docker && minikube addons enable ingress`
  - **Kind**: `kind create cluster`
  - **Cloud Providers**: AWS EKS, Google GKE, DigitalOcean K8s, or Azure AKS

### Step 1: Run the Automated Deployment Script
```bash
./scripts/k8s-deploy.sh
```

Or deploy manually via Kustomize:
```bash
kubectl apply -k k8s/
```

### Step 2: Verify Resources
```bash
kubectl get pods -n devops-project
kubectl get svc -n devops-project
kubectl get ingress -n devops-project
```

### Step 3: Access Services Locally
Run the port-forwarding helper script:
```bash
./scripts/k8s-port-forward.sh
```

| Service | Local URL | Default Credentials |
|---|---|---|
| **React Frontend** | `http://localhost:3000` | — |
| **REST API** | `http://localhost:5000` | Bearer JWT |
| **Grafana** | `http://localhost:3001` | `admin` / `admin` |
| **Prometheus** | `http://localhost:9090` | — |
| **Alertmanager** | `http://localhost:9093` | — |

---

## 4. Observability & Live Telemetry

### Dual-Scrape Targets
Prometheus is configured to collect telemetry from both the live cloud environment and the Kubernetes cluster simultaneously:
1. **Live Production API**:
   - URL: `https://3-tier-devops-project-production.up.railway.app/metrics`
   - Job Name: `devops-api-live`
   - Scrape Interval: `5s`
2. **In-Cluster Backend API**:
   - URL: `http://api-svc.devops-project.svc.cluster.local:5000/metrics`
   - Job Name: `devops-api`
   - Scrape Interval: `5s`
3. **Cluster Pods & Nodes**:
   - Auto-discovered via Kubernetes Pod annotations (`prometheus.io/scrape: "true"`)

---

## 5. Alert Rules & Alertmanager Routing

### Configured Alert Rules (`alert_rules.yml`)

| Alert Name | Condition | Severity | Description |
|---|---|---|---|
| `LiveApiDown` | `up{job="devops-api-live"} == 0` for 1m | `critical` | Railway production API is unreachable |
| `InternalApiDown` | `up{job="devops-api"} == 0` for 1m | `critical` | In-cluster / Docker backend API is down |
| `HighHttp5xxErrorRate` | Rate of 5xx responses > 5% for 2m | `warning` | Elevated server error rate |
| `HighHttpLatencyP95` | P95 request latency > 1000ms for 2m | `warning` | 95% of requests take more than 1 second |
| `HighMemoryUsage` | Resident memory > 500MB for 5m | `warning` | Process memory threshold exceeded |
| `HighCpuUsage` | CPU rate > 80% for 3m | `warning` | Process CPU capacity saturation |

### Configuring Notification Channels

Alertmanager supports Webhooks, Slack, Discord, PagerDuty, and Email.

#### Setting up Slack Notifications
In `monitoring/alertmanager/alertmanager.yml` (or `k8s/monitoring/alertmanager.yaml` ConfigMap):
```yaml
global:
  slack_api_url: 'https://hooks.slack.com/services/YOUR/WEBHOOK/URL'

receivers:
  - name: 'critical-alerts'
    slack_configs:
      - channel: '#devops-alerts'
        send_resolved: true
        icon_emoji: ':fire:'
        title: '🚨 [CRITICAL] {{ .GroupLabels.alertname }}'
        text: >-
          {{ range .Alerts }}
            *Summary:* {{ .Annotations.summary }}
            *Description:* {{ .Annotations.description }}
          {{ end }}
```

---

## 6. Testing & Verifying Alerts

Run the alert verification tool:
```bash
./scripts/test-alerts.sh
```

This utility:
1. Tests Alertmanager readiness (`/-/ready`).
2. Checks Prometheus alert rule states.
3. Tests live Railway health status.
4. Directly injects a synthetic alert (`TestSyntheticAlert`) into Alertmanager to verify end-to-end notification routing.

To view fired alerts in the Alertmanager UI:
- Open `http://localhost:9093/#/alerts`
