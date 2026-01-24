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

1. **Configure Supabase** - Create project and run migrations
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
