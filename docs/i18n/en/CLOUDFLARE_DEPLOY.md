# Cloudflare Deployment Guide

> Author: junyuzhan (junyuzhan@outlook.com)  
> License: MIT

## 📋 Overview

PIS can be partially deployed to Cloudflare platform, leveraging Cloudflare's global CDN and edge computing capabilities.

## 🎯 Deployment Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    User Access                           │
└─────────────────────┬───────────────────────────────────┘
                      │
        ┌─────────────┼─────────────┐
        ▼             ▼             ▼
┌──────────────┐ ┌──────────┐ ┌──────────────┐
│ Cloudflare   │ │ Supabase │ │ Local Server │
│   Pages      │ │  Cloud   │ │   (MinIO)    │
│  (Next.js)   │ │          │ │  (Storage)   │
└──────┬───────┘ └──────────┘ └──────┬───────┘
       │                              │
       │ API Calls                    │
       ▼                              │
┌─────────────────────────────────────┼──────┐
│   Worker Service (Independent Server) │     │
│  • Image Processing (Sharp)          │     │
│  • Task Queue (Redis)                │     │
│  • MinIO Access                      │◄────┘
└─────────────────────────────────────────────┘
```

## ✅ What Can Be Deployed to Cloudflare

### 1. **Frontend → Cloudflare Pages**

Next.js frontend can be fully deployed to Cloudflare Pages:

- ✅ Static pages and SSR
- ✅ API Routes (with limitations)
- ✅ Edge computing capabilities
- ✅ Global CDN acceleration
- ✅ Generous free tier

### 2. **Object Storage → Local MinIO (via FRP)**

Keep using local MinIO and expose it via FRP:

- ✅ Full control over storage
- ✅ No additional storage costs
- ✅ Access via custom domain (e.g., `media.yourdomain.com`)
- ✅ Worker service can access MinIO directly on local network

**Note:** You can also use Cloudflare R2 if preferred (see alternative configuration in docs).

## ⚠️ Limitations and Challenges

### 1. **Worker Service Cannot Deploy to Cloudflare Workers**

**Technical Limitations:**

1. **Sharp Library Not Supported**
   - ❌ Sharp requires native C++ modules and system libraries (libvips, libheif)
   - ❌ Cloudflare Workers use V8 Isolate, which doesn't support native Node.js modules
   - ❌ Workers run in a sandboxed environment without system dependencies

2. **CPU Time Limits**
   - ❌ Free tier: 10ms CPU time limit
   - ❌ Paid tier: 50ms CPU time limit  
   - ❌ Image processing typically takes 100ms - 5 seconds per photo
   - ❌ Even with Cloudflare Image bindings, complex processing exceeds limits

3. **No Persistent Connections**
   - ❌ BullMQ requires persistent Redis connections
   - ❌ Workers don't support long-lived connections
   - ❌ Upstash Redis can work, but BullMQ's connection model may not be compatible

4. **HTTP Server Architecture**
   - ❌ Current worker runs a Node.js HTTP server
   - ❌ Workers are request-based, not server-based

**Possible Solutions:**

1. **Keep Worker on Independent Server** (Recommended)
   - ✅ No code changes needed
   - ✅ Full control over processing time
   - ✅ Can use Sharp and all native libraries
   - ✅ Better for heavy image processing workloads

2. **Use Cloudflare Image Bindings** (Requires Major Refactoring)
   - ⚠️ Replace Sharp with Cloudflare's native image transformations
   - ⚠️ Limited functionality compared to Sharp
   - ⚠️ No HEIC support, limited watermark options
   - ⚠️ Need to rewrite `PhotoProcessor` class
   - ⚠️ Still need external server for queue management

3. **Hybrid Approach** (Partial Migration)
   - ✅ Deploy lightweight APIs (health check, presign URLs) to Workers
   - ✅ Keep image processing on independent server
   - ⚠️ Requires splitting the worker into multiple services

**Recommendation:**
For PIS, **keep the worker service on an independent server**. The current architecture is optimized for heavy image processing workloads, and migrating to Cloudflare Workers would require:
- Complete rewrite of image processing logic
- Loss of HEIC support and advanced watermark features
- Significant performance limitations
- Complex queue management refactoring

The hybrid deployment (Pages on Cloudflare + Worker on server) provides the best balance of performance, cost, and functionality.

### 2. **Redis Queue**

Cloudflare doesn't provide Redis service, need to:
- Use third-party Redis service (e.g., Upstash Redis)
- Or continue using Redis on independent server

## 🚀 Deployment Steps

### Step 1: Configure Cloudflare R2

1. **Create R2 Bucket**
   ```bash
   # Create R2 Bucket in Cloudflare Dashboard
   # Name: pis-photos
   ```

2. **Get R2 Credentials**
   - In Cloudflare Dashboard → R2 → Manage R2 API Tokens
   - Create API Token, record:
     - Account ID
     - Access Key ID
     - Secret Access Key

3. **Configure Environment Variables**
   ```bash
   # Worker service configuration
   STORAGE_TYPE=s3
   STORAGE_ENDPOINT=<account-id>.r2.cloudflarestorage.com
   STORAGE_ACCESS_KEY=<access-key-id>
   STORAGE_SECRET_KEY=<secret-access-key>
   STORAGE_BUCKET=pis-photos
   STORAGE_USE_SSL=true
   STORAGE_PUBLIC_URL=https://pub-<account-id>.r2.dev
   ```

### Step 2: Deploy Frontend to Cloudflare Pages

#### Method A: Via Wrangler CLI

1. **Install Wrangler**
   ```bash
   npm install -g wrangler
   ```

2. **Login to Cloudflare**
   ```bash
   wrangler login
   ```

3. **Create `wrangler.toml`**
   ```toml
   name = "pis-web"
   compatibility_date = "2024-01-01"
   pages_build_output_dir = "apps/web/.next"

   [env.production]
   vars = { NODE_ENV = "production" }
   ```

4. **Build and Deploy**
   ```bash
   cd apps/web
   pnpm build
   wrangler pages deploy .next
   ```

#### Method B: Via GitHub Actions (Recommended)

1. **Connect GitHub repository in Cloudflare Dashboard**

2. **Configure Build Settings**
   - Build command: `CF_PAGES=1 pnpm install && pnpm build`
   - Build output directory: `apps/web/.next`
   - Root directory: `/`

3. **Set Environment Variables**
   ```
   # Supabase
   NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   
   # Media URL (Use local MinIO via FRP proxy, e.g., https://media.yourdomain.com)
   NEXT_PUBLIC_MEDIA_URL=https://media.yourdomain.com
   
   # App URL
   NEXT_PUBLIC_APP_URL=https://your-app.pages.dev
   
   # Worker API (Use local Worker via FRP proxy, e.g., https://worker.yourdomain.com)
   WORKER_API_URL=https://worker.yourdomain.com
   NEXT_PUBLIC_WORKER_URL=https://worker.yourdomain.com
   ```

### Step 3: Configure Local MinIO Access (via FRP)

If you're using local MinIO instead of Cloudflare R2, you need to expose it via FRP (Fast Reverse Proxy):

1. **Configure FRP on your server** (e.g., using frpc)
   ```toml
   # frpc.toml
   [[proxies]]
   name = "pis-media"
   type = "http"
   localIP = "localhost"
   localPort = 9000
   customDomains = ["media.yourdomain.com"]
   
   [[proxies]]
   name = "pis-worker"
   type = "http"
   localIP = "localhost"
   localPort = 3001
   customDomains = ["worker.yourdomain.com"]
   ```

2. **Update Worker service environment variables** (keep using local MinIO):
   ```bash
   # In .env.local or docker-compose.yml on server
   STORAGE_TYPE=minio
   STORAGE_ENDPOINT=localhost  # or 'minio' if using Docker Compose
   STORAGE_PORT=9000
   STORAGE_USE_SSL=false
   STORAGE_ACCESS_KEY=your-access-key
   STORAGE_SECRET_KEY=your-secret-key
   STORAGE_BUCKET=pis-photos
   STORAGE_PUBLIC_URL=https://media.yourdomain.com
   ```

### Step 4: Configure CORS (if using local MinIO)

Configure CORS in MinIO Console or via `mc` command:

```bash
# Using MinIO Client
mc cors set download,upload,public pis/pis-photos
```

Or configure in MinIO Console:
- Go to Bucket → Access Policy → CORS Configuration
- Add CORS rule:
  ```json
  [
    {
      "AllowedOrigins": ["https://your-app.pages.dev"],
      "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
      "AllowedHeaders": ["*"],
      "ExposeHeaders": ["ETag"],
      "MaxAgeSeconds": 3600
    }
  ]
  ```

## 📝 Environment Variables

### Cloudflare Pages Environment Variables

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Media URL (R2 Public URL)
NEXT_PUBLIC_MEDIA_URL=https://pub-<account-id>.r2.dev

# App URL
NEXT_PUBLIC_APP_URL=https://your-app.pages.dev

# Worker API (Independent Server)
WORKER_API_URL=https://your-worker-server.com:3001
NEXT_PUBLIC_WORKER_URL=https://your-worker-server.com:3001
```

