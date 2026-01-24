# Database Configuration Guide

PIS supports multiple databases, including Supabase (recommended), PostgreSQL, MySQL, etc.

## Supported Database Types

| Database Type | Description | Use Cases |
|--------------|-------------|-----------|
| `supabase` | Supabase (PostgreSQL + Auth + Realtime) | **Recommended**, full-featured |
| `postgresql` | Native PostgreSQL | Existing PostgreSQL instance |
| `mysql` | MySQL/MariaDB | Existing MySQL instance |

## Configuration

### 1. Supabase (Recommended)

Supabase provides a complete backend service, including:
- PostgreSQL database
- User authentication (Auth)
- Real-time subscriptions (Realtime)
- Storage management
- Auto-generated APIs

```bash
DATABASE_TYPE=supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Get Credentials:**
1. Visit [supabase.com](https://supabase.com) to create a project
2. Go to Project Settings -> API
3. Copy Project URL, anon public key, and service_role key

**Advantages:**
- ✅ Out-of-the-box authentication system
- ✅ Real-time data synchronization
- ✅ Auto-generated APIs
- ✅ Row Level Security (RLS)
- ✅ Generous free tier

### 2. PostgreSQL

Using native PostgreSQL requires implementing authentication and real-time features yourself.

```bash
DATABASE_TYPE=postgresql
DATABASE_URL=postgresql://user:password@host:5432/database
# Or configure separately
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=pis
DATABASE_USER=postgres
DATABASE_PASSWORD=password
DATABASE_SSL=false
```

**Notes:**
- ⚠️ Need to implement user authentication yourself (can use Supabase Auth or other solutions)
- ⚠️ Need to implement real-time features yourself (can use WebSocket or other solutions)
- ⚠️ Need to manually execute database migration scripts

**Database Migration:**
```bash
# Execute migration scripts
psql -h localhost -U postgres -d pis -f database/migrations/001_init.sql
psql -h localhost -U postgres -d pis -f database/migrations/002_secure_rls.sql
# ... other migration files
```

### 3. MySQL

Using MySQL requires adapting table structures and migration scripts.

```bash
DATABASE_TYPE=mysql
DATABASE_URL=mysql://user:password@host:3306/database
# Or configure separately
DATABASE_HOST=localhost
DATABASE_PORT=3306
DATABASE_NAME=pis
DATABASE_USER=root
DATABASE_PASSWORD=password
DATABASE_SSL=false
```

**Notes:**
- ⚠️ MySQL adapter not yet fully implemented (needs contribution)
- ⚠️ Need to convert PostgreSQL migration scripts to MySQL syntax
- ⚠️ Need to implement user authentication and real-time features yourself

## Database Migration

### Migrating from Supabase to PostgreSQL

1. **Export Data:**
   ```bash
   # Use pg_dump to export Supabase data
   pg_dump -h db.xxxxx.supabase.co -U postgres -d postgres > backup.sql
   ```

2. **Import to New Database:**
   ```bash
   psql -h localhost -U postgres -d pis < backup.sql
   ```

3. **Update Configuration:**
   ```bash
   DATABASE_TYPE=postgresql
   DATABASE_URL=postgresql://user:password@host:5432/pis
   ```

### Migrating from PostgreSQL to Supabase

1. **Export Data:**
   ```bash
   pg_dump -h localhost -U postgres -d pis > backup.sql
   ```

2. **Execute SQL in Supabase Dashboard:**
   - Go to SQL Editor
   - Execute migration scripts
   - Import data (if needed)

3. **Update Configuration:**
   ```bash
   DATABASE_TYPE=supabase
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   ```

## Performance Optimization

1. **Connection Pool Configuration**: Adjust connection pool size based on concurrency
2. **Index Optimization**: Ensure commonly queried fields have indexes
3. **Query Optimization**: Avoid N+1 queries, use batch queries
4. **Caching Strategy**: Use Redis to cache hot data

## Security Recommendations

1. **Use Environment Variables**: Don't hardcode database credentials in code
2. **Principle of Least Privilege**: Database users should only have necessary permissions
3. **Enable SSL**: Use SSL connections in production
4. **Regular Backups**: Set up automatic backup strategy
5. **Monitoring & Alerts**: Configure database monitoring and alerts

## Troubleshooting

### Connection Failed

1. Check if database service is running
2. Verify connection information (host, port, username, password)
3. Check firewall and network settings
4. Confirm database user has remote connection permissions

### Authentication Errors

1. Verify username and password are correct
2. Check database user permissions
3. Confirm database allows this user to connect

### Migration Script Execution Failed

1. Check database version compatibility
2. Verify migration script syntax is correct
3. Check error logs to locate issues
4. Execute migration scripts in order
