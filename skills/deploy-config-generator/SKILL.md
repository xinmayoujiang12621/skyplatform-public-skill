---
name: deploy-config-generator
description: "Generate production-ready deployment configurations (Dockerfile, nginx, GitHub Actions CI/CD) for frontend/backend/fullstack projects."
trigger: /deploy-config-generator
---

Generate production-ready deployment configurations for any project (frontend / backend / fullstack monorepo).

# Deploy Config Generator Skill

Generate production-ready deployment configurations for any project (frontend / backend / fullstack monorepo).

## When to Use

Use this skill when the user asks you to:
- Generate deployment scripts / configs
- Create Dockerfile for a service
- Create nginx configuration
- Set up GitHub Actions CI/CD pipeline
- Create auto-deploy workflow
- Anything related to Docker + GitHub Actions + nginx deployment

## Mandatory Naming & Placement Rules

> **These rules are non-negotiable and must always be followed.**

1. **Host nginx config placement**: The host-machine nginx reverse proxy configuration file **MUST** be placed at the project root under `deploy/` directory.
2. **Host nginx config filename**: The filename **MUST** be the project's root folder name (i.e. the repository's top-level directory name) with a `.conf` extension.

   ```
   # Example: if the project root folder is named "iam-platform"
   deploy/
   └── iam-platform.conf
   ```

   To determine the project root folder name, inspect the actual filesystem path of the workspace root (e.g. if the project lives at `/home/user/iam-platform`, the name is `iam-platform`). Do **NOT** invent or ask for an alternative name — always use the root folder name directly.

3. All other generated files (Dockerfiles, container nginx configs, CI/CD workflows) follow their respective conventions described below, but the host nginx config's path and name are fixed by these rules.

4. **禁止 `.env` 文件挂载和 `ENV_FILE` 变量**: 生成的 `build-docker.yml` 中 **不得** 包含任何形式的 `.env` 文件宿主机挂载（如 `-v /path/.env:/app/.env`、`--env-file` 参数）或 `XXX_ENV_FILE` 类型的环境变量。`docker run` 命令仅需端口映射 `-p`、容器名 `--name`、重启策略 `--restart` 即可，不添加任何额外的卷挂载或环境文件参数。

## Workflow

### Step 1: Gather Information

Before generating any files, ask the user the following questions. Only ask questions that cannot be inferred from the codebase:

1. **Project structure**: Explore the current project to determine:
   - Monorepo with multiple services or single service?
   - Language / framework for each service (Python/FastAPI, Node.js, Java, Go, etc.)
   - Directory layout (e.g., `backend/`, `frontend/`, or `iam-backend/`, `iam-frontend/`)
   - Whether there is a shared SDK/library directory

2. **Deployment details** (ask the user):
   - Docker registry URL (e.g., Aliyun ACR, Docker Hub, GHCR)
   - Target server domain(s) — production AND staging if applicable
   - SSL certificate paths on the server
   - Port assignments for each service
   - Deploy branch name (default: `deploy`)
   - Staging branch name (if separate from deploy branch)
   - Whether SSE / WebSocket / long-polling endpoints exist in backend services
   - Whether frontend uses npm, yarn, or pnpm
   - Whether frontend uses Vite (requires `BUILD_MODE` handling for env vars)

### Step 2: Determine Project Root Folder Name

Before generating any files, determine the project root folder name by inspecting the workspace root path. For example:
- If the project is at `C:\Users\xxx\projects\iam-platform`, the root folder name is `iam-platform`
- If the project is at `/home/user/my-saas`, the root folder name is `my-saas`

This name will be used as `{{PROJECT_NAME}}` for the host nginx config filename (`deploy/{root-folder-name}.conf`).

### Step 3: Generate Files

Generate the following files based on the templates below. Replace all `{{VARIABLE}}` placeholders with actual values collected from the user and the codebase.

#### File 1: `.github/workflows/build-docker.yml`

See template **build-docker.yml** below.

