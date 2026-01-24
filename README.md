# 📸 PIS - Private Instant Photo Sharing

> A self-hosted photo delivery system designed for photographers

<p align="center">
  <a href="https://github.com/junyuzhan/pis/stargazers">
    <img src="https://img.shields.io/github/stars/junyuzhan/pis?style=social" alt="GitHub stars" />
  </a>
</p>

<p align="center">
  <a href="https://star-history.com/#junyuzhan/pis&Date">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=junyuzhan/pis&type=Date&theme=dark" />
      <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=junyuzhan/pis&type=Date" />
      <img src="https://api.star-history.com/svg?repos=junyuzhan/pis&type=Date" alt="Star History Chart" />
    </picture>
  </a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-15-black?style=flat-square&logo=next.js" alt="Next.js 15" />
  <img src="https://img.shields.io/badge/TypeScript-5.0-blue?style=flat-square&logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?style=flat-square&logo=supabase" alt="Supabase" />
  <img src="https://img.shields.io/badge/MinIO-Object%20Storage-C72E49?style=flat-square&logo=minio" alt="MinIO" />
</p>

<p align="center">
  <a href="README.zh-CN.md">中文</a> | <a href="README.md">English</a>
</p>

---

## 🌟 Why Choose PIS?

### ⚡ **Instant Delivery**
- **Minutes-level delivery** - Clients see photos immediately after shooting
- **Real-time sync** - Upload and view instantly with Supabase Realtime
- **Professional workflow** - Streamlined photo delivery process

### 🔒 **Complete Privacy Control**
- **Self-hosted** - Full control over your data and client privacy
- **No third-party dependencies** - Store everything on your own servers
- **GDPR compliant** - Perfect for professional photographers who value privacy

### 💰 **Cost-Effective & Flexible**
- **Multiple storage options** - Choose the best fit for your needs:
  - MinIO (Self-hosted, zero cost)
  - Alibaba Cloud OSS (China)
  - Tencent Cloud COS (China)
  - AWS S3 (Global)
- **Pay-as-you-go** - Only pay for what you use
- **No vendor lock-in** - Easy to switch storage providers

### 🖼️ **Advanced Watermarking**
- **Multi-position support** - Up to 6 watermarks simultaneously
- **9-position grid** - Flexible placement options
- **Text & Logo** - Support both text and image watermarks
- **Copyright protection** - Professional-grade watermarking

### 🎨 **Professional Presentation**
- **Dark mode interface** - Immersive viewing experience
- **Photo-first design** - Beautiful masonry layout
- **Mobile optimized** - Perfect viewing on all devices
- **Lightbox mode** - Full-screen photo viewing with keyboard navigation

### 🚀 **Production Ready**
- **One-click deployment** - Docker Compose setup
- **Auto-scaling** - Queue-based image processing
- **Health monitoring** - Built-in health check endpoints
- **CI/CD ready** - GitHub Actions integration

### 🔧 **Developer Friendly**
- **Modern stack** - Next.js 15, TypeScript, Supabase
- **Well documented** - Comprehensive guides in English & Chinese
- **Easy to extend** - Modular architecture
- **Open source** - MIT License

---

## ✨ Features

- 🚀 **Instant Delivery** - Minutes-level delivery after shooting, clients see photos immediately
- 🎨 **Professional Display** - Immersive dark interface with photo-first visual design
- 🔒 **Self-Hosted** - Data stored on your own server, complete privacy control
- 💰 **Cost-Effective** - Support multiple storage solutions (MinIO/OSS/COS/S3), flexible choices
- ⚡ **Real-time Sync** - Based on Supabase Realtime, upload and see instantly
- 🖼️ **Smart Watermarking** - Support text/Logo watermarks to protect copyright
- 🌍 **Multi-language Support** - Built-in i18n support (English, Chinese)
- 🔌 **Flexible Extension** - Support multiple storage and databases for different deployment needs

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      User Browser                           │
└─────────────────────────┬───────────────────────────────────┘
                          │
          ┌───────────────┴───────────────┐
          ▼                               ▼
┌──────────────────┐            ┌──────────────────────────────┐
│   Vercel Frontend│            │    Database Layer (Optional) │
│   Next.js 15     │◄──────────►│  Supabase / PostgreSQL / MySQL│
│   App Router     │            └──────────────────────────────┘
└────────┬─────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────┐
│                  Server (Docker)                            │
│  ┌─────────┐    ┌─────────┐    ┌──────────────────────────┐  │
│  │ Storage │◄───│  Redis  │◄───│  Worker (Sharp Processing)│  │
│  │ MinIO/  │    │  Queue │    │  Thumb/Watermark/EXIF/   │  │
│  │ OSS/COS │    │         │    │  BlurHash                │  │
│  │ /S3     │    │         │    │                          │  │
│  └─────────┘    └─────────┘    └──────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

