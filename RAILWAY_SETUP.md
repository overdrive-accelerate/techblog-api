# Railway Deployment Setup Guide

This guide covers setting up your blog-api for production deployment on Railway with Redis for distributed rate limiting.

## Prerequisites

- Railway account ([railway.app](https://railway.app))
- GitHub repository connected to Railway
- Bun runtime (v1.3.8+)

---

## Step 1: Install Dependencies

Before deploying, install the required dependencies:

```bash
# Redis client for distributed rate limiting
bun add ioredis
bun add -D @types/ioredis

# Resend for email verification and password reset
bun add resend
```

Commit and push these changes to your repository.

---

## Step 2: Set Up Railway Project

1. **Create a New Project:**
   - Go to [railway.app/new](https://railway.app/new)
   - Connect your GitHub repository
   - Railway will auto-detect your Bun application

2. **Add PostgreSQL Database:**
   - In your Railway project, press `Cmd/Ctrl + K`
   - Search for "PostgreSQL"
   - Add it to your project
   - Railway will automatically set `DATABASE_URL` and `DATABASE_PRIVATE_URL`

3. **Add Redis:**
   - Press `Cmd/Ctrl + K` again
   - Search for "Redis"
   - Add it to your project
   - Railway will automatically set `REDIS_URL`
   - Format: `redis://default:password@host:port`

---

## Step 3: Configure Environment Variables

⚠️ **IMPORTANT:** All environment variables are validated at startup. The server will fail to start if any required variables are missing or invalid, with clear error messages indicating what needs to be fixed.

In your Railway service settings, add the following environment variables:

### Required Variables

```bash
# Database (automatically set by Railway PostgreSQL)
DATABASE_URL=postgresql://...
# Must be a valid PostgreSQL connection URL

DIRECT_URL=postgresql://...
# Optional but recommended for migrations
# If not provided, DATABASE_URL will be used

# Redis (automatically set by Railway Redis)
REDIS_URL=redis://default:password@host:port
# Optional - falls back to in-memory rate limiting if not provided

# Authentication (REQUIRED)
BETTER_AUTH_SECRET=your-random-secret-key-min-32-chars
# MUST be at least 32 characters
# Should contain only alphanumeric characters and +/=_-
# Generate with: openssl rand -base64 32

BETTER_AUTH_URL=https://your-api-domain.railway.app
# Must be a valid URL matching your Railway domain

# Frontend CORS (REQUIRED)
FRONTEND_URL=https://your-frontend-domain.com
# Must be a valid URL
# Used for CORS origin validation

# Node Environment
NODE_ENV=production
# Options: development, production, test
# Defaults to "development" if not set

# Trust proxy headers (REQUIRED for Railway)
TRUST_PROXY=true
# Options: true or false
# MUST be "true" for Railway (used for rate limiting)

# Supabase (REQUIRED for file uploads)
SUPABASE_URL=https://your-project.supabase.co
# Must be a valid URL

SUPABASE_ANON_KEY=your-supabase-anon-key
# Required for file upload functionality

# Email (REQUIRED for email verification and password reset)
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxx
# Get from: https://resend.com/api-keys
# Required for sending verification and password reset emails

RESEND_FROM_EMAIL=noreply@yourdomain.com
# Must be a verified domain in Resend (NOT @gmail.com, @yahoo.com, etc.)
# Format: name@your-verified-domain.com
# See: https://resend.com/domains
```

### Optional Variables

```bash
# Port (Railway sets this automatically)
PORT=3001
# Defaults to 3001 if not set
```

### Environment Variable Validation

The API validates all environment variables at startup using Zod schemas. If validation fails, you'll see a clear error message:

```
❌ Environment Variable Validation Failed:

  ❌ BETTER_AUTH_SECRET: BETTER_AUTH_SECRET must be at least 32 characters for security
  ❌ FRONTEND_URL: FRONTEND_URL must be a valid URL

Please check your .env file or Railway environment variables.
See RAILWAY_SETUP.md for required environment variables.
```

This prevents the server from starting with invalid configuration, catching issues immediately rather than at request time.

---

## Step 4: Database Setup

1. **Run Migrations:**

   Railway will automatically run migrations if you configure the build command:

   ```json
   // In package.json, ensure these scripts exist:
   {
     "scripts": {
       "build": "echo 'No build needed'",
       "start": "bun src/index.ts",
       "db:migrate:deploy": "bun --bun run prisma migrate deploy"
     }
   }
   ```

2. **Configure Railway Build Settings:**
   - **Build Command:** `bun run db:migrate:deploy`
   - **Start Command:** `bun run start`

---

## Step 5: Redis Configuration

### How It Works

The rate limiter automatically:
- ✅ Uses Redis when `REDIS_URL` is provided (production)
- ✅ Falls back to in-memory when Redis is unavailable (development)
- ✅ Logs warnings if Redis connection fails
- ✅ Provides graceful degradation

### Verify Redis Connection

After deployment, check your Railway logs:

```
✓ Redis connected successfully
✓ Redis client initialized
```

If you see this warning, Redis is not configured:
```
⚠ REDIS_URL not found - using in-memory rate limiting
```

---

## Step 6: Set Up Resend for Email

Email verification and password reset require a transactional email service. We use Resend for reliable email delivery.

### Create Resend Account

1. **Sign Up:**
   - Go to [resend.com](https://resend.com)
   - Create a free account
   - Free tier includes 3,000 emails/month (100/day)

2. **Verify Your Domain:**
   - Go to [Domains](https://resend.com/domains)
   - Click "Add Domain"
   - Add your domain (e.g., `yourdomain.com`)
   - Add the DNS records provided by Resend to your domain's DNS settings
   - Wait for verification (usually 5-15 minutes)

3. **Get API Key:**
   - Go to [API Keys](https://resend.com/api-keys)
   - Click "Create API Key"
   - Give it a name (e.g., "Railway Production")
   - Select "Sending access" permission
   - Copy the API key (starts with `re_`)
   - **IMPORTANT:** Save this key - you can't see it again

4. **Configure Environment Variables:**
   ```bash
   RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxx
   RESEND_FROM_EMAIL=noreply@yourdomain.com
   ```

### Email Templates

The API includes pre-built branded email templates for:
- **Email Verification:** Sent immediately on signup
- **Password Reset:** Sent when user requests password reset

Both templates include:
- Professional design with your branding
- Clear call-to-action buttons
- Security warnings
- Automatic expiration (1 hour)

### Email Flow

**Signup Flow:**
1. User signs up with email/password
2. API sends verification email automatically
3. User clicks verification link
4. User is automatically logged in
5. Account is now verified and active

**Password Reset Flow:**
1. User requests password reset
2. API sends reset email (fire-and-forget to prevent timing attacks)
3. User clicks reset link
4. User enters new password
5. Password is updated securely

### Rate Limiting

Email endpoints have moderate rate limits to prevent abuse:
- **Development:** 10 emails per minute per IP
- **Production:** 5 emails per 15 minutes per IP

### Testing

Test email functionality locally:

```bash
# Set up .env with Resend credentials
RESEND_API_KEY=re_test_xxxxx
RESEND_FROM_EMAIL=onboarding@resend.dev  # Use Resend's test domain

# Start server
bun run dev

# Test signup (triggers verification email)
curl -X POST http://localhost:3001/api/auth/sign-up \\
  -H "Content-Type: application/json" \\
  -d '{
    "email": "test@example.com",
    "password": "SecurePassword123!",
    "name": "Test User"
  }'
```

### Troubleshooting

**"RESEND_FROM_EMAIL must use a verified domain"**
- Make sure you're not using `@gmail.com`, `@yahoo.com`, etc.
- Verify your domain in Resend dashboard
- Wait for DNS propagation (5-15 minutes)

**Emails not sending**
- Check Railway logs for email errors
- Verify `RESEND_API_KEY` is correct
- Check Resend dashboard for delivery logs
- Ensure you haven't exceeded rate limits

**Verification link expired**
- Links expire after 1 hour for security
- User can request a new verification email
- Check Better Auth session configuration

---

## Step 7: Security Checklist

Before going live, verify these settings:

### Environment Variables
- [ ] `BETTER_AUTH_SECRET` is at least 32 characters and randomly generated
- [ ] `BETTER_AUTH_URL` matches your Railway domain
- [ ] `FRONTEND_URL` is set to your production frontend domain
- [ ] `NODE_ENV=production`
- [ ] `TRUST_PROXY=true` (critical for Railway)
- [ ] `REDIS_URL` is set (automatically by Railway Redis)
- [ ] `RESEND_API_KEY` is set with valid API key
- [ ] `RESEND_FROM_EMAIL` uses verified domain (not gmail/yahoo)

### Database
- [ ] Migrations are applied successfully
- [ ] Connection pool is configured (default: 10 max, 2 min)
- [ ] `DIRECT_URL` is set for migrations

### Authentication
- [ ] Email verification is enabled (`requireEmailVerification: true` in auth.ts)
- [ ] Email sending callbacks are configured
- [ ] Session timeout is configured (default: 7 days)
- [ ] CORS is properly configured for your frontend
- [ ] Password reset token expiration is set (default: 1 hour)

### File Uploads
- [ ] Supabase Storage bucket "uploads" exists
- [ ] Row Level Security (RLS) policies are configured
- [ ] `SUPABASE_URL` and `SUPABASE_ANON_KEY` are set

### Email Service
- [ ] Resend account created
- [ ] Domain verified in Resend dashboard
- [ ] API key generated and added to Railway
- [ ] Email templates tested
- [ ] Rate limiting configured

---

## Step 8: Deploy

1. **Push to GitHub:**
   ```bash
   git add .
   git commit -m "Configure Railway deployment with Redis and Resend"
   git push origin main
   ```

2. **Railway Auto-Deploy:**
   - Railway will automatically detect the push
   - Build process will run migrations
   - App will start with Bun runtime

3. **Monitor Deployment:**
   - Check Railway logs for any errors
   - Verify Redis connection: "Redis connected successfully"
   - Verify database connection: "Database connections ready"
   - Verify environment validation passes

---

## Step 9: Testing

### Test Rate Limiting

```bash
# Test that rate limiting works
for i in {1..35}; do
  curl https://your-api.railway.app/api/auth/session
done

# After 30 requests, you should see:
# HTTP 429 - Rate limit exceeded
```

### Test Redis Connection

```bash
# Check health endpoint
curl https://your-api.railway.app/health

# Should return:
{
  "status": "healthy",
  "redis": "connected",  # If Redis is available
  "database": "connected",
  "timestamp": "..."
}
```

---

## Troubleshooting

### Redis Connection Issues

**Symptom:** Logs show "REDIS_URL not found"

**Solution:**
1. Verify Redis is added to your Railway project
2. Check that `REDIS_URL` environment variable is set
3. Restart your Railway service

**Symptom:** "Redis connection error"

**Solution:**
1. Check Railway Redis service is running
2. Verify network connectivity between services
3. Check Redis logs for errors

### Rate Limiting Not Working

**Symptom:** Can exceed rate limits

**Solution:**
1. Verify `TRUST_PROXY=true` is set (Railway uses proxies)
2. Check Redis connection is successful
3. Clear Redis cache: `redis-cli FLUSHDB` (if needed)

### Database Migration Errors

**Symptom:** "Cannot find prisma schema"

**Solution:**
1. Ensure `prisma/schema.prisma` exists in repository
2. Verify build command includes `prisma migrate deploy`
3. Check `DATABASE_URL` is correctly set

---

## Monitoring & Maintenance

### Logging

All logs are structured JSON for easy parsing:

```json
{
  "timestamp": "2026-02-05T...",
  "level": "info",
  "message": "Redis connected successfully",
  "context": { "host": "redis.railway.internal" }
}
```

### Key Metrics to Monitor

- **Rate Limit Hits:** Monitor 429 responses
- **Redis Connection:** Watch for connection errors
- **Database Pool:** Monitor connection usage
- **Response Times:** Track API latency
- **Error Rate:** Monitor 500 errors

### Recommended Tools

- **Railway Metrics:** Built-in monitoring
- **Sentry:** Error tracking (recommended)
- **LogTail/BetterStack:** Log aggregation
- **Uptime Robot:** Uptime monitoring

---

## Scaling Considerations

### Horizontal Scaling

With Redis rate limiting, you can safely scale horizontally:

1. **Railway Auto-Scaling:**
   - Go to Service Settings → Scale
   - Configure replica count
   - Rate limits will be shared across all instances via Redis

2. **Database Connection Pooling:**
   - Default: 10 connections per instance
   - For 3 replicas: 30 total connections
   - Adjust `max` in `src/lib/prisma.ts` if needed

### Redis Performance

- Railway Redis handles 10,000+ requests/sec
- Current rate limits (100 req/min general) are well within capacity
- Monitor Redis memory usage if storing additional data

---

## Cost Estimates

### Railway Pricing (as of 2026)

- **Starter Plan:** $5/month
  - 512 MB RAM
  - $0.000231 per GB-hour
  - Includes PostgreSQL and Redis

- **Production Recommendation:** Pro Plan ($20/month)
  - More resources
  - Priority support
  - Higher limits

### Optimization Tips

1. Use Railway's built-in PostgreSQL and Redis (no external costs)
2. Enable connection pooling (already configured)
3. Monitor memory usage to right-size your plan
4. Use Railway metrics to identify optimization opportunities

---

## Additional Resources

- [Railway Redis Documentation](https://docs.railway.com/guides/redis)
- [Bun Runtime with Railway](https://railway.com/deploy/bun-starter)
- [Redis with Bun Guide](https://oneuptime.com/blog/post/2026-01-31-bun-redis/view)
- [Deploy Redis on Railway](https://redis.io/docs/latest/integrate/railway-redis/)

---

## Support

If you encounter issues:

1. Check Railway logs: `railway logs`
2. Verify environment variables
3. Test locally with Docker Redis
4. Contact Railway support: [help.railway.app](https://help.railway.app)

---

**Last Updated:** February 5, 2026
**API Version:** 1.0.0
**Bun Version:** 1.3.8+
**Railway Status:** ✅ Production Ready (with Redis setup)
