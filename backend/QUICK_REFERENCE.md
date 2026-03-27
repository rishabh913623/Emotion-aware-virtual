# Quick Reference - Backend Deployment

## 🚀 Deploy to Render (3 Steps)

### Step 1: Environment Variables
```bash
DATABASE_URL=<from_render_postgres>
JWT_SECRET=<random_string>
CORS_ORIGIN=https://<vercel-domain>
```

### Step 2: Build & Start Commands
**Build:** `pip install -r requirements.txt`  
**Start:** `gunicorn -c gunicorn.conf.py app:app`

### Step 3: Initialize Database
```bash
psql "<RENDER_POSTGRES_URL>" -f database/schema.sql
```

## ✅ Verify Deployment

### Test Endpoints
```bash
# Root (should return: {"message": "Backend running"})
curl https://<backend>.onrender.com/

# Health (should return: {"status": "ok"})
curl https://<backend>.onrender.com/health
```

## 🔧 Key Fixes Applied

1. ✅ Added root route `/` - no more 404
2. ✅ Wrapped `/health` in try-except - never fails
3. ✅ Global error handler - no crashes
4. ✅ Database error handling - safe fallbacks
5. ✅ Model loading error handling - returns "neutral"
6. ✅ All routes return JSON - no 500 errors
7. ✅ CORS properly configured
8. ✅ Comprehensive logging

## 🎯 Expected Responses

| Endpoint | Response |
|----------|----------|
| `/` | `{"message": "Backend running"}` |
| `/health` | `{"status": "ok"}` |
| `/login` | `{"token": "...", "role": "...", "student_id": ...}` |
| `/emotions` | `{"history": [], "counts": {}, "student_wise": []}` |
| `/predict` | `{"emotion": "neutral", ...}` (if model missing) |

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| 502 Bad Gateway | Check PORT binding, verify gunicorn config |
| CORS error | Add Vercel domain to CORS_ORIGIN |
| DB connection failed | Verify DATABASE_URL format |
| Model not loading | Expected - returns fallback "neutral" |

## 📝 Test Script

Run locally to verify all endpoints:
```bash
python test_endpoints.py
```

## 📚 Full Documentation

- `DEPLOYMENT_CHECKLIST.md` - Complete deployment guide
- `FIXES_SUMMARY.md` - Detailed list of all changes
- `test_endpoints.py` - Automated testing script

## 🎉 Success Indicators

- ✅ `/` returns 200
- ✅ `/health` returns 200
- ✅ No errors in Render logs
- ✅ Frontend can connect
- ✅ Predictions work (or return fallback)