#### File 2: `deploy/{project-root-folder-name}.conf` (Host Nginx)

See template **nginx-host.conf** below.

#### File 3: `{frontend-dir}/nginx.conf` (Container Nginx)

See template **nginx-frontend.conf** below.

#### File 4: `{backend-dir}/Dockerfile`

See template **Dockerfile.backend** below.

#### File 5: `{frontend-dir}/Dockerfile`

See template **Dockerfile.frontend** below.

#### File 6: `{frontend-dir}/.env.staging` (if frontend uses Vite)

Create a `.env.staging` file alongside the existing `.env` (production) and `.env.development` files. This file contains environment-specific values for the staging/test environment. See **Multi-Environment Frontend Builds** below.

### Step 4: SSE / WebSocket Special Handling

If the backend has SSE or WebSocket endpoints, add the following to the host nginx config location block for those API paths:

```nginx
proxy_http_version 1.1;
proxy_set_header Connection '';
proxy_buffering off;
proxy_cache off;
proxy_read_timeout 86400s;
proxy_send_timeout 86400s;
```

And ensure the Gunicorn command in the backend Dockerfile uses:
- `--timeout 600` (or higher)
- `--graceful-timeout 600`

### Step 5: Write Files

Write all generated files to the appropriate paths in the user's project. Confirm the file list with the user before writing. Remind the user to copy the `deploy/{root-folder-name}.conf` to the host nginx's `conf.d/` (or equivalent) directory and reload nginx.

---

## Multi-Environment Frontend Builds

For Vite-based frontends that use `.env` files with `VITE_*` variables, the values are baked into the build at compile time. To support different environments (production vs staging):

### How it works

1. **`.env`** — production values (always loaded by Vite)
2. **`.env.staging`** — staging/test values (loaded when `--mode staging`)
3. **Dockerfile** — accepts `BUILD_MODE` arg (default: `production`)
4. **Workflow** — passes `BUILD_MODE=staging` when deploying from staging branch

### Vite mode loading priority

When `vite build --mode staging`:
- `.env` loaded first
- `.env.staging` loaded second, **overriding** any matching keys from `.env`

So `.env.staging` only needs to contain the variables that differ from production.

### Frontend Dockerfile change

```dockerfile
ARG BUILD_MODE=production
# ...
COPY . .
RUN NODE_OPTIONS="--max-old-space-size=4096" npx vite build --mode ${BUILD_MODE}
```

Use `npx vite build` directly (not `pnpm run build`) because `pnpm run build` typically chains `tsc -b && vite build`, and `tsc` doesn't support `--mode`.

### Workflow build-args

```yaml
- name: Build and push
  uses: docker/build-push-action@v6.2.0
  with:
    build-args: BUILD_MODE=${{ github.ref_name == '<staging-branch>' && 'staging' || 'production' }}
```

Backend Dockerfiles don't use `BUILD_MODE` — Docker ignores unused build args silently.

---

## Multi-Environment Backend Configuration (Remote Config)

For backends that load configuration from a remote config service (e.g., `settings.yaml` → config URL), the environment is typically hardcoded in the URL (e.g., `.../pull/suikongai-iam/prod`). To support multi-environment deployment without manually editing `settings.yaml`:

### Pattern: Runtime environment variable override

Pass `DEPLOY_ENV` and `CONFIG_TOKEN` as runtime env vars via `docker run`. This is the standard 12-Factor App approach — the same Docker image works for all environments, no rebuild needed.

### How it works

1. **`settings.yaml`** — contains the production config URL and token (default / fallback)
2. **`settings.py`** — reads `settings.yaml`, then checks `DEPLOY_ENV` and `CONFIG_TOKEN` env vars for overrides
3. **CI workflow** — derives environment from branch name and passes env vars to `docker run`
4. **GitHub Environment secrets** — stores per-service, per-environment config tokens

### Code change in `settings.py`

Add `_apply_env_overrides()` method after `_load_yaml_config()`:

