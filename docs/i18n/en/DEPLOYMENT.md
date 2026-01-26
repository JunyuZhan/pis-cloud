# PIS Deployment Guide

> Author: junyuzhan (junyuzhan@outlook.com)  
> License: MIT

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Prerequisites](#prerequisites)
3. [Supabase Configuration](#supabase-configuration)
4. [Local Development Environment](#local-development-environment)
5. [Production Deployment](#production-deployment)
6. [Environment Variables](#environment-variables)
7. [Verification & Testing](#verification--testing)
8. [Maintenance & Operations](#maintenance--operations)
9. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                            Internet                                     │
└─────────────────────────────┬───────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────────────────────┐
│    Vercel     │    │   Supabase    │    │      Internal Server          │
│  (Next.js)    │    │    Cloud      │    │                               │
│               │    │               │    │  ┌─────────┐  ┌─────────────┐ │
│  • Frontend   │    │  • PostgreSQL │    │  │  MinIO  │  │   Worker    │ │
│  • API Routes │    │  • Auth       │    │  │(Storage)│  │(Processing) │ │
│  • SSR/SSG    │    │  • Realtime   │    │  └─────────┘  └─────────────┘ │
│               │    │               │    │       ▲              │        │
└───────┬───────┘    └───────┬───────┘    │       └──────────────┘        │
        │                    │            │              Redis            │
        │                    │            │         (Task Queue)          │
        └────────────────────┴────────────┴───────────────────────────────┘
```

| Component | Deployment Location | Purpose |
|-----------|-------------------|---------|
| Next.js Frontend | Vercel | User interface, API routes |
| PostgreSQL | Supabase | Metadata storage |
| Auth | Supabase | User authentication |
| Realtime | Supabase | Real-time push |
| MinIO | Internal Docker | Photo storage |
| Worker | Internal Docker | Image processing |
| Redis | Internal Docker | Task queue |

---

## Prerequisites

### Local Development

- **Node.js** >= 20.0.0
- **pnpm** >= 9.0.0
- **Docker** & Docker Compose
- **Git**

### Production Deployment

- A Linux server (recommended 2 cores 4GB+)
- Docker installed
- Domain names resolved to server (need two: main site + media)
- Supabase account (free tier is fine)
- Vercel account (free tier is fine)

---

## Supabase Configuration

### 1. Create Project

1. Visit [https://supabase.com](https://supabase.com) and log in
2. Click **New Project**
3. Fill in project information:
   - **Name**: `pis`
   - **Database Password**: Set a strong password and save it
   - **Region**: Choose the region closest to you (recommended: Singapore)
4. Click **Create new project**, wait 2-3 minutes

### 2. Get API Keys

Go to project → **Settings** → **API**, copy the following information:

| Name | Purpose | Example |
|------|---------|---------|
| Project URL | All clients | `https://xxxxx.supabase.co` |
| anon public | Frontend browser | `eyJhbGciOiJIUzI1NiIs...` |
| service_role | Worker backend | `eyJhbGciOiJIUzI1NiIs...` (⚠️ Keep secret!) |

### 3. Execute Database Schema

1. Go to project → **SQL Editor**
2. Click **New query**
3. Copy the **entire content** of `database/full_schema.sql`
4. Paste into SQL Editor
5. Click **Run** to execute
6. ✅ Done!

**Or use command line**:
```bash
psql $DATABASE_URL < database/full_schema.sql
```

### 4. Create Admin Account

1. Go to **Authentication** → **Users**
2. Click **Add user** → **Create new user**
3. Fill in:
   - Email: Your admin email
   - Password: Strong password
   - ☑️ Auto Confirm User
4. Click **Create user**

### 5. Configure Auth URLs

1. Go to **Authentication** → **URL Configuration**
2. Set:

| Configuration | Value |
|--------------|-------|
| Site URL | `https://yourdomain.com` |
| Redirect URLs | `https://yourdomain.com/auth/callback` |
| | `http://localhost:3000/auth/callback` |

### 6. Enable Realtime (Optional but Recommended)

1. Go to **Database** → **Replication**
2. Click **Tables** tab
3. Find `photos` table, toggle to enable

---

## Local Development Environment

### 1. Clone and Install

```bash
git clone https://github.com/your-username/pis.git
cd pis
pnpm install
```

### 2. Start Base Services

```bash
cd docker
docker-compose up -d minio redis minio-init
```

Verify services started:
```bash
docker-compose ps
# Should see pis-minio and pis-redis status as Up (healthy)
```

### 3. Configure Environment Variables

**apps/web/.env.local:**

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Application Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_MEDIA_URL=http://localhost:9000/pis-photos
```

**services/worker/.env:**

```bash
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# MinIO (Local Docker)
MINIO_ENDPOINT_HOST=localhost
MINIO_ENDPOINT_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=pis-photos

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
```

### 4. Start Development Server

```bash
# Terminal 1: Start Worker
cd services/worker
pnpm dev

# Terminal 2: Start Frontend
cd ../..   # Back to project root
pnpm dev
```

### 5. Access Application

| URL | Description |
|-----|-------------|
| http://localhost:3000 | Frontend homepage |
| http://localhost:3000/admin/login | Admin dashboard login |
| http://localhost:9001 | MinIO Console (minioadmin/minioadmin) |

---

## Production Deployment

### Server Side (Docker)

#### 1. Prepare Server

```bash
# Install Docker (Ubuntu/Debian)
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

#### 2. Upload Project Files

Upload the following files to server `/opt/pis/`:

```
/opt/pis/
├── docker/
│   ├── docker-compose.yml
│   ├── worker.Dockerfile
│   └── nginx/
│       └── media.conf
├── services/
│   └── worker/
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
└── .env
```

#### 3. Configure Environment Variables

Create `/opt/pis/.env`:

```bash
# Supabase
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# MinIO (Custom strong password!)
MINIO_ACCESS_KEY=your-strong-access-key
MINIO_SECRET_KEY=your-strong-secret-key-at-least-8-chars

# Redis
REDIS_HOST=redis
REDIS_PORT=6379
```

#### 4. Start Services

```bash
cd /opt/pis/docker
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f
```

#### 5. Configure Nginx Reverse Proxy

Create `/etc/nginx/sites-available/media.yourdomain.com`:

```nginx
server {
    listen 80;
    server_name media.yourdomain.com;

    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name media.yourdomain.com;

    # SSL Certificate (Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/media.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/media.yourdomain.com/privkey.pem;

    # Allow large file uploads
    client_max_body_size 100M;

    location / {
        proxy_pass http://127.0.0.1:9000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Cache static resources
        proxy_cache_valid 200 7d;
        add_header Cache-Control "public, max-age=604800";

        # CORS
        add_header Access-Control-Allow-Origin "*";
        add_header Access-Control-Allow-Methods "GET, HEAD, OPTIONS";
    }
}
```

Enable configuration:
```bash
sudo ln -s /etc/nginx/sites-available/media.yourdomain.com /etc/nginx/sites-enabled/
sudo certbot --nginx -d media.yourdomain.com
sudo nginx -t && sudo nginx -s reload
```

### Vercel Deployment

#### 1. Connect Repository

1. Visit [https://vercel.com](https://vercel.com) and log in
2. Click **Add New Project**
3. Select your GitHub repository

#### 2. Configure Build

| Configuration | Value |
|--------------|-------|
| Framework Preset | Next.js |
| Root Directory | `apps/web` |
| Build Command | `pnpm build` |
| Install Command | `pnpm install` |

#### 3. Configure Environment Variables

In **Settings** → **Environment Variables** add:

**Required Variables:**
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_APP_URL=https://yourdomain.com
NEXT_PUBLIC_MEDIA_URL=https://media.yourdomain.com/pis-photos
NEXT_PUBLIC_WORKER_URL=https://worker.yourdomain.com
WORKER_API_KEY=your-generated-api-key
```

**Optional Variables (Recommended):**
```
NEXT_PUBLIC_PHOTOGRAPHER_NAME=Your Studio Name
NEXT_PUBLIC_PHOTOGRAPHER_TAGLINE=Professional Photography
NEXT_PUBLIC_TURNSTILE_SITE_KEY=your-turnstile-site-key
TURNSTILE_SECRET_KEY=your-turnstile-secret-key
```

> 💡 **Note**: 
> - All URLs should use `https://` in production
> - `NEXT_PUBLIC_*` variables are exposed to the browser
> - Never set sensitive keys as `NEXT_PUBLIC_*`

#### 4. Deploy

Click **Deploy**, wait for build to complete.

#### 5. Bind Domain

1. **Settings** → **Domains**
2. Add `yourdomain.com`
3. Configure DNS as prompted (CNAME or A record)

---

## Environment Variables

### Frontend (Vercel / apps/web/.env.local)

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | `https://xxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key | `eyJ...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | `eyJ...` |
| `NEXT_PUBLIC_APP_URL` | Application access URL | `https://yourdomain.com` |
| `NEXT_PUBLIC_MEDIA_URL` | Media CDN address | `https://media.yourdomain.com/pis-photos` |

### Worker (Docker / .env)

| Variable | Description | Example |
|----------|-------------|---------|
| `SUPABASE_URL` | Supabase project URL | `https://xxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | `eyJ...` |
| `MINIO_ENDPOINT_HOST` | MinIO host | `minio` (Docker) / `localhost` |
| `MINIO_ENDPOINT_PORT` | MinIO port | `9000` |
| `MINIO_USE_SSL` | Use SSL | `false` |
| `MINIO_ACCESS_KEY` | MinIO access key | Custom strong password |
| `MINIO_SECRET_KEY` | MinIO secret key | Custom strong password (≥8 chars) |
| `MINIO_BUCKET` | Bucket name | `pis-photos` |
| `REDIS_HOST` | Redis host | `redis` (Docker) / `localhost` |
| `REDIS_PORT` | Redis port | `6379` |

---

## Verification & Testing

### 1. Check Docker Services

```bash
# Check service status
docker-compose ps

# Expected output:
# NAME            STATUS
# pis-minio       Up (healthy)
# pis-redis       Up (healthy)
# pis-worker      Up

# MinIO health check
curl http://localhost:9000/minio/health/live
# Expected: OK

# Redis connection test
docker exec pis-redis redis-cli ping
# Expected: PONG
```

### 2. Test Complete Flow

1. Visit `https://yourdomain.com/admin/login`
2. Log in with admin account
3. Create new album
4. Upload test image
5. Observe Worker logs: `docker-compose logs -f worker`
6. Confirm image processing completed (status becomes completed)
7. Copy album link, test guest access in incognito mode

### 3. Performance Check

```bash
# Lighthouse test
npx lighthouse https://yourdomain.com --view

# Target metrics:
# - FCP < 1.5s
# - LCP < 2.5s
# - Score > 90
```

---

## Maintenance & Operations

### Common Commands

```bash
# View logs
docker-compose logs -f [service]

# Restart service
docker-compose restart [service]

# Update Worker code
docker-compose build worker
docker-compose up -d worker

# Clean unused images
docker system prune -a
```

### Data Backup

```bash
# Backup MinIO data
docker run --rm \
  -v pis_minio_data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/minio-backup-$(date +%Y%m%d).tar.gz /data

# Restore MinIO data
docker run --rm \
  -v pis_minio_data:/data \
  -v $(pwd):/backup \
  alpine tar xzf /backup/minio-backup.tar.gz -C /

# Supabase data export
# In Dashboard → Settings → Database → Backups
```

### Monitoring Recommendations

- **Uptime Kuma**: Monitor service availability
- **Grafana + Prometheus**: Docker container monitoring
- **Sentry**: Frontend error tracking

---

## Troubleshooting

### Worker Cannot Connect to MinIO

```bash
# Check Docker network
docker network ls
docker-compose exec worker ping minio

# Confirm MinIO environment variables
docker-compose exec worker env | grep MINIO
```

### Images Cannot Display

1. Check if MinIO Bucket exists and has permissions
   ```bash
   docker exec pis-minio mc ls local/pis-photos
   ```
2. Check Nginx reverse proxy logs
   ```bash
   tail -f /var/log/nginx/error.log
   ```
3. Verify `NEXT_PUBLIC_MEDIA_URL` is configured correctly

### Supabase Connection Failed

1. Verify API Keys are correct (note anon vs service_role)
2. Check if RLS policies are blocking access
3. View Supabase Dashboard → Logs

### Upload Failed

1. Check Nginx `client_max_body_size` configuration
2. Verify MinIO credentials are correct
3. View Worker logs:
   ```bash
   docker-compose logs -f worker
   ```

### Login Loop Issue

1. Clear browser Cookies (all starting with `sb-`)
2. Verify Supabase Auth URLs configuration is correct
3. Check Middleware logs

---

## Security Recommendations

### Must Do

- [ ] Change default MinIO password
- [ ] Use HTTPS
- [ ] Service ports only listen on 127.0.0.1
- [ ] Regular data backups
- [ ] Protect `SUPABASE_SERVICE_ROLE_KEY`

### Recommended

- [ ] Configure firewall rules
- [ ] Enable Supabase MFA
- [ ] Set up log rotation
- [ ] Configure monitoring alerts

---

## Support

If you encounter issues:

1. Check the troubleshooting section in this document
2. Search GitHub Issues
3. Submit a new Issue with:
   - Error logs
   - Environment information (OS, Docker version)
   - Reproduction steps
