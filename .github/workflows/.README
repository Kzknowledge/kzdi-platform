# 🚀 KZDI Platform - GitHub Actions CI/CD Guide

Production-grade automation for **Hausa NLP, MCP Systems, and Telemetry Infrastructure**.

---

## 📋 Overview

This repository uses **GitHub Actions** to automate:
- ✅ Code linting & security audits
- ✅ Unit tests (MCP executor, skill registry)
- ✅ Supabase schema migrations
- ✅ Edge Function deployment
- ✅ Post-deployment verification

---

## 🔑 Required Secrets (GitHub Repository Settings)

Before workflows can run, add these secrets to your repo:

| Secret Name | Value | Source |
|-------------|-------|--------|
| `SUPABASE_URL` | https://your-project.supabase.co | Supabase Dashboard → Settings → API |
| `SUPABASE_ANON_KEY` | eyJhbGc... | Supabase Dashboard → Settings → API |
| `SUPABASE_ACCESS_TOKEN` | sbp_... | Supabase Dashboard → Account → Access Tokens |
| `SUPABASE_PROJECT_ID` | your-project-id | Supabase Dashboard URL |

---

## 🛠️ How to Add Secrets (Mobile-Friendly)

### Step 1: Go to Repository Settings
1. Navigate to your GitHub repo: `github.com/kriptomech/kzdi-platform`
2. Click **Settings** (top-right menu)
3. Left sidebar → **Secrets and variables** → **Actions**

### Step 2: Add Each Secret
1. Click **New repository secret** button
2. **Name:** Enter exact secret name (e.g., `SUPABASE_URL`)
3. **Value:** Paste your secret value
4. Click **Add secret**

### Step 3: Repeat for All Secrets
Repeat Step 2 for all 4 secrets listed above.

---

## 📤 Mobile Web UI Execution (No CLI Required)

### Creating Files via GitHub Web UI:

1. **Navigate to your repo**
   - Open `github.com/kriptomech/kzdi-platform`

2. **Add a new file**
   - Click **Add file** button (top-right)
   - Select **Create new file**

3. **Enter file path**
   - Type path: `.github/workflows/ci-cd-pipeline.yml`
   - Content appears below

4. **Paste code**
   - Copy the file content from this guide
   - Paste into the editor

5. **Commit**
   - Scroll to bottom
   - Add commit message: `feat: add CI/CD pipeline workflow`
   - Click **Commit new file**

**Repeat for all 8 files** listed above.

---

## 🚀 Triggering Workflows

### Automatic Triggers:
- **Any push to `main` branch** → CI/CD pipeline runs
- **Any push to `develop` branch** → Tests run (no deploy)
- **Pull requests** → Lint & security checks

### Manual Trigger (Mobile):
1. Go to **Actions** tab (top menu)
2. Select workflow name (e.g., "🚀 KZDI Master CI/CD Pipeline")
3. Click **Run workflow** dropdown
4. Select **main** branch
5. Click **Run workflow** button

---

## 📊 Monitoring Workflows

### View Workflow Status:

1. Click **Actions** tab (repo top menu)
2. View all running/completed workflows
3. Click workflow name to see detailed logs
4. Each job shows:
   - ✅ Step name
   - ⏱️ Duration
   - 📋 Output logs

### What Each Workflow Does:

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| **CI/CD Pipeline** | push main | Full deployment automation |
| **Deploy Telemetry** | push migrations/ | Schema deployment only |
| **Deploy Edge Functions** | push functions/ | Edge function deployment |
| **Test MCP System** | push main/develop | Unit tests for MCP |
| **Security Audit** | Weekly + push | Dependency & code audit |

---

## ✅ Verification Checklist

After workflow completes:

1. **Check workflow summary**
   - Go to Actions tab
   - Click latest workflow run
   - Scroll to bottom → Summary section

2. **Verify Supabase tables**
   - Open Supabase Dashboard
   - Click **Database** → **public**
   - Look for 5 tables:
     - `telemetry_events`
     - `agent_registry`
     - `skill_mastery`
     - `system_memory`
     - `audit_log`

3. **Test connection in Node.js**
   - Terminal: `npm test`
   - Should log: "✅ ALL VERIFICATION CHECKS PASSED"

---

## 🐛 Troubleshooting

### Workflow stuck or failed?

1. **Click the failing workflow**
2. **Expand the red ❌ step**
3. **Read the error message**
4. **Common fixes:**

| Error | Fix |
|-------|-----|
| `secret not found` | Check GitHub Secrets are added (case-sensitive) |
| `permission denied` | Ensure `SUPABASE_ACCESS_TOKEN` is valid |
| `table already exists` | This is OK—migration is idempotent |
| `Edge Function deploy failed` | Optional step—safe to ignore |

---

## 🔄 CI/CD Workflow Diagram
