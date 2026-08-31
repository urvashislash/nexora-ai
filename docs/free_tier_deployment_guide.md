# NEXORA AI — 100% Free-Tier Production Deployment Guide

This guide provides a comprehensive, step-by-step blueprint for deploying the entire **NEXORA AI Command Centre** stack (Frontend, Rust Trust Plane, Python AI Service, Database, Storage, Message Queue, and Redis) using **100% free cloud platforms and services**.

---

## 🌐 Free-Tier Architecture & Service Topology

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           FRONTEND COMMAND CENTRE                           │
│                 Vercel / Cloudflare Pages (100% Free Edge CDN)              │
│                       https://nexora.vercel.app                             │
└───────────────────────┬─────────────────────────────────────────────────────┘
                        │
         ┌──────────────┴──────────────┐
         ▼                             ▼
┌──────────────────────────────┐ ┌───────────────────────────────────────────┐
│     RUST TRUST PLANE API     │ │         PYTHON AI PROCESSING PLANE        │
│   Render / Koyeb Free Tier   │ │      Render / Koyeb Free Web Service      │
│  https://api.onrender.com    │ │ https://nexora-ai-service-rof3.onrender.com │
└──────────────┬───────────────┘ └─────────────────────┬─────────────────────┘
               │                                       │
               ├───────────────────┬───────────────────┤
               ▼                   ▼                   ▼
┌──────────────────────────────┐ ┌───────────────────────────┐ ┌───────────────┐
│       SUPABASE CLOUD         │ │         CLOUDAMQP         │ │    UPSTASH    │
│    PostgreSQL 16 + pgvector  │ │     Free RabbitMQ Plan    │ │   Free Redis  │
│    500MB DB • 1GB Storage    │ │   1,000,000 msgs / month  │ │ 10k cmds/day  │
└──────────────────────────────┘ └───────────────────────────┘ └───────────────┘
```

---

## 📊 Free-Tier Cloud Platforms Breakdown

| Component | Recommended Platform | Free Tier Specifications | Cost |
|---|---|---|---|
| **Database & pgvector** | [Supabase](https://supabase.com) | 500 MB Postgres 16, pgvector, Auth, 2 free projects | **$0.00 / month** |
| **Object Storage** | [Supabase Storage](https://supabase.com) | 1 GB storage, `evidence-documents` bucket | **$0.00 / month** |
| **AI Extraction Service** | [Render](https://render.com) (or [Koyeb](https://koyeb.com)) | 512 MB RAM, 0.1 CPU, Free Docker/Python Web Service with HTTPS | **$0.00 / month** |
| **Rust Trust Plane API** | [Render](https://render.com) (or [Koyeb](https://koyeb.com)) | 512 MB RAM, 0.1 CPU, Free Docker Web Service with HTTPS | **$0.00 / month** |
| **Frontend Web App** | [Vercel](https://vercel.com) or [Cloudflare Pages](https://pages.cloudflare.com) | Unlimited deployments, global edge CDN, custom domains | **$0.00 / month** |
| **Message Broker** | [CloudAMQP](https://www.cloudamqp.com) | "Little Lemur" plan (1M messages/mo, 20 connections) | **$0.00 / month** |
| **Redis Cache** | [Upstash](https://upstash.com) | Serverless Redis, 10,000 requests/day, 256MB storage | **$0.00 / month** |
| **CI/CD Automation** | [GitHub Actions](https://github.com/features/actions) | 2,000 free build minutes/month for repositories | **$0.00 / month** |
| **Uptime Keeper** | [Cron-Job.org](https://cron-job.org) or [UptimeRobot](https://uptimerobot.com) | 50 free monitors with 5-minute health check intervals | **$0.00 / month** |

---

## 🛠️ Step-by-Step Deployment Instructions

---

### Step 1: Database & Storage Setup (Supabase Cloud)

1. Create a free account at [Supabase](https://supabase.com).
2. Create a new project named `nexora-ai` in your nearest region.
3. Obtain your credentials from **Project Settings &rarr; API & Database**:
   - `Reference ID`: `vitxgshrjpyvczidzvto`
   - `Database Password`: `<your_db_password>`
   - `Project URL`: `https://vitxgshrjpyvczidzvto.supabase.co`
   - `Anon Key`: `eyJhbGciOi...`
   - `Service Role Key`: `eyJhbGciOi...`
4. Apply the database migrations directly from your local terminal:
   ```bash
   # Link local repo to remote project
   ./scripts/link_supabase.sh vitxgshrjpyvczidzvto production

   # Push all SQL migrations (tables, pgvector, RLS, audit retention)
   ./scripts/deploy_to_supabase.sh
   ```

---

### Step 2: Message Queue Setup (CloudAMQP RabbitMQ)

