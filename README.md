# Crypto Market Analysis Platform

A comprehensive multi-service application for cryptocurrency market analysis, featuring real-time data collection, OHLCV analysis, sentiment analysis, and ML-based price predictions.

**Live Frontend**: https://cryptofrontend.z38.web.core.windows.net/

## Architecture

### Services
- **Frontend** (React + Vite): Web UI for market overview, coin analysis, and predictions
- **Backend** (Spring Boot 3.5.8 + Java 25): REST API for market data and OHLCV records
- **Scheduler** (Python): Collects crypto data from Binance, KuCoin, Kraken
- **Analyzer** (FastAPI): Provides technical analysis and ML-based price predictions
- **Database** (PostgreSQL 18): Persistent storage for market data and OHLCV candles

## Quick Start

### Prerequisites
- Docker & Docker Compose
- Node 20 (for frontend development)
- Java 25 (for backend development)
- PostgreSQL client (optional, for manual DB access)
- kubectl & Kubernetes cluster (for K8s deployment)

### Local Development with Docker Compose

```bash
# Clone and navigate to project
cd das-proekt

# Copy environment template
cp .env.example .env

# Build all images
docker build -f backend/Dockerfile -t grune04/das-proekt-crypto-backend:latest .
docker build -f frontend/Dockerfile -t grune04/das-proekt-crypto-frontend:latest .
docker build -f scheduler/Dockerfile -t grune04/das-proekt-crypto-scheduler:latest .
docker build -f analyze/Dockerfile -t grune04/das-proekt-crypto-analyzer:latest .

# Start all services
docker-compose up -d

# Verify services are running
docker-compose ps

# View logs
docker-compose logs -f backend    # Backend logs
docker-compose logs -f frontend   # Frontend logs
docker-compose logs -f scheduler  # Scheduler logs
docker-compose logs -f fastapi    # Analyzer logs
docker-compose logs -f db         # Database logs

# Access services
# Frontend: http://localhost:3000
# Backend: http://localhost:8080
# Analyzer: http://localhost:8000/docs (Swagger UI)
# Database: psql -h localhost -U crypto -d crypto -p 5433

# Stop services
docker-compose down

# Clean up volumes (WARNING: deletes database)
docker-compose down -v
```

## CI/CD Pipeline

### GitHub Actions

Automated CI/CD pipeline on every push to `main` branch:
1. **Test Phase**: Runs backend Maven tests and frontend linting
2. **Build Phase**: Builds Docker images for all 4 services
3. **Push Phase**: Pushes images to DockerHub with tags:
   - `grune04/das-proekt-crypto-{service}:latest`
   - `grune04/das-proekt-crypto-{service}:{git-sha}`

**GitHub Actions Secrets Required:**
```
DOCKER_USERNAME=grune04
DOCKER_PASSWORD=<DockerHub Personal Access Token>
```

**Workflow File**: `.github/workflows/ci-cd.yml`

**Repository**: https://github.com/Grune04/das-proekt-crypto

## Kubernetes Deployment

### Prerequisites
- Kubernetes cluster (1.24+)
- kubectl configured to access your cluster
- Docker images already pushed to DockerHub
- NGINX Ingress Controller installed

### Install NGINX Ingress Controller (if not present)

```bash
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo update

helm install ingress-nginx ingress-nginx/ingress-nginx \
  --namespace ingress-nginx \
  --create-namespace \
  --set controller.service.type=LoadBalancer
```

### Deploy Application

```bash
# Create namespace
kubectl create namespace crypto-app

# Apply all Kubernetes manifests
kubectl apply -f k8s/ -n crypto-app

# Verify namespace and resources
kubectl get namespace crypto-app
kubectl get all -n crypto-app

# Check pod status
kubectl get pods -n crypto-app -w    # Watch pods starting

# Check services
kubectl get svc -n crypto-app

# Check StatefulSet
kubectl get statefulset -n crypto-app

# Check Ingress
kubectl get ingress -n crypto-app
```

### Verify Deployment

