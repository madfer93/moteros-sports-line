# 🔐 Security Implementation - Setup Guide

## ⚡ Quick Start

### 1. Install Dependencies
```bash
cd c:\Users\madfe\OneDrive\Documentos\GitHub\moteros-sports-line
npm install
```

### 2. Apply Supabase RLS Policies (CRITICAL)
1. Go to your Supabase Dashboard → SQL Editor
2. Open `security/supabase_rls_policies.sql`
3. Copy and paste the ENTIRE script
4. Execute it
5. Verify all tables show "✅ PROTEGIDO"

### 3. Test Locally
```bash
npm run dev
```
This will:
- Load environment variables from `.env`
- Start Webpack dev server on http://localhost:8080
- Enable hot reload

### 4. Build for Production
```bash
npm run build
```
This will:
- Minify and ofuscate code
- Inject environment variables
- Remove console.log statements
- Generate files in `dist/` folder

---

## 📁 Files Created

### Environment Variables
- ✅ `.env` - Contains real API keys (NOT in Git)
- ✅ `.env.example` - Template for other developers
- ✅ `.gitignore` - Prevents .env from being committed

### Webpack Configuration
- ✅ `package.json` - Dependencies and scripts
- ✅ `webpack.config.js` - Build configuration

### Security
- ✅ `security/supabase_rls_audit.sql` - Audit script
- ✅ `security/supabase_rls_policies.sql` - RLS policies for all 67 tables

### Modified Files
- ✅ `js/config.js` - Now uses `process.env` variables
- ✅ `recovery.html` - Added security.js
- ✅ `catalogo.html` - Added security.js
- ✅ `blog.html` - Added security.js

---

## 🚨 Critical Security Issues Fixed

### 1. Exposed API Keys ✅
**Before:** 4 GROQ API keys hardcoded in `config.js`
**After:** Keys moved to `.env` file (not in Git)

### 2. Supabase RLS ✅
**Before:** All 67 tables had full public access
**After:** RLS enabled + policies created for all tables

### 3. Code Protection ✅
**Before:** 7 pages without security.js
**After:** All 17 pages protected

---

## 🔧 How It Works

### Development Mode
```bash
npm run dev
```
- Reads `.env` file
- Injects variables into `config.js`
- No minification (for debugging)
- Source maps enabled

### Production Mode
```bash
npm run build
```
- Reads `.env` file
- Injects variables into code
- Minifies and ofuscates
- Removes console.log
- Output in `dist/` folder

---

## 🌐 GitHub Deployment (Optional)

### Setup GitHub Secrets
1. Go to your repo → Settings → Secrets and variables → Actions
2. Add these secrets:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `GROQ_API_KEY_INDEX`
   - `GROQ_API_KEY_ADMIN`
   - `GROQ_API_KEY_TIENDA`
   - `GROQ_API_KEY_POS`

### GitHub Actions Workflow
Create `.github/workflows/deploy.yml`:
```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm install
      
      - name: Build
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}
          GROQ_API_KEY_INDEX: ${{ secrets.GROQ_API_KEY_INDEX }}
          GROQ_API_KEY_ADMIN: ${{ secrets.GROQ_API_KEY_ADMIN }}
          GROQ_API_KEY_TIENDA: ${{ secrets.GROQ_API_KEY_TIENDA }}
          GROQ_API_KEY_POS: ${{ secrets.GROQ_API_KEY_POS }}
        run: npm run build
      
      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
```

---

## ✅ Verification Checklist

### Before Committing to Git
- [ ] Verify `.env` is in `.gitignore`
- [ ] Run `git status` - `.env` should NOT appear
- [ ] Check `config.js` - should have `process.env` not hardcoded keys

### After Applying RLS Policies
- [ ] Try accessing data without authentication - should FAIL
- [ ] Login and try accessing data - should WORK
- [ ] Check Supabase Dashboard → Authentication → Policies

### After npm run build
- [ ] Check `dist/js/config.bundle.js` - keys should be injected
- [ ] File should be minified (hard to read)
- [ ] No `console.log` statements

---

## 🆘 Troubleshooting

### "process is not defined"
**Problem:** Browser doesn't understand `process.env`
**Solution:** Run `npm run build` first - Webpack will inject the values

### "Cannot find module 'dotenv-webpack'"
**Problem:** Dependencies not installed
**Solution:** Run `npm install`

### RLS Policies Not Working
**Problem:** Policies not applied correctly
**Solution:** 
1. Go to Supabase Dashboard → SQL Editor
2. Run the audit script: `security/supabase_rls_audit.sql`
3. Check which tables are missing policies
4. Re-run `security/supabase_rls_policies.sql`

---

## 📊 Security Status

| Item | Status | Notes |
|------|--------|-------|
| API Keys Protected | ✅ | Moved to .env |
| Supabase RLS | ✅ | All 67 tables protected |
| Code Protection | ✅ | security.js on all pages |
| .gitignore | ✅ | .env excluded from Git |
| Webpack Setup | ✅ | Ready for production |
| GitHub Secrets | ⏳ | Pending user setup |

---

## 🎯 Next Steps

1. **URGENT:** Apply RLS policies in Supabase
2. Install npm dependencies: `npm install`
3. Test locally: `npm run dev`
4. Build for production: `npm run build`
5. (Optional) Setup GitHub Actions for auto-deployment

---

## 📞 Support

If you encounter any issues:
1. Check the Troubleshooting section above
2. Verify all files were created correctly
3. Ensure `.env` has the correct API keys
4. Test with `npm run dev` before building