```python
import os  # add to existing imports

class Settings(PydanticBaseSettings):
    # ... existing fields ...

    def model_post_init(self, __context: Any) -> None:
        self._load_yaml_config()
        self._apply_env_overrides()  # <-- add this line
        if self.token:
            self.headers = {'Authorization': f'Bearer {self.token}'}
        self.config = self.init_fast_config()
        self.apply_config()

    # ... existing _load_yaml_config ...

    def _apply_env_overrides(self) -> None:
        deploy_env = os.environ.get('DEPLOY_ENV', '').strip()
        if deploy_env and self.config_url:
            # Replace last URL path segment: /prod → /test
            self.config_url = '/'.join(
                self.config_url.rstrip('/').split('/')[:-1] + [deploy_env]
            )
            logger.info(f"DEPLOY_ENV={deploy_env}, config_url → {self.config_url}")

        env_token = os.environ.get('CONFIG_TOKEN', '').strip()
        if env_token:
            self.token = env_token
            logger.info("CONFIG_TOKEN 从环境变量覆盖")

    # ... rest of existing methods ...
```

### Key points

- **No impact on local development**: When `DEPLOY_ENV` and `CONFIG_TOKEN` are not set, code falls back to `settings.yaml` values unchanged.
- **Same Docker image for all environments**: No rebuild needed to switch environments.
- **Build-time vs runtime**: Frontend uses build-time `BUILD_MODE` (Vite bakes env vars at compile time). Backend uses runtime `DEPLOY_ENV` (Python reads env vars at startup). This is the correct pattern for each.

---

## GitHub Actions Environment Configuration

The workflow uses **GitHub Environments** (`prod` / `staging`) for branch-based secret isolation. Configure in GitHub repo Settings → Environments:

### Environment: `prod`
**Environment secrets:**
- `ALIYUN_PASSWORD` — Docker registry password
- `SSH_PRIVATE_KEY` — SSH private key for deployment (ed25519)
- `{SERVICE_ID_UPPER}_CONFIG_TOKEN` — Remote config service JWT token for each backend service (e.g., `SSO_CONFIG_TOKEN`, `IAM_CONFIG_TOKEN`, `UMS_CONFIG_TOKEN`)

**Environment variables:**
- `ALIYUN_USERNAME` — Docker registry username
- `DEPLOY_HOST` — Production server IP/hostname
- `DEPLOY_USER` — SSH username for deployment

### Environment: `staging`
Same keys as prod, but pointing to staging server:
- `DEPLOY_HOST` → staging server IP
- `DEPLOY_USER` → staging SSH user
- `SSH_PRIVATE_KEY` → staging server's SSH key
- `ALIYUN_*` → same or different registry credentials
- `{SERVICE_ID_UPPER}_CONFIG_TOKEN` → staging/test config tokens for each backend service

### SSH Key Setup

On the target server:
```bash
# Generate key pair (on your machine)
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/github_actions_deploy

# Copy public key to server
ssh-copy-id -i ~/.ssh/github_actions_deploy.pub deploy-user@server-ip

# Add private key to GitHub Environment secret SSH_PRIVATE_KEY
cat ~/.ssh/github_actions_deploy
```

---

## Template Variables Reference

All templates use `{{VARIABLE}}` syntax. The following variables are available:

### Global Variables
| Variable | Description | Example |
|---|---|---|
| `{{PROJECT_NAME}}` | Project identifier — **must match the project root folder name on disk** | `iam-platform` |
| `{{DEPLOY_BRANCH}}` | Branch(es) that trigger deploy | `[deploy, dev-deploy-to-test]` |
| `{{STAGING_BRANCH}}` | Branch name for staging environment | `dev-deploy-to-test` |
| `{{REGISTRY}}` | Docker registry URL | `crpi-xxx.cn-beijing.personal.cr.aliyuncs.com` |
| `{{REGISTRY_NAMESPACE}}` | Registry namespace/org | `myorg` |