```bash
# Watch pod startup
kubectl get pods -n crypto-app -w

# Check individual pod logs
kubectl logs -n crypto-app deployment/backend --tail=50
kubectl logs -n crypto-app deployment/frontend --tail=50
kubectl logs -n crypto-app deployment/analyzer --tail=50
kubectl logs -n crypto-app deployment/scheduler --tail=50
kubectl logs -n crypto-app statefulset/postgres --tail=50

# Verify database initialization
kubectl exec -it -n crypto-app postgres-0 -- \
  psql -U crypto -d crypto -c "\dt"    # List tables

# Port-forward for local testing
kubectl port-forward -n crypto-app svc/frontend-service 3000:80 &
kubectl port-forward -n crypto-app svc/backend-service 8080:8080 &
kubectl port-forward -n crypto-app svc/analyzer-service 8000:8000 &

# Test services
curl http://localhost:3000            # Frontend
curl http://localhost:8080/health     # Backend (if health endpoint exists)
curl http://localhost:8000/docs       # Analyzer Swagger UI

# Kill port-forward sessions
killall kubectl
```

### Get Ingress IP and Access Application

```bash
# Get Ingress external IP
kubectl get ingress -n crypto-app -o wide

# Wait for LoadBalancer IP to be assigned (may take 2-5 minutes)
kubectl get ingress -n crypto-app -w

# Access application
# Example: http://<EXTERNAL-IP>/
# Or if using local hostname: http://crypto-app.local/
```

### Kubernetes Manifest Structure

```
k8s/
├── namespace.yaml                # Namespace definition
├── postgres-secret.yaml          # DB credentials (Secret)
├── postgres-configmap.yaml       # DB init script (ConfigMap)
├── postgres-statefulset.yaml     # PostgreSQL StatefulSet with persistent volume
├── postgres-service.yaml         # Headless service for StatefulSet
├── backend-secret.yaml           # Backend credentials (Secret)
├── backend-configmap.yaml        # Backend configuration (ConfigMap)
├── backend-deployment.yaml       # Backend deployment (2 replicas)
├── backend-service.yaml          # Backend service
├── frontend-configmap.yaml       # Frontend configuration (ConfigMap)
├── frontend-deployment.yaml      # Frontend deployment (2 replicas)
├── frontend-service.yaml         # Frontend service
├── scheduler-secret.yaml         # Scheduler credentials (Secret)
├── scheduler-configmap.yaml      # Scheduler configuration (ConfigMap)
├── scheduler-deployment.yaml     # Scheduler deployment (1 replica)
├── analyzer-secret.yaml          # Analyzer credentials (Secret)
├── analyzer-configmap.yaml       # Analyzer configuration (ConfigMap)
├── analyzer-deployment.yaml      # Analyzer deployment (2 replicas)
├── analyzer-service.yaml         # Analyzer service
└── ingress.yaml                  # Ingress rules for routing
```

### Configuration & Secrets

**Database Credentials** (postgres-secret.yaml):
```yaml
POSTGRES_USER: crypto
POSTGRES_PASSWORD: crypto-secure-password-change-in-prod
POSTGRES_DB: crypto
```

**Service Hostnames** (for inter-pod communication):
- Database: `postgres-0.postgres.default.svc.cluster.local:5432`
- Backend: `backend-service.crypto-app.svc.cluster.local:8080`
- Analyzer: `analyzer-service.crypto-app.svc.cluster.local:8000`
- Frontend: `frontend-service.crypto-app.svc.cluster.local:80`

### Scaling & Updates

```bash
# Scale backend replicas
kubectl scale deployment/backend -n crypto-app --replicas=3

# Rolling update with new image
kubectl set image deployment/backend \
  backend=grune04/das-proekt-crypto-backend:v1.0.0 \
  -n crypto-app

# Restart deployment (useful after config changes)
kubectl rollout restart deployment/backend -n crypto-app

# View rollout status
kubectl rollout status deployment/backend -n crypto-app

# Rollback to previous version
kubectl rollout undo deployment/backend -n crypto-app
```

### Troubleshooting