### Worker Service Environment Variables

```bash
# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Cloudflare R2 (Using S3-compatible mode)
STORAGE_TYPE=s3
STORAGE_ENDPOINT=<account-id>.r2.cloudflarestorage.com
STORAGE_ACCESS_KEY=<access-key-id>
STORAGE_SECRET_KEY=<secret-access-key>
STORAGE_BUCKET=pis-photos
STORAGE_USE_SSL=true
STORAGE_PUBLIC_URL=https://pub-<account-id>.r2.dev

# Redis (Use Upstash or other Redis service)
REDIS_HOST=your-redis-host.upstash.io
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password
```

## 🔧 Alternative: Use Upstash Redis

If you don't want to run Redis on an independent server, you can use Upstash Redis:

1. **Sign up for Upstash**
   - Visit https://upstash.com/
   - Create Redis database

2. **Get Connection Info**
   ```bash
   REDIS_HOST=your-redis.upstash.io
   REDIS_PORT=6379
   REDIS_PASSWORD=your-password
   ```

3. **Update Worker Configuration**
   ```bash
   # In docker-compose.yml or environment variables
   REDIS_HOST=your-redis.upstash.io
   REDIS_PORT=6379
   REDIS_PASSWORD=your-password
   ```

## 💰 Cost Estimation