### Per-Service Variables (repeated for each service)
| Variable | Description | Example |
|---|---|---|
| `{{SERVICE_ID}}` | Kebab-case service ID | `iam-backend`, `iam-frontend` |
| `{{SERVICE_DISPLAY}}` | Human-readable name | `IAM Backend` |
| `{{SERVICE_DIR}}` | Directory path (relative to repo root) | `iam-backend` |
| `{{IMAGE_NAME}}` | Docker image name | `myorg/iam-backend` |
| `{{CONTAINER_NAME}}` | Docker container name | `iam-backend` |
| `{{PORT}}` | Service port | `20300` |
| `{{DOCKER_CONTEXT}}` | Docker build context | `.` for backend, `./iam-frontend` for frontend |
| `{{DOCKERFILE_PATH}}` | Dockerfile path relative to repo root | `./iam-backend/Dockerfile` |
| `{{DOMAIN}}` | Domain name (for nginx) | `iam.example.com` |
| `{{SSL_CERT}}` | SSL cert path on server | `/etc/nginx/cert/example.pem` |
| `{{SSL_KEY}}` | SSL key path on server | `/etc/nginx/cert/example.key` |
| `{{HAS_SSE}}` | Backend has SSE endpoints | `true` / `false` |
| `{{HEALTH_PATH}}` | Health check endpoint | `/api/health` |
| `{{PORT_MAPPING}}` | Docker port mapping | `20300:20300` for backend, `20400:80` for frontend |
| `{{IS_FRONTEND}}` | Whether this is a frontend service | `true` / `false` |

### Cross-Service Proxy Variables (for nginx)
| Variable | Description | Example |
|---|---|---|
| `{{PROXY_PREFIX}}` | URL prefix for cross-service proxy | `/sso-api` |
| `{{PROXY_TARGET}}` | Target service URL | `http://127.0.0.1:20301` |

### Backend Dockerfile Variables
| Variable | Description | Example |
|---|---|---|
| `{{PYTHON_BASE_IMAGE}}` | Python base image | `python:3.13-slim` |
| `{{SDK_DIR}}` | Shared SDK directory (if exists) | `sdk` |
| `{{HAS_SDK}}` | Whether project has shared SDK | `true` / `false` |
| `{{ENTRY_CMD}}` | Container start command | `python -m gunicorn ...` |
| `{{GUNICORN_TIMEOUT}}` | Gunicorn timeout (600 for SSE) | `600` |
| `{{GUNICORN_WORKERS}}` | Number of Gunicorn workers | `4` |

### Frontend Dockerfile Variables
| Variable | Description | Example |
|---|---|---|
| `{{NODE_VERSION}}` | Node.js version | `20` |
| `{{PKG_MANAGER}}` | Package manager | `pnpm` / `npm` / `yarn` |
| `{{BUILD_CMD}}` | Build command | `npx vite build --mode ${BUILD_MODE}` |
| `{{DIST_DIR}}` | Build output directory | `dist` |

## Output File Structure

Typical output for a monorepo with multiple services (assume project root folder is `iam-platform`):

```
iam-platform/                            # <- project root folder name
├── .github/
│   └── workflows/
│       └── build-docker.yml             # CI/CD workflow (matrix strategy)
├── deploy/
│   └── iam-platform.conf                # <- {root-folder-name}.conf (host nginx)
├── service-a-backend/
│   └── Dockerfile                       # Backend Dockerfile
├── service-a-frontend/
│   ├── .env                             # Production env vars
│   ├── .env.development                 # Local dev env vars
│   ├── .env.staging                     # Staging/test env vars
│   ├── Dockerfile                       # Frontend Dockerfile (BUILD_MODE support)
│   └── nginx.conf                       # Container nginx config
├── service-b-backend/
│   └── Dockerfile
└── service-b-frontend/
    ├── .env
    ├── .env.staging
    ├── Dockerfile
    └── nginx.conf
```

For a single service project (assume project root folder is `my-app`):

