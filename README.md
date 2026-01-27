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
  <img src="https://img.shields.io/badge/BullMQ-Redis-FF6B6B?style=flat-square&logo=redis" alt="BullMQ" />
  <img src="https://img.shields.io/badge/Sharp-Image%20Processing-99CC00?style=flat-square" alt="Sharp" />
</p>

<p align="center">
  <a href="README.zh-CN.md">中文</a> | <a href="README.md">English</a>
</p>

---

## 🌟 Features

### ⚡ **Instant Delivery & Sync**
- Minutes-level photo delivery with real-time sync
- Scan & sync via FTP/command line for bulk imports
- Multipart upload for large files

### 🖼️ **Advanced Image Processing**
- Automatic EXIF rotation + manual rotation
- Multiple sizes: thumbnails (400px), previews (2560px), originals
- BlurHash placeholders for smooth loading
- Parallel processing with BullMQ queues (13-33% faster)

### 🎨 **Professional Presentation**
- Beautiful masonry and grid layouts
- Dark mode interface, mobile optimized
- Lightbox mode with keyboard navigation
- Custom splash screens and dynamic poster generation

### 🖼️ **Watermarking & Protection**
- Up to 6 watermarks simultaneously
- Text & logo support, 9-position grid
- EXIF privacy protection (auto-removes GPS data)
- Batch watermarking

### 📦 **Client Features**
- Photo selection and batch ZIP download
- Password protection and expiration dates
- Album templates and view tracking

### 💰 **Flexible Infrastructure**
- **Storage**: MinIO, Alibaba Cloud OSS, Tencent Cloud COS, AWS S3
- **Database**: Supabase (recommended), PostgreSQL, MySQL
- **CDN**: Cloudflare, Alibaba Cloud, Tencent Cloud
- No vendor lock-in, easy to switch providers

### 🚀 **Production Ready**
- One-click deployment with Docker Compose
- Queue-based auto-scaling
- Health monitoring and CI/CD ready

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
git clone https://github.com/JunyuZhan/PIS.git
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

> 💡 **Tip**: You can also manually configure storage and database types. See the [Deployment Guide](docs/i18n/en/DEPLOYMENT.md) for detailed configuration instructions.

### Manual Setup

<details>
<summary>Click to expand manual setup steps</summary>

#### 1. Configure Supabase

1. Create a [Supabase](https://supabase.com) project
2. **Execute database schema**:
   - Go to **SQL Editor** in Supabase Dashboard
   - Copy and paste the entire content of `database/full_schema.sql`
   - Click **Run** to execute
   - ✅ Done!
3. **Create admin account**:
   - Go to **Authentication** → **Users** in Supabase Dashboard
   - Click **Add user** → **Create new user**
   - Fill in:
     - **Email**: Your admin email (e.g., `admin@example.com`)
     - **Password**: Set a strong password
     - ✅ **Auto Confirm User** (check this box)
   - Click **Create user**
   - ✅ This account will be used to log in to `/admin/login`
4. Copy API Keys from **Settings** → **API**

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

> 💡 **Using cloud storage?** See the [Deployment Guide](docs/i18n/en/DEPLOYMENT.md) for Alibaba Cloud OSS, Tencent Cloud COS, or AWS S3 setup instructions

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
| http://localhost:3000/admin/login | Admin dashboard (use the admin account created in Supabase) |
| http://localhost:9001 | MinIO Console (username: `minioadmin`, password: `minioadmin`) |

> 💡 **First time login**: Use the email and password you created in Supabase **Authentication** → **Users** to log in to the admin dashboard.

---

## 🌐 Production Deployment

### One-Click Server Deployment (Recommended)

**SSH into your server and run:**

```bash
# Download and run (recommended, supports interactive input)
curl -sSL https://raw.githubusercontent.com/junyuzhan/pis/main/scripts/deploy.sh -o /tmp/deploy.sh
bash /tmp/deploy.sh
```

The script will guide you through:
- ✅ Install Docker, Docker Compose, and Git
- ✅ Clone latest code from GitHub
- ✅ Choose database (Supabase/PostgreSQL/MySQL)
- ✅ Choose network mode (Public/Internal)
- ✅ Configure and start all services

**Alternative: Deploy from local machine**

```bash
git clone https://github.com/junyuzhan/pis.git
cd pis
bash scripts/deploy.sh 192.168.1.100 root
```

> 📖 **Deployment guide**: [docs/i18n/en/DEPLOYMENT.md](docs/i18n/en/DEPLOYMENT.md) (includes one-click deployment quick start)

### Manual Deployment

1. **Configure Supabase** - Create project and execute database schema
2. **Deploy Server** - Run Docker Compose on your server
3. **Deploy Frontend** - Deploy to Vercel or your hosting

> 📖 **Detailed deployment guide**: [docs/i18n/en/DEPLOYMENT.md](docs/i18n/en/DEPLOYMENT.md)

---

---

## 🏗️ Architecture

**Frontend** (Next.js) → **Worker** (BullMQ + Sharp) → **Storage** (MinIO/OSS/COS/S3)  
**Database** (Supabase/PostgreSQL/MySQL) + **Queue** (Redis) + **CDN** (Optional)

---

## 🛠️ Quick Commands

```bash
pnpm setup      # Guided setup
pnpm dev        # Start development
pnpm build      # Build for production
pnpm docker:up  # Start Docker services (MinIO + Redis)
pnpm lint       # Run linter
```

---

## 📁 Environment Variables

Key variables: `DATABASE_TYPE`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `STORAGE_TYPE`, `STORAGE_ENDPOINT`, `NEXT_PUBLIC_APP_URL`

> 📖 **Full configuration guide**: See [.env.example](.env.example)

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

---

## 🙏 Acknowledgments

- [Next.js](https://nextjs.org/) - React framework
- [Supabase](https://supabase.com/) - Backend as a service
- [MinIO](https://min.io/) - Object storage
- [Sharp](https://sharp.pixelplumbing.com/) - Image processing
- [Tailwind CSS](https://tailwindcss.com/) - CSS framework
- [BullMQ](https://docs.bullmq.io/) - Queue management

---

## 📚 Documentation

> 📖 **Full documentation**: See [docs/README.md](docs/README.md) for complete documentation index.

### Getting Started
- [Deployment Guide](docs/i18n/en/DEPLOYMENT.md) - Complete deployment guide (includes one-click deployment quick start)
- [Architecture Guide](docs/ARCHITECTURE.example.md) - System architecture and quick reference
- [Environment Variables](docs/ENVIRONMENT_VARIABLES.example.md) - Environment configuration (includes Vercel quick setup)

### Development & Security
- [Development Guide](docs/DEVELOPMENT.md) - Development setup, code standards, and feature documentation
- [Security Guide](docs/SECURITY.md) - Security best practices, Turnstile setup, sensitive docs management

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
