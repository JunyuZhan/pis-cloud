# 📚 Documentation - Multi-language Support

This directory contains multi-language documentation for PIS.

## 🌍 Available Languages

- [English](en/) - English documentation
- [中文 (Chinese)](zh-CN/) - Chinese documentation

## 📖 Documentation Index

### English (en/)

- [Deployment Guide](en/DEPLOYMENT.md) - Detailed deployment steps
- [Storage Configuration](en/STORAGE_CONFIG.md) - MinIO/OSS/COS/S3 configuration
- [Database Configuration](en/DATABASE_CONFIG.md) - Supabase/PostgreSQL/MySQL configuration
- [Multi-Storage & Database Support](en/MULTI_STORAGE_DATABASE.md) - Feature guide and migration

### 中文 (zh-CN/)

- [部署指南](zh-CN/DEPLOYMENT.md) - 详细的部署步骤
- [存储配置](zh-CN/STORAGE_CONFIG.md) - MinIO/OSS/COS/S3 配置指南
- [数据库配置](zh-CN/DATABASE_CONFIG.md) - Supabase/PostgreSQL/MySQL 配置指南
- [多存储和多数据库支持](zh-CN/MULTI_STORAGE_DATABASE.md) - 功能说明和迁移指南

## 🔗 Quick Links

- [Main README](../../README.md) - English
- [README 中文版](../../README.zh-CN.md) - Chinese

## 📝 Contributing Translations

If you'd like to contribute translations for other languages:

1. Create a new directory under `docs/i18n/` with the language code (e.g., `ja` for Japanese)
2. Translate the documentation files
3. Update this README with the new language
4. Submit a pull request

## 🌍 Language Switching Guide

PIS documentation is available in multiple languages. This guide explains how to access documentation in your preferred language.

### Available Languages

- **English** (`en`) - Default language
- **中文 (Chinese)** (`zh-CN`) - Simplified Chinese

### README Files

When viewing the repository on GitHub:

- **English**: [README.md](../../README.md) - Default README
- **中文**: [README.zh-CN.md](../../README.zh-CN.md) - Chinese README

Both README files include language switcher links at the top.

### Documentation Structure

Documentation is organized in the `docs/i18n/` directory:

```
docs/i18n/
├── README.md                    # Documentation index
├── en/                          # English documentation
│   ├── DEPLOYMENT.md
│   ├── STORAGE_CONFIG.md
│   ├── DATABASE_CONFIG.md
│   └── MULTI_STORAGE_DATABASE.md
└── zh-CN/                       # Chinese documentation
    ├── DEPLOYMENT.md
    ├── STORAGE_CONFIG.md
    ├── DATABASE_CONFIG.md
    └── MULTI_STORAGE_DATABASE.md
```

### Finding Documentation

**From Main README**: Both `README.md` and `README.zh-CN.md` include links to documentation.

**From Documentation Index**: Visit this file (`docs/i18n/README.md`) for a complete list of all available documentation in all languages.

## 🌐 Language Codes

We use [ISO 639-1](https://en.wikipedia.org/wiki/List_of_ISO_639-1_codes) language codes:

- `en` - English
- `zh-CN` - Simplified Chinese
- `zh-TW` - Traditional Chinese (planned)
- `ja` - Japanese (planned)
- `ko` - Korean (planned)