```
my-app/                                  # <- project root folder name
├── .github/
│   └── workflows/
│       └── build-docker.yml
├── deploy/
│   └── my-app.conf                      # <- {root-folder-name}.conf (host nginx)
├── backend/
│   └── Dockerfile
└── frontend/
    ├── .env
    ├── .env.staging
    ├── Dockerfile
    └── nginx.conf
```

## Notes

- Always read the existing project structure before generating configs.
- Preserve existing files if the user asks to update rather than overwrite.
- The workflow template uses **SSH key-based deployment** (not sshpass) — remind the user to set up SSH keys and GitHub Environment secrets/variables.
- For non-Python backends (Java, Go, Node.js), adapt the Dockerfile template accordingly but keep the same multi-stage pattern.
- Frontend Dockerfile always maps container port 80 (nginx); port mapping to host happens at `docker run` level.
- Use `max-parallel: 2` in matrix strategy to avoid containerd "lease does not exist" errors during parallel docker pulls.
- Include retry logic (3 attempts, 10s delay) in docker pull to handle transient containerd issues.

---

# Templates

## Template: build-docker.yml (Matrix Strategy)

This template uses a **single matrix job** to handle all services, instead of duplicating jobs per service. This reduces a 550+ line workflow to ~165 lines while preserving all functionality.