### Cloudflare Pages
- ✅ **Free Tier**: 500 builds/month, unlimited requests
- 💰 **Paid**: $20/month (unlimited builds)

### Cloudflare R2
- ✅ **Free Tier**: 10GB storage, 1000 Class A operations/day
- 💰 **Paid**: 
  - Storage: $0.015/GB/month
  - Class A operations: $4.50/million
  - Class B operations: $0.36/million
  - **No egress fees** (biggest advantage)

### Comparison with Self-hosted MinIO
- ❌ Requires server costs
- ❌ Requires bandwidth costs
- ✅ R2 has no egress fees, lower cost

## 🎯 Complete Deployment Architecture

```
User
 │
 ├─→ Cloudflare Pages (Next.js Frontend)
 │      │
 │      ├─→ Supabase (Database + Auth)
 │      │
 │      └─→ Worker API (Independent Server)
 │             │
 │             ├─→ Cloudflare R2 (Image Storage)
 │             │
 │             └─→ Upstash Redis (Task Queue)
```

## 📚 References

- [Cloudflare Pages Documentation](https://developers.cloudflare.com/pages/)
- [Cloudflare R2 Documentation](https://developers.cloudflare.com/r2/)
- [Upstash Redis Documentation](https://docs.upstash.com/redis)

## ⚠️ Important Notes

1. **Worker Service Still Needs Independent Server**
   - Image processing tasks cannot run in Cloudflare Workers
   - Need to maintain existing Worker service deployment

2. **R2 Public Access**
   - R2 is private by default, need to configure public access or use presigned URLs
   - Recommend using presigned URLs for better security

3. **CORS Configuration**
   - Ensure R2 Bucket CORS configuration is correct
   - Allow requests from Pages domain

4. **Environment Variable Management**
   - Use Cloudflare Pages environment variable feature
   - Use Secrets for sensitive information (Wrangler)

## 🚀 Quick Start

1. **Create R2 Bucket and get credentials**
2. **Connect GitHub repository in Cloudflare Dashboard**
3. **Configure Pages build settings and environment variables**
4. **Update Worker service to use R2**
5. **Deploy and test**

---

**Summary**: Cloudflare can deploy frontend and storage, but Worker service still needs an independent server. This is currently the most cost-effective hybrid deployment solution.
