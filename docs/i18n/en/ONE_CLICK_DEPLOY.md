# PIS One-Click Deployment Guide

## 🚀 Quick Start

**SSH into your server and run:**

```bash
# Method 1: Download then execute (recommended, supports interactive input)
curl -sSL https://raw.githubusercontent.com/junyuzhan/pis/main/scripts/deploy.sh -o /tmp/deploy.sh
bash /tmp/deploy.sh

# Method 2: Pipe directly (requires environment variables)
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="your-key"
curl -sSL https://raw.githubusercontent.com/junyuzhan/pis/main/scripts/deploy.sh | bash
```

The script will automatically:
- Install Docker, Docker Compose, Git
- Download the latest code
- Guide you through database and network selection
- Start all services

## 📋 Deployment Flow

```
Step 1: Install environment (Docker, Git)
Step 2: Clone code
Step 3: Choose database (Supabase/PostgreSQL/MySQL)
Step 4: Choose network mode (Public/Internal)
Step 5: Configure database credentials
Step 6: Start services
Step 7: Verify services
```

## 🗄️ Database Options

| Type | Recommended For | Features |
|------|-----------------|----------|
| **Supabase** | Production (Recommended) | Cloud-hosted, includes auth |
| **PostgreSQL** | Self-hosted | Local Docker |
| **MySQL** | Self-hosted | Local Docker |

### Getting Supabase Credentials

1. Visit https://supabase.com/dashboard
2. Select project → **Settings** → **API**
3. Copy **Project URL** and **service_role key**

## 📋 Server Requirements

- **OS**: Ubuntu 20.04+ / Debian 11+ / CentOS 7+
- **Specs**: 2 cores, 2GB RAM minimum, 4GB recommended
- **Ports**: 19000, 19001, 3001 (public mode)

## 🔧 Alternative Deployment Methods

### Deploy from Local Machine

If you want to deploy from your local computer to a remote server:

```bash
# Clone the project
git clone https://github.com/junyuzhan/pis.git
cd pis

# Remote deploy
bash scripts/deploy.sh 192.168.1.100 root
```

### Using Environment Variables

Set environment variables to skip manual input:

```bash
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="your-key"

curl -sSL https://raw.githubusercontent.com/junyuzhan/pis/main/scripts/deploy.sh | bash
```

## 🔧 Post-Deployment Configuration

### 1. Access MinIO Console

```
http://your-server-ip:19001
```

### 2. Initialize Database Schema (Supabase)

⚠️ **Important**: Execute `database/full_schema.sql` **once** in Supabase Dashboard → SQL Editor. This file is for **new databases only**.

### 3. Configure Frontend Environment Variables

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<from Dashboard>
NEXT_PUBLIC_MEDIA_URL=http://your-server-ip:19000/pis-photos
NEXT_PUBLIC_WORKER_URL=http://your-server-ip:3001
```

## 🛠️ Common Commands

```bash
# View logs
cd /opt/pis/docker && docker-compose logs -f

# Restart services
cd /opt/pis/docker && docker-compose restart

# Update code
cd /opt/pis && git pull && cd docker && docker-compose up -d --build
```

## ❓ Troubleshooting

**Q: Deployment failed?**

```bash
cd /opt/pis/docker && docker-compose logs
```

**Q: Port already in use?**

```bash
ss -tuln | grep -E ":(19000|19001|3001)"
```

---

**Need help?** [GitHub Issues](https://github.com/junyuzhan/pis/issues)