**Supported Storage Services:**
- MinIO (Self-hosted, recommended for private deployment)
- Alibaba Cloud OSS (For users in China)
- Tencent Cloud COS (For users in China)
- AWS S3 (For overseas users)

**Supported Databases:**
- Supabase (Recommended, includes Auth + Realtime)
- PostgreSQL (Native)
- MySQL (In development)

---

## 📦 Project Structure

```
pis/
├── apps/
│   └── web/                 # Next.js frontend application
│       ├── src/
│       │   ├── app/         # App Router pages
│       │   ├── components/  # React components
│       │   ├── hooks/       # Custom Hooks
│       │   └── lib/         # Utilities
│       └── ...
├── services/
│   └── worker/              # Image processing Worker
│       └── src/
│           ├── index.ts     # BullMQ Worker entry
│           ├── processor.ts # Sharp image processing
│           └── lib/         # Storage/Database clients
├── database/
│   └── migrations/          # SQL migration scripts
├── docker/
│   ├── docker-compose.yml   # Docker orchestration
│   ├── worker.Dockerfile    # Worker image
│   └── nginx/               # Nginx configuration
├── docs/                    # Project documentation
└── .env.example             # Environment variables template
```

---

## 🚀 Quick Start

### Prerequisites

- Node.js >= 20.0.0
- pnpm >= 9.0.0
- Docker & Docker Compose
- Supabase account ([Free signup](https://supabase.com))

### One-Click Setup (Recommended)

```bash
# Clone the repository
git clone https://github.com/junyuzhan/pis.git
cd pis

# Install dependencies
pnpm install

# Start guided setup
pnpm setup
```

The setup wizard will automatically:
- ✅ Check system dependencies
- ✅ Configure environment variables (interactive Supabase credentials)
- ✅ Select storage type (MinIO/OSS/COS/S3)
- ✅ Start Docker services (MinIO + Redis)
- ✅ Display next steps

> 💡 **Tip**: You can also manually configure storage and database types. See [Storage Configuration](docs/i18n/en/STORAGE_CONFIG.md) and [Database Configuration](docs/i18n/en/DATABASE_CONFIG.md)

### Manual Setup

<details>
<summary>Click to expand manual setup steps</summary>

#### 1. Configure Supabase

1. Create a [Supabase](https://supabase.com) project
2. In SQL Editor, execute the following migration files in order:
   - `database/migrations/001_init.sql` - Initialize database structure
   - `database/migrations/002_secure_rls.sql` - Fix RLS security policies
   - `database/migrations/003_album_features.sql` - Add album advanced features
   - `database/migrations/004_album_templates.sql` - Add album templates (optional)
   - `database/migrations/005_package_downloads.sql` - Add package downloads (optional)
   - `database/migrations/006_album_share_config.sql` - Add album share config (optional)
   - `database/migrations/007_photo_groups.sql` - Add photo groups (optional)
   - `database/migrations/008_album_event_metadata.sql` - Add album event metadata (optional)
3. Create admin account in Authentication > Users
4. Copy API Keys (Settings → API)

#### 2. Configure Environment Variables

**Frontend Configuration** (`apps/web/.env.local`):
```bash
# Database configuration
DATABASE_TYPE=supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Storage configuration (default: MinIO)
STORAGE_TYPE=minio
NEXT_PUBLIC_MEDIA_URL=http://localhost:9000/pis-photos

# Application configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**Worker Configuration** (`services/worker/.env`):
```bash
# Database configuration
DATABASE_TYPE=supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Storage configuration (default: MinIO)
STORAGE_TYPE=minio
STORAGE_ENDPOINT=localhost
STORAGE_PORT=9000
STORAGE_USE_SSL=false
STORAGE_ACCESS_KEY=minioadmin
STORAGE_SECRET_KEY=minioadmin
STORAGE_BUCKET=pis-photos

# Redis configuration
REDIS_HOST=localhost
REDIS_PORT=6379
```

> 💡 **Using cloud storage?** See [Storage Configuration](docs/i18n/en/STORAGE_CONFIG.md) for Alibaba Cloud OSS, Tencent Cloud COS, or AWS S3 setup

#### 3. Start Services

```bash
# Start Docker services
pnpm docker:up

# Start development server
pnpm dev
```

</details>

### Access the Application

| URL | Description |
|-----|-------------|
| http://localhost:3000 | Homepage |
| http://localhost:3000/admin/login | Admin dashboard |
| http://localhost:9001 | MinIO Console |

---

## 🌐 Production Deployment

### Deployment Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────────────┐
│  Supabase   │     │   Vercel    │     │   Your Server       │
│  (Database) │     │  (Frontend) │     │  (MinIO + Worker)   │
└─────────────┘     └─────────────┘     └─────────────────────┘
```

### Deployment Steps

#### Step 1: Configure Supabase (5 minutes)

1. [supabase.com](https://supabase.com) → Create project
2. SQL Editor → Execute migration files in order (see manual setup)
3. Authentication → Users → Create admin account
4. Record Project URL + API Keys

#### Step 2: Deploy Server (10 minutes)

```bash
# Upload project to server /opt/pis/

# Create environment variables
cat > /opt/pis/.env << EOF
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
MINIO_ACCESS_KEY=your-strong-password
MINIO_SECRET_KEY=your-strong-password-8chars
EOF

# Start services
cd /opt/pis/docker
docker-compose up -d
```

Configure Nginx reverse proxy: `media.yourdomain.com` → `localhost:9000`

#### Step 3: Deploy Vercel (5 minutes)

1. [vercel.com](https://vercel.com) → Import GitHub repository
2. Root Directory: `apps/web`
3. Add environment variables:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_APP_URL=https://yourdomain.com
NEXT_PUBLIC_MEDIA_URL=https://media.yourdomain.com/pis-photos
```

4. Deploy → Bind custom domain

#### Verify Deployment

```bash
# Check service status
docker-compose ps

# View Worker logs
docker-compose logs -f worker
```

Visit `https://yourdomain.com/admin/login` to test login

> 📖 Detailed documentation: [docs/i18n/en/DEPLOYMENT.md](docs/i18n/en/DEPLOYMENT.md)

---

## 📖 Features

### Admin Features

| Feature | Description |
|---------|-------------|
| Album Management | Create, edit, delete albums |
| Batch Album Management | Batch select and delete multiple albums |
| Album Duplication | One-click copy album configuration |
| Album Templates | Create and manage album configuration templates |
| Album Event Metadata | Set event time and location, displayed on album cover |
| Photo Upload | Batch upload, supports JPG/PNG/HEIC |
| Batch Photo Management | Batch select, delete, quick set cover |
| Photo Deletion | Single and batch photo deletion |
| Package Download | Generate ZIP files with watermarked and original versions |
| Multi-position Watermarking | Support up to 6 watermarks, flexible 9-position configuration |
| WeChat Share Optimization | Custom share card (title, description, image) |
| Access Control | Public/private albums, download permissions |
| Photo Sorting | Manual sorting or by capture time |

### Guest Features

| Feature | Description |
|---------|-------------|
| Album Browsing | Masonry layout, infinite scroll |
| Large Image View | Lightbox mode with keyboard navigation |
| EXIF Display | Show camera parameter information |
| Original Download | Admin-controlled download permissions |
| Photo Selection | Guest selection visible to admin |

---

## 🛠️ Common Commands

```bash
# Deployment & Configuration
pnpm setup           # Start guided setup
pnpm docker:up       # Start Docker services
pnpm docker:down     # Stop Docker services
pnpm docker:logs    # View Docker logs

# Development
pnpm dev             # Start development server
pnpm build           # Build production version
pnpm lint            # Code linting
pnpm format          # Format code

# Database
pnpm db:types        # Generate Supabase types
```

---

## 📁 Environment Variables

### Database Configuration

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_TYPE` | Database type: `supabase`(recommended), `postgresql`, `mysql` | ✅ |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (when using Supabase) | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | ✅ |

### Storage Configuration

| Variable | Description | Required |
|----------|-------------|----------|
| `STORAGE_TYPE` | Storage type: `minio`(default), `oss`, `cos`, `s3` | ✅ |
| `STORAGE_ENDPOINT` | Storage service endpoint | ✅ |
| `STORAGE_ACCESS_KEY` | Storage access key | ✅ |
| `STORAGE_SECRET_KEY` | Storage secret key | ✅ |
| `STORAGE_BUCKET` | Storage bucket name | ✅ |
| `NEXT_PUBLIC_MEDIA_URL` | Media file CDN address | ✅ |

### Application Configuration

| Variable | Description | Required |
|----------|-------------|----------|
| `NEXT_PUBLIC_APP_URL` | Application access URL | ✅ |
| `REDIS_*` | Redis queue configuration | Worker |

> 📖 Detailed configuration guides:
> - [Storage Configuration](docs/i18n/en/STORAGE_CONFIG.md) - MinIO, Alibaba Cloud OSS, Tencent Cloud COS, AWS S3
> - [Database Configuration](docs/i18n/en/DATABASE_CONFIG.md) - Supabase, PostgreSQL, MySQL

---

## 🔧 FAQ

<details>
<summary><strong>Q: Images don't display after upload?</strong></summary>

1. Check if Worker is running: `docker-compose logs worker`
2. Verify MinIO Bucket permissions are configured correctly
3. Check if `NEXT_PUBLIC_MEDIA_URL` is correct

</details>

<details>
<summary><strong>Q: Login redirect loop?</strong></summary>

1. Clear browser cookies (especially those starting with `sb-`)
2. Verify Supabase Auth Redirect URLs configuration
3. Check `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`

</details>

<details>
<summary><strong>Q: How to backup data?</strong></summary>

```bash
# Backup MinIO data
docker run --rm -v pis_minio_data:/data -v $(pwd):/backup \
  alpine tar czf /backup/minio-backup.tar.gz /data

# Supabase data can be exported from Dashboard
# PostgreSQL: Use pg_dump
# MySQL: Use mysqldump
```

</details>

<details>
<summary><strong>Q: How to switch to Alibaba Cloud OSS?</strong></summary>

1. Configure in `services/worker/.env`:
```bash
STORAGE_TYPE=oss
STORAGE_ENDPOINT=oss-cn-hangzhou.aliyuncs.com
STORAGE_REGION=cn-hangzhou
STORAGE_ACCESS_KEY=your-access-key-id
STORAGE_SECRET_KEY=your-access-key-secret
STORAGE_BUCKET=your-bucket-name
STORAGE_PUBLIC_URL=https://your-bucket-name.oss-cn-hangzhou.aliyuncs.com
STORAGE_USE_SSL=true
```

2. Restart Worker: `docker-compose restart worker`

See [Storage Configuration](docs/i18n/en/STORAGE_CONFIG.md) for details

</details>

<details>
<summary><strong>Q: What storage and databases are supported?</strong></summary>

**Storage Support:**
- ✅ MinIO (default, self-hosted)
- ✅ Alibaba Cloud OSS
- ✅ Tencent Cloud COS
- ✅ AWS S3

**Database Support:**
- ✅ Supabase (recommended, includes Auth + Realtime)
- 🚧 PostgreSQL (interface implemented)
- 🚧 MySQL (interface implemented)

See:
- [Storage Configuration](docs/i18n/en/STORAGE_CONFIG.md)
- [Database Configuration](docs/i18n/en/DATABASE_CONFIG.md)

</details>

---

## 📄 License

MIT License © 2026 junyuzhan

See [LICENSE](LICENSE) file for details.

---

## 👤 Author

**junyuzhan**
- Email: junyuzhan@outlook.com
- GitHub: [@junyuzhan](https://github.com/junyuzhan)

## 🤝 Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

See [AUTHORS.md](AUTHORS.md) for the list of contributors.

---

## 🙏 Acknowledgments

- [Next.js](https://nextjs.org/) - React framework
- [Supabase](https://supabase.com/) - Backend as a service
- [MinIO](https://min.io/) - Object storage
- [Sharp](https://sharp.pixelplumbing.com/) - Image processing
- [Tailwind CSS](https://tailwindcss.com/) - CSS framework

---

## 📚 Documentation

### Getting Started
- [Deployment Guide](docs/i18n/en/DEPLOYMENT.md) - Detailed deployment steps
- [Storage Configuration](docs/i18n/en/STORAGE_CONFIG.md) - MinIO/OSS/COS/S3 configuration
- [Database Configuration](docs/i18n/en/DATABASE_CONFIG.md) - Supabase/PostgreSQL/MySQL configuration
- [Multi-Storage & Database Support](docs/i18n/en/MULTI_STORAGE_DATABASE.md) - Feature guide and migration

### Development & Security
- [Development Guide](docs/DEVELOPMENT.md) - Development setup, code standards, and feature documentation
- [Security Guide](docs/SECURITY.md) - Security best practices, deployment checklist, and pre-open source security checklist
- [Performance Optimization](docs/PERFORMANCE_OPTIMIZATION.md) - Performance optimization guide

---

## 🌍 Language

- [English](README.md) (Current)
- [中文 (Chinese)](README.zh-CN.md)

---

## ☕ Support

If you find this project helpful, consider supporting the project! Your support helps:
- 🐛 Fix bugs faster
- ✨ Add new features
- 📚 Improve documentation
- 🎨 Enhance user experience

<p align="center">
  <table>
    <tr>
      <td align="center">
        <img src="./assets/support/WeChat.jpg" alt="WeChat Pay" width="200" />
        <br />
        <strong>WeChat Pay</strong>
      </td>
      <td align="center" style="padding-left: 30px;">
        <img src="./assets/support/Alipay.jpg" alt="Alipay" width="200" />
        <br />
        <strong>Alipay</strong>
      </td>
    </tr>
  </table>
</p>

<p align="center">
  <strong>Buy me a coffee ☕</strong>
</p>
