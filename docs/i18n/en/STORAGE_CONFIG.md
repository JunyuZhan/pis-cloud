# Storage Configuration Guide

PIS supports multiple object storage services, including MinIO, Alibaba Cloud OSS, Tencent Cloud COS, AWS S3, etc.

## Supported Storage Types

| Storage Type | Description | Use Cases |
|-------------|-------------|-----------|
| `minio` | MinIO self-hosted storage | Private deployment, internal network |
| `oss` | Alibaba Cloud OSS | Users in China, Alibaba Cloud ecosystem |
| `cos` | Tencent Cloud COS | Users in China, Tencent Cloud ecosystem |
| `s3` | AWS S3 | Overseas users, AWS ecosystem |

## Configuration

### 1. MinIO (Default)

```bash
STORAGE_TYPE=minio
STORAGE_ENDPOINT=localhost
STORAGE_PORT=9000
STORAGE_USE_SSL=false
STORAGE_ACCESS_KEY=admin
STORAGE_SECRET_KEY=password123
STORAGE_BUCKET=pis-photos
STORAGE_PUBLIC_URL=https://media.yourdomain.com
```

**Docker Deployment:**
```bash
# Use MinIO service from docker-compose.yml
STORAGE_ENDPOINT=minio  # Use service name for Docker internal network
STORAGE_PORT=9000
```

### 2. Alibaba Cloud OSS

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

**Get Credentials:**
1. Log in to [Alibaba Cloud Console](https://oss.console.aliyun.com/)
2. Create a Bucket
3. Create AccessKey in AccessKey Management
4. Configure Bucket read/write permissions and CORS

**Region Codes:**
- `cn-hangzhou` - East China 1 (Hangzhou)
- `cn-shanghai` - East China 2 (Shanghai)
- `cn-beijing` - North China 2 (Beijing)
- `cn-shenzhen` - South China 1 (Shenzhen)

### 3. Tencent Cloud COS

```bash
STORAGE_TYPE=cos
STORAGE_ENDPOINT=cos.ap-guangzhou.myqcloud.com
STORAGE_REGION=ap-guangzhou
STORAGE_ACCESS_KEY=your-secret-id
STORAGE_SECRET_KEY=your-secret-key
STORAGE_BUCKET=your-bucket-name
STORAGE_PUBLIC_URL=https://your-bucket-name.cos.ap-guangzhou.myqcloud.com
STORAGE_USE_SSL=true
```

**Get Credentials:**
1. Log in to [Tencent Cloud Console](https://console.cloud.tencent.com/cos)
2. Create a storage bucket
3. Create API keys in Access Management -> API Key Management
4. Configure bucket read/write permissions and cross-origin access

**Region Codes:**
- `ap-guangzhou` - Guangzhou
- `ap-shanghai` - Shanghai
- `ap-beijing` - Beijing
- `ap-chengdu` - Chengdu

### 4. AWS S3

```bash
STORAGE_TYPE=s3
STORAGE_ENDPOINT=s3.amazonaws.com
STORAGE_REGION=us-east-1
STORAGE_ACCESS_KEY=your-access-key-id
STORAGE_SECRET_KEY=your-secret-access-key
STORAGE_BUCKET=your-bucket-name
STORAGE_PUBLIC_URL=https://your-bucket-name.s3.amazonaws.com
STORAGE_USE_SSL=true
```

**Get Credentials:**
1. Log in to [AWS Console](https://s3.console.aws.amazon.com/)
2. Create an S3 Bucket
3. Create a user in IAM and assign S3 permissions
4. Create Access Key

## Frontend Configuration

Regardless of which storage you use, the frontend needs to configure `NEXT_PUBLIC_MEDIA_URL`:

```bash
# Point to public access address of storage (CDN or direct access)
NEXT_PUBLIC_MEDIA_URL=https://media.yourdomain.com/pis-photos
```

## Storage Migration

If you need to migrate from one storage to another:

1. **Backup Data**: Use tools provided by each storage service to export data
2. **Update Configuration**: Modify `STORAGE_TYPE` and related configurations
3. **Re-upload**: Import backup data to new storage
4. **Update Database**: Update file paths in database (if needed)

## Performance Optimization Recommendations

1. **Use CDN**: Configure `STORAGE_PUBLIC_URL` to point to CDN address
2. **Enable HTTPS**: Set `STORAGE_USE_SSL=true`
3. **Configure Caching**: Configure appropriate caching strategy in CDN or Nginx
4. **Multipart Upload**: Use multipart upload for large files

## Troubleshooting

### Connection Failed

1. Check network connection and firewall settings
2. Verify `STORAGE_ENDPOINT` and `STORAGE_PORT` are correct
3. Validate `STORAGE_ACCESS_KEY` and `STORAGE_SECRET_KEY` are valid

### Permission Errors

1. Check storage bucket access permission configuration
2. Verify AccessKey has sufficient permissions (read, write, delete, etc.)
3. Check CORS configuration (when frontend accesses directly)

### Files Cannot Be Accessed

1. Verify `STORAGE_PUBLIC_URL` is configured correctly
2. Check storage bucket public access policy
3. Verify CDN configuration (if using)