```yaml
# ==============================================================================
# GitHub Actions Workflow Template — Build & Deploy (Matrix Strategy)
# ==============================================================================
# Uses a single matrix job for all services instead of duplicate jobs.
# Supports: auto-deploy on push, manual deploy via workflow_dispatch,
#           rollback, multi-environment (prod/staging), change detection.
# ==============================================================================

name: Build & Deploy

concurrency:
  group: deploy-${{ github.ref }}
  cancel-in-progress: false

on:
  push:
    branches: [{{DEPLOY_BRANCH}}, {{STAGING_BRANCH}}]
  workflow_dispatch:
    inputs:
      deploy_{{SERVICE_ID}}:
        description: 'Deploy {{SERVICE_DISPLAY}}'
        type: boolean
        default: false
      # Repeat deploy_<service_id> for each service
      rollback_tag:
        description: 'Rollback: enter image tag (e.g. short SHA like a1b2c3d or timestamp like 20260418-0930). Leave empty for normal build.'
        type: string
        default: ''

env:
  ALIYUN_REGISTRY: {{REGISTRY}}

jobs:
  # ==========================================================================
  # Detect which services changed (skip unchanged on push)
  # ==========================================================================
  detect-changes:
    runs-on: ubuntu-latest
    outputs:
      {{SERVICE_ID}}: ${{ steps.decide.outputs.{{SERVICE_ID}} }}
      # Repeat for each service
    steps:
      - uses: actions/checkout@v5

      - name: Detect changed paths
        if: github.event_name == 'push'
        uses: dorny/paths-filter@v4
        id: filter
        with:
          filters: |
            {{SERVICE_ID}}:
              - '{{SERVICE_DIR}}/**'
            # Repeat for each service

      - name: Decide targets
        id: decide
        run: |
          if [ "${{ github.event_name }}" = "workflow_dispatch" ]; then
            echo "{{SERVICE_ID}}=${{ inputs.deploy_{{SERVICE_ID}} }}" >> $GITHUB_OUTPUT
            # Repeat for each service
          else
            echo "{{SERVICE_ID}}=${{ steps.filter.outputs.{{SERVICE_ID}} }}" >> $GITHUB_OUTPUT
            # Repeat for each service
          fi

  # ==========================================================================
  # Build & Deploy — Matrix handles all services in one job
  # ==========================================================================
  build-and-deploy:
    needs: detect-changes
    if: >-
      needs.detect-changes.outputs.{{SERVICE_ID}} == 'true'
      # OR all services with ||
    runs-on: ubuntu-latest
    environment:
      name: ${{ (github.ref_name == 'main' || github.ref_name == 'dev' || github.ref_name == '{{DEPLOY_BRANCH}}') && 'prod' || (github.ref_name == '{{STAGING_BRANCH}}') && 'staging' || '' }}
    strategy:
      fail-fast: false
      max-parallel: 2
      matrix:
        include:
          # --- Backend services ---
          - service: {{SERVICE_ID}}
            image: {{REGISTRY_NAMESPACE}}/{{SERVICE_ID}}
            container: {{CONTAINER_NAME}}
            port_mapping: {{PORT}}:{{PORT}}
            context: .
            dockerfile: ./{{SERVICE_DIR}}/Dockerfile
            health_path: /api/health
            change_key: {{SERVICE_ID}}
          # --- Frontend services ---
          - service: {{SERVICE_ID}}
            image: {{REGISTRY_NAMESPACE}}/{{SERVICE_ID}}
            container: {{CONTAINER_NAME}}
            port_mapping: {{FRONTEND_PORT}}:80
            context: ./{{SERVICE_DIR}}
            dockerfile: ./{{SERVICE_DIR}}/Dockerfile
            health_path: ''
            change_key: {{SERVICE_ID}}
          # Repeat for each service
    steps:
      - name: Skip unchanged services
        id: check
        run: |
          if [ "${{ needs.detect-changes.outputs[matrix.change_key] }}" != "true" ]; then
            echo "skip=true" >> $GITHUB_OUTPUT
          else
            echo "skip=false" >> $GITHUB_OUTPUT
          fi

      - name: Checkout code
        if: steps.check.outputs.skip != 'true' && github.event.inputs.rollback_tag == ''
        uses: actions/checkout@v5

      - name: Generate version tags
        if: steps.check.outputs.skip != 'true' && github.event.inputs.rollback_tag == ''
        id: version
        run: |
          echo "short_sha=$(echo ${{ github.sha }} | cut -c1-7)" >> $GITHUB_OUTPUT
          echo "timestamp=$(date +%Y%m%d-%H%M)" >> $GITHUB_OUTPUT

      - name: Set up Docker Buildx
        if: steps.check.outputs.skip != 'true' && github.event.inputs.rollback_tag == ''
        uses: docker/setup-buildx-action@v4

      - name: Login to Docker registry
        if: steps.check.outputs.skip != 'true'
        uses: docker/login-action@v4
        with:
          registry: ${{ env.ALIYUN_REGISTRY }}
          username: ${{ vars.ALIYUN_USERNAME }}
          password: ${{ secrets.ALIYUN_PASSWORD }}

      - name: Build and push
        if: steps.check.outputs.skip != 'true' && github.event.inputs.rollback_tag == ''
        uses: docker/build-push-action@v6.2.0
        with:
          context: ${{ matrix.context }}
          file: ${{ matrix.dockerfile }}
          push: true
          build-args: BUILD_MODE=${{ github.ref_name == '{{STAGING_BRANCH}}' && 'staging' || 'production' }}
          cache-from: type=gha,scope=${{ matrix.service }}
          cache-to: type=gha,mode=max,scope=${{ matrix.service }}
          tags: |
            ${{ env.ALIYUN_REGISTRY }}/${{ matrix.image }}:latest
            ${{ env.ALIYUN_REGISTRY }}/${{ matrix.image }}:${{ github.sha }}
            ${{ env.ALIYUN_REGISTRY }}/${{ matrix.image }}:${{ steps.version.outputs.short_sha }}
            ${{ env.ALIYUN_REGISTRY }}/${{ matrix.image }}:${{ steps.version.outputs.timestamp }}

      - name: Resolve config token
        if: steps.check.outputs.skip != 'true'
        id: config-token
        run: |
          case "${{ matrix.service }}" in
            {{SERVICE_ID}}) echo "token=${{ secrets.{{SERVICE_ID_UPPER}}_CONFIG_TOKEN }}" >> $GITHUB_OUTPUT ;;
            # Repeat for each backend service
          esac

      - name: Deploy to server
        if: steps.check.outputs.skip != 'true'
        env:
          DEPLOY_TAG: ${{ github.event.inputs.rollback_tag || github.sha }}
          DEPLOY_ENV: ${{ github.ref_name == '{{STAGING_BRANCH}}' && 'test' || 'prod' }}
          CONFIG_TOKEN: ${{ steps.config-token.outputs.token }}
        run: |
          mkdir -p ~/.ssh
          echo "${{ secrets.SSH_PRIVATE_KEY }}" | tr -d '\r' > ~/.ssh/deploy_key
          chmod 600 ~/.ssh/deploy_key
          ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 -i ~/.ssh/deploy_key ${{ vars.DEPLOY_USER }}@${{ vars.DEPLOY_HOST }} << DEPLOY
            for i in 1 2 3; do
              docker pull ${{ env.ALIYUN_REGISTRY }}/${{ matrix.image }}:${DEPLOY_TAG} && break
              echo "Retry \$i/3: waiting 10s..."
              sleep 10
            done
            docker stop ${{ matrix.container }} 2>/dev/null || true
            docker rm ${{ matrix.container }} 2>/dev/null || true
            docker run -d \
              --name ${{ matrix.container }} \
              --restart unless-stopped \
              -p ${{ matrix.port_mapping }} \
              -e DEPLOY_ENV="${DEPLOY_ENV}" \
              -e CONFIG_TOKEN="${CONFIG_TOKEN}" \
              ${{ env.ALIYUN_REGISTRY }}/${{ matrix.image }}:${DEPLOY_TAG}
            sleep 5
            if docker ps --filter "name=${{ matrix.container }}" --filter "status=running" --quiet | grep -q .; then
              echo "OK: ${{ matrix.container }} is running"
            else
              echo "WARN: ${{ matrix.container }} may not be running, checking logs..."
              docker logs ${{ matrix.container }} --tail 20 2>&1 || true
              exit 1
            fi
            docker image prune -f
          DEPLOY
```