```bash
# Check events in namespace
kubectl get events -n crypto-app --sort-by='.lastTimestamp'

# Describe problematic pod
kubectl describe pod <pod-name> -n crypto-app

# Check resource usage
kubectl top nodes
kubectl top pods -n crypto-app

# Debug pod (shell access)
kubectl exec -it -n crypto-app <pod-name> -- /bin/sh

# Check persistent volume claims
kubectl get pvc -n crypto-app

# Check persistent volumes
kubectl get pv
```

### Cleanup

```bash
# Delete entire namespace (deletes all resources)
kubectl delete namespace crypto-app

# Delete specific resource
kubectl delete deployment/backend -n crypto-app
kubectl delete service/backend-service -n crypto-app

# Verify deletion
kubectl get all -n crypto-app
```

## Environment Variables

### Backend (backend/application.properties or env vars)
```
DB_HOST=postgres-0.postgres.default.svc.cluster.local
DB_PORT=5432
DB_NAME=crypto
DB_USER=crypto
DB_PASSWORD=crypto-secure-password-change-in-prod
SPRING_PROFILES_ACTIVE=production
JAVA_OPTS=-Xmx256m -Xms128m
```

### Analyzer
```
DB_HOST=postgres-0.postgres.default.svc.cluster.local
DB_PORT=5432
DB_NAME=crypto
DB_USER=crypto
DB_PASSWORD=crypto-secure-password-change-in-prod
```

### Scheduler
```
DB_HOST=postgres-0.postgres.default.svc.cluster.local
DB_PORT=5432
DB_NAME=crypto
DB_USER=crypto
DB_PASSWORD=crypto-secure-password-change-in-prod
```

### Frontend
```
VITE_API_URL=http://backend-service:8080
VITE_ANALYZER_URL=http://analyzer-service:8000
```

## Build Information

### Docker Images
- **Backend**: Eclipse Temurin Java 25 JRE on Alpine Linux
- **Frontend**: Node.js 20 multi-stage build with Nginx on Alpine Linux
- **Scheduler**: Python 3.11 on Alpine Linux with PostgreSQL client
- **Analyzer**: Python 3.11 on Alpine Linux with FastAPI

### Kubernetes Replicas & Resources

| Service | Replicas | CPU Request | Memory Request | CPU Limit | Memory Limit |
|---------|----------|-------------|----------------|-----------|--------------|
| Backend | 2 | 100m | 256Mi | 500m | 512Mi |
| Frontend | 2 | 50m | 128Mi | 200m | 256Mi |
| Scheduler | 1 | 100m | 256Mi | 500m | 512Mi |
| Analyzer | 2 | 100m | 256Mi | 500m | 512Mi |
| PostgreSQL | 1 | 100m | 256Mi | 500m | 512Mi |

### Database

**Storage**: 5Gi persistent volume (configurable in postgres-statefulset.yaml)

**Tables**:
- `crypto_ohlcv`: OHLCV candlestick data (symbol, date, open, high, low, close, volume)
- `market_data`: Market data snapshot (coingecko_id, symbol, price, market_cap, etc.)

## Development

### Local Setup (without Docker)

**Backend**:
```bash
cd backend
mvn clean install
mvn spring-boot:run
```

**Frontend**:
```bash
cd frontend
npm install
npm run dev
```

**Scheduler**:
```bash
cd scheduler
pip install -r requirements.txt
python scheduler_service.py
```

**Analyzer**:
```bash
cd analyze
pip install -r requirements.txt
python -m uvicorn analyze:app --host 0.0.0.0 --port 8000 --reload
```

## Performance & Optimization

- **Frontend**: Vite for fast builds, React for efficient rendering
- **Backend**: Spring Boot 3.5 with Java 25 virtual threads for I/O performance
- **Scheduler**: Concurrent requests to multiple exchanges (Binance, KuCoin, Kraken)
- **Analyzer**: LSTM neural networks for price prediction, technical indicators (RSI, MACD, Bollinger Bands, etc.)
- **Database**: PostgreSQL with indexes on symbol and date for fast queries

## License

This project is for educational purposes.