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
- **Dynamic poster generation** - Auto-generate shareable posters with QR codes, customizable styles
- **Album poster images** - Set custom poster images for better branding and presentation

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

> 💡 **Tip**: You can also manually configure storage and database types. See [Storage Configuration](docs/i18n/en/STORAGE_CONFIG.md) and [Database Configuration](docs/i18n/en/DATABASE_CONFIG.md)

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
3. Create admin account in **Authentication** → **Users**
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

> 📖 **Deployment guide**: [docs/i18n/en/ONE_CLICK_DEPLOY.md](docs/i18n/en/ONE_CLICK_DEPLOY.md)

### Manual Deployment

1. **Configure Supabase** - Create project and execute database schema
2. **Deploy Server** - Run Docker Compose on your server
3. **Deploy Frontend** - Deploy to Vercel or your hosting

> 📖 **Detailed deployment guide**: [docs/i18n/en/DEPLOYMENT.md](docs/i18n/en/DEPLOYMENT.md)

---

---

## 🛠️ Quick Commands

```bash
pnpm setup      # Guided setup
pnpm dev        # Start development
pnpm docker:up  # Start Docker services
```

---

## 📁 Environment Variables

Key variables: `DATABASE_TYPE`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `STORAGE_TYPE`, `STORAGE_ENDPOINT`, `NEXT_PUBLIC_APP_URL`

> 📖 **Full configuration guide**: See [.env.example](.env.example) and [Storage Configuration](docs/i18n/en/STORAGE_CONFIG.md)

---

## 🔧 FAQ

**Q: Images don't display after upload?**  
Check Worker logs: `docker-compose logs worker` and verify `NEXT_PUBLIC_MEDIA_URL`

**Q: Login redirect loop?**  
Clear browser cookies and check Supabase Auth Redirect URLs

**Q: How to switch storage?**  
See [Storage Configuration](docs/i18n/en/STORAGE_CONFIG.md)

**Q: Supported storage/databases?**  
Storage: MinIO, OSS, COS, S3 | Database: Supabase (recommended), PostgreSQL, MySQL

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
- [One-Click Deployment](docs/i18n/en/ONE_CLICK_DEPLOY.md) - Deploy with one command on your server
- [Deployment Guide](docs/i18n/en/DEPLOYMENT.md) - Detailed deployment steps (Vercel)
- [Storage Configuration](docs/i18n/en/STORAGE_CONFIG.md) - MinIO/OSS/COS/S3 configuration
- [Database Configuration](docs/i18n/en/DATABASE_CONFIG.md) - Supabase/PostgreSQL/MySQL configuration
- [Multi-Storage & Database Support](docs/i18n/en/MULTI_STORAGE_DATABASE.md) - Feature guide and migration

### Development & Security
- [Development Guide](docs/DEVELOPMENT.md) - Development setup, code standards, and feature documentation
- [Security Guide](docs/SECURITY.md) - Security best practices, deployment checklist, and pre-open source security checklist
- [Performance Optimization](docs/PERFORMANCE_OPTIMIZATION.md) - Performance optimization guide

### Features
- [Poster Feature](docs/POSTER_FEATURE.md) - Album poster images and dynamic poster generation guide
- [Share Image URL](docs/SHARE_IMAGE_URL_EXPLANATION.md) - Share preview image configuration

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