1. Sign up for a free account at [CloudAMQP](https://www.cloudamqp.com).
2. Click **"Create New Instance"**:
   - Plan: Select **Little Lemur (Free)**.
   - Region: Select the region closest to your Supabase instance.
3. Go to the instance dashboard and copy the `AMQP URL`:
   - Format: `amqps://<user>:<password>@<host>.cloudamqp.com/<vhost>`

---

### Step 3: Redis Cache Setup (Upstash Redis)

1. Sign up for a free account at [Upstash](https://upstash.com).
2. Click **"Create Database"**:
   - Name: `nexora-redis`
   - Type: **Regional (Free)**
   - TLS (SSL): **Enabled**
3. Copy the Redis Connection URL:
   - Format: `rediss://default:<password>@<host>.upstash.io:6379`

---

### Step 4: Deploy Python AI Extraction Service (Render Free Web Service)

Render offers free Web Services with native Python and Docker runtimes, automatic HTTPS, and direct GitHub CI/CD integration.

#### Method A: Render Web Service via Docker (Recommended)

1. Sign up / Log in to [Render](https://render.com).
2. Click **"New +" &rarr; "Web Service"**.
3. Connect your GitHub repository: `nexora-ai`.
4. Configure the Web Service settings:
   - **Name**: `nexora-ai-service`
   - **Region**: Choose closest to your Supabase region (e.g. *Frankfurt* or *Oregon* / *Singapore*).
   - **Branch**: `production` (or `main`)
   - **Root Directory**: `ai_service`
   - **Runtime**: `Docker` *(Uses `ai_service/Dockerfile`)*
   - **Instance Type**: **Free (512 MB RAM / 0.1 CPU)**
5. Add the following **Environment Variables**:
   | Key | Value | Description |
   |---|---|---|
   | `PORT` | `8000` | Render routing port |
   | `AI_PORT` | `8000` | Internal FastAPI bind port |
   | `DATABASE_URL` | `postgresql://postgres:<password>@db.vitxgshrjpyvczidzvto.supabase.co:5432/postgres?sslmode=require` | Supabase Postgres URI |
   | `SUPABASE_URL` | `https://vitxgshrjpyvczidzvto.supabase.co` | Supabase API endpoint |
   | `SUPABASE_SERVICE_ROLE_KEY` | `<your_supabase_service_role_key>` | Secret key for object storage & vector sync |
   | `RABBITMQ_URL` | `amqps://<user>:<password>@<host>.cloudamqp.com/<vhost>` | CloudAMQP URL |
   | `REDIS_URL` | `rediss://default:<password>@<host>.upstash.io:6379` | Upstash Redis URL |
   | `EMBEDDING_MODEL` | `sentence-transformers/all-MiniLM-L6-v2` | Lightweight 384-d semantic model |
   | `PYTHONUNBUFFERED` | `1` | Stream real-time logs |
6. Set Health Check Path:
   - **Health Check Path**: `/health`
7. Click **"Create Web Service"**.
8. Your public AI Service URL will be: `https://nexora-ai-service-rof3.onrender.com`

---

#### Method B: Render Native Python Runtime (Alternative without Docker)

If you prefer using Render's native Python runtime:
- **Root Directory**: `ai_service`
- **Runtime**: `Python 3`
- **Build Command**: `pip install -r requirements.txt`
- **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- **Environment Variables**: Same as listed above.

---

#### Method C: Koyeb Free Serverless (Alternative 100% Free Cloud)

1. Sign up at [Koyeb](https://koyeb.com).
2. Click **"Create Service" &rarr; GitHub**.
3. Repository: `nexora-ai`, Work Directory: `ai_service`, Builder: `Dockerfile`.
4. Instance: **Free (Nano 512MB RAM)**.
5. Set the environment variables and deploy.

---

### Step 5: Deploy Rust Trust Plane API (Render Free Web Service)

1. In your [Render Dashboard](https://dashboard.render.com), click **"New +" &rarr; "Web Service"**.
2. Connect your `nexora-ai` repository.
3. Configure the settings:
   - **Name**: `nexora-backend`
   - **Root Directory**: `backend`
   - **Runtime**: `Docker` *(Uses `backend/Dockerfile`)*
   - **Instance Type**: **Free (512 MB RAM / 0.1 CPU)**
4. Set the **Environment Variables**:
   | Key | Value | Description |
   |---|---|---|
   | `PORT` | `3000` | Render routing port |
   | `BACKEND_PORT` | `3000` | Axum internal port |
   | `DATABASE_URL` | `postgresql://postgres:<password>@db.vitxgshrjpyvczidzvto.supabase.co:5432/postgres?sslmode=require` | Supabase Postgres URL |
   | `AI_SERVICE_URL` | `https://nexora-ai-service-rof3.onrender.com` | Deployed Render AI URL from Step 4 |
   | `RABBITMQ_URL` | `amqps://<user>:<password>@<host>.cloudamqp.com/<vhost>` | CloudAMQP URL |
   | `REDIS_URL` | `rediss://default:<password>@<host>.upstash.io:6379` | Upstash Redis URL |
   | `RUST_LOG` | `info,backend=info` | Production log level |
5. Set Health Check Path:
   - **Health Check Path**: `/api/v1/health`
6. Click **"Create Web Service"**.
7. Your public Backend URL will be: `https://nexora-backend.onrender.com`

---

### Step 6: Deploy Frontend Web Console (Vercel)

1. Sign up at [Vercel](https://vercel.com) using your GitHub account.
2. Click **"Add New Project"** and import the `nexora-ai` repository.
3. Configure project settings:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Add **Environment Variables**:
   | Key | Value |
   |---|---|
   | `VITE_API_URL` | `https://nexora-backend.onrender.com` |
   | `VITE_SUPABASE_URL` | `https://vitxgshrjpyvczidzvto.supabase.co` |
   | `VITE_SUPABASE_ANON_KEY` | `<your_supabase_anon_key>` |
5. Click **"Deploy"**.
6. Your live web app will be available at: `https://nexora-ai.vercel.app`

---

## ⚡ Mitigating Free-Tier Cold Starts (Preventing Sleep)

Free tier instances on Render go into a sleep state after 15 minutes of inactivity. To keep your live demo 100% warm and instantly responsive:

1. Register at [Cron-Job.org](https://cron-job.org) or [UptimeRobot](https://uptimerobot.com) (100% Free).
2. Create an automated HTTP GET ping every **10 minutes**:
   - **Ping URL 1 (Backend)**: `https://nexora-backend.onrender.com/api/v1/health`
   - **Ping URL 2 (AI Service)**: `https://nexora-ai-service-rof3.onrender.com/health`
3. This keeps both container instances active and eliminates cold start latency during demonstrations.

---

## 🔍 Post-Deployment Health Verification

Once deployed, verify the entire live ecosystem using the automated health probe script:

```bash
BACKEND_URL="https://nexora-backend.onrender.com" \
AI_URL="https://nexora-ai-service-rof3.onrender.com" \
FRONTEND_URL="https://nexora-ai.vercel.app" \
./scripts/health_probe.sh production
```

Expected Output:
```text
=============================================================================
 NEXORA AI — System Health & Availability Probe [production]
=============================================================================
• Probing Rust Backend API (https://nexora-backend.onrender.com/api/v1/health)... ✅ HEALTHY
• Probing Python AI Service (https://nexora-ai-service-rof3.onrender.com/health)... ✅ HEALTHY
• Probing Frontend Web App (https://nexora-ai.vercel.app)... ✅ HEALTHY
• Probing Supabase / PostgreSQL Connection... ✅ CONNECTED
=============================================================================
🎉 System status: ALL PROBED SERVICES OPERATIONAL
```

---

## 📋 Free-Tier Environment Variables Reference Table

| Variable | Target Service | Example Value | Source |
|---|---|---|---|
| `DATABASE_URL` | Backend / AI Service | `postgresql://postgres:pass@db.vitxgshrjpyvczidzvto.supabase.co:5432/postgres?sslmode=require` | Supabase Settings |
| `SUPABASE_URL` | Frontend / AI Service | `https://vitxgshrjpyvczidzvto.supabase.co` | Supabase Settings |
| `SUPABASE_ANON_KEY` | Frontend | `eyJhbGciOi...` | Supabase Settings |
| `SUPABASE_SERVICE_ROLE_KEY` | AI Service / Worker | `eyJhbGciOi...` | Supabase Settings |
| `RABBITMQ_URL` | Backend / AI Service | `amqps://user:pass@host.cloudamqp.com/vhost` | CloudAMQP Dashboard |
| `REDIS_URL` | Backend / AI Service | `rediss://default:pass@host.upstash.io:6379` | Upstash Dashboard |
| `AI_SERVICE_URL` | Backend | `https://nexora-ai-service-rof3.onrender.com` | Render Dashboard |
| `VITE_API_URL` | Frontend | `https://nexora-backend.onrender.com` | Render Dashboard |

---

## 🎯 Summary

With this architecture:
- **Total Monthly Infrastructure Cost**: **$0.00**
- **SLA & Uptime**: > 99.9% with automated health pings.
- **Hardware Resources**: Free Render Docker/Python Web Services for both Rust and Python AI services, global Edge CDN caching (Vercel), PostgreSQL 16 + pgvector (Supabase Cloud), CloudAMQP RabbitMQ, and Upstash Redis.