### Key design decisions explained

| Decision | Why |
|---|---|
| `concurrency: cancel-in-progress: false` | Don't cancel in-flight deploys when a new push arrives |
| `max-parallel: 2` | Avoids containerd "lease does not exist" errors when multiple services pull simultaneously |
| `type=gha` cache | GitHub Actions native cache — simpler than `actions/cache` + `/tmp/.buildx-cache` |
| SSH key auth (not sshpass) | More reliable, no password auth issues, industry standard |
| `vars.DEPLOY_HOST` not `secrets.DEPLOY_HOST` | Non-sensitive config belongs in Environment variables, not secrets |
| `build-args: BUILD_MODE` | Frontend env vars are compile-time; different `.env.staging` for different branches |
| `DEPLOY_ENV` runtime env var | Backend config URL is runtime; same image deploys to any environment without rebuild |
| `CONFIG_TOKEN` per-service secret | Remote config service requires env-specific JWT; stored in GitHub Environment secrets |
| `docker pull` retry (3x) | Handles transient containerd/network errors on parallel deploys |
| `docker image prune -f` | Clean up old images after each deploy to prevent disk fill |

## Template: nginx-host.conf

```nginx
# ==============================================================================
# Host Nginx Config Template — Reverse Proxy
# ==============================================================================
# This config runs on the HOST machine's nginx, reverse-proxying to containers.
# One server block per domain.
# ==============================================================================

# {{DOMAIN}} - HTTPS

server {
    listen 443 ssl http2;
    server_name {{DOMAIN}};

    ssl_certificate {{SSL_CERT}};
    ssl_certificate_key {{SSL_KEY}};

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options nosniff;
    add_header X-Frame-Options DENY;

    location /api {
        proxy_pass http://127.0.0.1:{{BACKEND_PORT}}/api;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    {{EXTRA_LOCATIONS}}

    {{SSE_LOCATIONS}}

    location / {
        proxy_pass http://127.0.0.1:{{FRONTEND_PORT}};
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# {{DOMAIN}} - HTTP -> HTTPS redirect

server {
    listen 80;
    server_name {{DOMAIN}};
    return 301 https://$server_name$request_uri;
}
```

