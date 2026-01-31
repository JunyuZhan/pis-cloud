# 📸 PIS - Private Instant Photo Sharing

> A self-hosted photo delivery system designed for photographers

<p align="center">
  <a href="https://github.com/JunyuZhan/pis-cloud/stargazers">
    <img src="https://img.shields.io/github/stars/JunyuZhan/pis-cloud?style=social" alt="GitHub stars" />
  </a>
</p>

<p align="center">
  <a href="https://star-history.com/#JunyuZhan/pis-cloud&Date">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=JunyuZhan/pis-cloud&type=Date&theme=dark" />
      <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=JunyuZhan/pis-cloud&type=Date" />
      <img src="https://api.star-history.com/svg?repos=JunyuZhan/pis-cloud&type=Date" alt="Star History Chart" />
    </picture>
  </a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-15-black?style=flat-square&logo=next.js" alt="Next.js 15" />
  <img src="https://img.shields.io/badge/TypeScript-5.5-blue?style=flat-square&logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Database-Supabase-3ECF8E?style=flat-square&logo=supabase" alt="Supabase" />
  <img src="https://img.shields.io/badge/MinIO-Object%20Storage-C72E49?style=flat-square&logo=minio" alt="MinIO" />
  <img src="https://img.shields.io/badge/BullMQ-Redis-FF6B6B?style=flat-square&logo=redis" alt="BullMQ" />
  <img src="https://img.shields.io/badge/Sharp-Image%20Processing-99CC00?style=flat-square" alt="Sharp" />
</p>

<p align="center">
  <a href="README.zh-CN.md">中文</a> | <a href="README.md">English</a>
</p>

<p align="center">
  <strong>📦 Deployment Versions:</strong>
  <a href="https://github.com/JunyuZhan/pis-cloud">☁️ Cloud Version</a> (Current) |
  <a href="https://github.com/JunyuZhan/pis-standalone">🏠 Standalone Version</a>
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
- **NEW**: Image style presets (13 presets: portrait, landscape, general)
  - Apply unified visual style to entire albums
  - Real-time preview with CSS filters
  - Reprocess existing photos to apply new styles
  - Single photo reprocessing support

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
- **NEW**: Admin-controlled batch download (opt-in by default)
  - Batch download requires explicit admin approval
  - Generate presigned URLs for secure downloads
  - One-click download for selected photos
- Password protection and expiration dates
- Album templates and view tracking

### 💰 **Flexible Deployment**
- **Architecture**: Vercel (frontend) + Supabase (database & auth) + Self-hosted (storage & worker)
- **Storage**: MinIO, Alibaba Cloud OSS, Tencent Cloud COS, AWS S3
- **Database**: Supabase Cloud
- **Authentication**: Supabase Auth
- **CDN**: Cloudflare, Alibaba Cloud, Tencent Cloud
- Simple setup, production-ready

### 🚀 **Production Ready**
- **One-click deployment**: Guided script for Vercel + Supabase setup
- **Auto-generated secrets**: API keys, passwords
- Queue-based auto-scaling
- Health monitoring and alert system (Telegram/Email/Log)
- Data consistency checker (orphan detection & repair)
- CI/CD ready

---

## 🚀 Quick Start

### Deployment Architecture

**Vercel + Supabase + Self-hosted Worker**

- **Frontend**: Deploy to Vercel (automatic)
- **Database**: Supabase Cloud (free tier available)
- **Worker & Storage**: Self-hosted on your server

### One-Click Deployment

```bash
# One command to install (copy and paste)
curl -sSL https://raw.githubusercontent.com/JunyuZhan/PIS/main/scripts/install.sh | tr -d '\r' | bash
```

> 💡 **Note**: The `tr -d '\r'` command ensures compatibility across different systems by removing Windows line endings. The script also includes automatic line ending cleanup as a fallback.

Or manually:

```bash
git clone https://github.com/JunyuZhan/pis-cloud.git
cd pis/docker
bash deploy.sh
```

The script will guide you through:
- ✅ Configure Supabase (database & authentication)
- ✅ Auto-generate security secrets
- ✅ Configure storage (MinIO/OSS/COS/S3)
- ✅ Start Worker and storage services

> 📖 **Detailed guide**: [Deployment Documentation](docs/i18n/en/DEPLOYMENT.md)

---

### Local Development

```bash
pnpm install
pnpm setup
pnpm dev
```

> 📖 **Development guide**: [Development Documentation](docs/DEVELOPMENT.md)

---

### Access the Application

| Service | URL | Credentials |
|---------|-----|-------------|
| Homepage | http://localhost:3000 | - |
| Admin Dashboard | http://localhost:3000/admin/login | Supabase user |
| MinIO Console | http://localhost:9001 | minioadmin / minioadmin |

---

## 📖 Documentation

- **[Deployment Guide](docs/i18n/en/DEPLOYMENT.md)** - Detailed deployment instructions
- **[Development Guide](docs/DEVELOPMENT.md)** - Development setup and guidelines
- **[Architecture Guide](docs/ARCHITECTURE.md)** - System architecture overview
- **[User Guide](docs/USER_GUIDE.md)** - Feature usage guide

> 📚 **Full documentation**: [docs/README.md](docs/README.md)

---

## 🏗️ Architecture

**Frontend** (Next.js on Vercel) → **Worker** (BullMQ + Sharp) → **Storage** (MinIO/OSS/COS/S3)  
**Database** (Supabase Cloud) + **Queue** (Redis) + **CDN** (Optional)

> 📖 **Detailed architecture**: [Architecture Documentation](docs/ARCHITECTURE.md)

---

## 🛠️ Quick Commands

```bash
pnpm setup      # Guided setup
pnpm dev        # Start development
pnpm build      # Build for production
pnpm docker:up  # Start Docker services
pnpm lint       # Run linter
pnpm test       # Run tests
```

---

## 📄 License

MIT License © 2026 junyuzhan - See [LICENSE](LICENSE) for details

---

## 👤 Author & Contributing

**junyuzhan** - [GitHub](https://github.com/junyuzhan) - junyuzhan@outlook.com

Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) and [AUTHORS.md](AUTHORS.md)

---

## 🙏 Acknowledgments

Built with: [Next.js](https://nextjs.org/) • [Supabase](https://supabase.com/) • [MinIO](https://min.io/) • [Sharp](https://sharp.pixelplumbing.com/) • [Tailwind CSS](https://tailwindcss.com/) • [BullMQ](https://docs.bullmq.io/)

---

## 🎨 Latest Features

- **Image Style Presets**: 13 professional color grading presets (portrait, landscape, general)
- **Batch Download Control**: Admin-controlled batch download with presigned URLs
- **Real-time Sync**: Live photo status updates via Supabase Realtime

> 📖 **Learn more**: [Quick Start Guide](docs/QUICK_START.md) • [User Guide](docs/USER_GUIDE.md)

---

## 📚 Documentation

- **[Quick Start Guide](docs/QUICK_START.md)** - Get started with new features in 3 steps
- **[User Guide](docs/USER_GUIDE.md)** - Complete guide for image style presets and batch download
- **[Implementation Status](docs/IMPLEMENTATION_STATUS.md)** - Feature implementation tracking
- **[Mobile Optimization](docs/MOBILE_OPTIMIZATION.md)** - Mobile UX improvements

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