Cross-service proxy example (placed in `{{EXTRA_LOCATIONS}}`):
```nginx
location /sso-api {
    rewrite ^/sso-api/(.*) /api/$1 break;
    proxy_pass http://127.0.0.1:20301;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

SSE location example (placed in `{{SSE_LOCATIONS}}`):
```nginx
location /api/v2/sse {
    proxy_pass http://127.0.0.1:20300/api/v2/sse;
    proxy_http_version 1.1;
    proxy_set_header Connection '';
    proxy_buffering off;
    proxy_cache off;
    proxy_read_timeout 86400s;
    proxy_send_timeout 86400s;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

## Template: nginx-frontend.conf

```nginx
server {
    listen 80;
    server_name _;

    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript image/svg+xml;
    gzip_min_length 1024;
}
```

## Template: Dockerfile.backend

```dockerfile
# ==============================================================================
# Backend Dockerfile Template (Python / FastAPI)
# ==============================================================================
# Multi-stage build for Python backend services.
# ==============================================================================

# ---------------------------------------------------------------------------
# Stage 1: Install Python dependencies
# ---------------------------------------------------------------------------
FROM {{PYTHON_BASE_IMAGE}} AS dependencies

WORKDIR /build

# If project has shared SDK, uncomment:
# COPY {{SDK_DIR}}/ /build/{{SDK_DIR}}/

COPY {{SERVICE_DIR}}/requirements.txt /build/{{SERVICE_DIR}}/requirements.txt

WORKDIR /build/{{SERVICE_DIR}}

RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt -i https://mirrors.aliyun.com/pypi/simple/

# ---------------------------------------------------------------------------
# Stage 2: Production image
# ---------------------------------------------------------------------------
FROM dependencies AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app \
    TZ=Asia/Shanghai

WORKDIR /app

RUN mkdir -p /app/logs

COPY {{SERVICE_DIR}}/ /app/

EXPOSE {{PORT}}

HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:{{PORT}}{{HEALTH_PATH}} || exit 1

CMD ["python", "-m", "gunicorn", "main:app", "-w", "{{GUNICORN_WORKERS}}", "-k", "uvicorn.workers.UvicornWorker", "--bind", "0.0.0.0:{{PORT}}", "--timeout", "{{GUNICORN_TIMEOUT}}", "--access-logfile", "-", "--error-logfile", "-", "--log-level", "info"]
```

## Template: Dockerfile.frontend (with BUILD_MODE support)

```dockerfile
# ==============================================================================
# Frontend Dockerfile Template (Node.js -> nginx)
# ==============================================================================
# Multi-stage build: Node.js build stage -> nginx serve stage.
# Supports BUILD_MODE build arg for multi-environment Vite builds.
# ==============================================================================

# ---------------------------------------------------------------------------
# Stage 1: Build
# ---------------------------------------------------------------------------
FROM node:{{NODE_VERSION}}-slim AS build

ARG BUILD_MODE=production

# For pnpm:
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY package.json ./
RUN pnpm install

COPY . .
RUN NODE_OPTIONS="--max-old-space-size=4096" npx vite build --mode ${BUILD_MODE}

# ---------------------------------------------------------------------------
# Stage 2: Serve with nginx
# ---------------------------------------------------------------------------
FROM nginx:alpine

COPY --from=build /app/{{DIST_DIR}} /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

> **Note**: Use `npx vite build --mode ${BUILD_MODE}` instead of `pnpm run build` because the npm build script typically chains `tsc -b && vite build`, and `tsc` doesn't support `--mode`. The Dockerfile calls vite directly for cleaner mode control.

## Template: .env.staging

Create alongside existing `.env` (production) and `.env.development` (local dev):

```
# {{SERVICE_DISPLAY}} (Staging / Test)
# Vite loads this when BUILD_MODE=staging, overriding matching keys from .env
VITE_API_TARGET=https://test-{{DOMAIN}}
# ... other VITE_ variables with staging values
```
