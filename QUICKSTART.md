# 🚀 Quick Start Guide - CallWaitingAI Voice API

Get your Voice API Gateway running in 5 minutes!

---

## Prerequisites

- Node.js 18+ installed
- Supabase account
- Vapi account (already configured)

---

## Step 1: Configure Environment

```bash
cd backend
```

Edit `.env` and add missing values:

```env
# ✅ Already configured
VAPI_PRIVATE_KEY=27dbe3f9-8abd-4894-8d2f-0d70f19c8374
VAPI_PUBLIC_KEY=ddd720c5-6fb8-4174-b7a6-729d7b308cb9
VAPI_PHONE_ID=15c07867-d296-4ece-ba91-f8fa068f894e
TELEGRAM_CHAT_ID=6526780056
SUPABASE_URL=https://bcufohulqrceytkrqpgd.supabase.co

# ⚠️ TODO: Add these
SUPABASE_SERVICE_KEY=your-service-key-here
TELEGRAM_BOT_TOKEN=your-bot-token-here
```

**Get Supabase Service Key:**
1. Go to https://app.supabase.com
2. Select project: `bcufohulqrceytkrqpgd`
3. Settings → API → Copy "service_role" key

**Get Telegram Bot Token (Optional):**
1. Message [@BotFather](https://t.me/botfather) on Telegram
2. Send `/newbot`
3. Follow prompts
4. Copy token

---

## Step 2: Run Database Migrations

1. Go to [Supabase SQL Editor](https://app.supabase.com/project/bcufohulqrceytkrqpgd/sql)
2. Click "New query"
3. Copy entire contents of `migrations.sql`
4. Paste and click "Run"
5. Verify success message appears

---

## Step 3: Install Dependencies

```bash
npm install
```

---

## Step 4: Start Server

```bash
npm run dev
```

You should see:

```
═══════════════════════════════════════════════════════════
  CallWaitingAI Voice API Gateway
═══════════════════════════════════════════════════════════
  Environment: development
  Port: 3000
  URL: http://localhost:3000
```

---

## Step 5: Test It!

### Test Health Endpoint

Open browser: http://localhost:3000/health

Should see:

```json
{
  "status": "healthy",
  "timestamp": "...",
  "version": "1.0.0"
}
```

### Test with cURL

```bash
curl http://localhost:3000/health
```

### Test Frontend Connection

1. Open new terminal
2. Start frontend:

```bash
cd ../voice-reception-ai
npm run dev
```

3. Open http://localhost:8080
4. Log in
5. Find voice test component
6. Click "Test Connection"
7. Should show "API healthy!"

---

## Step 6: Make a Test Call

### Get Supabase JWT Token

1. Log in to your frontend
2. Open browser DevTools → Console
3. Run:

```javascript
const { data } = await (await fetch('http://localhost:8080')).supabase.auth.getSession();
console.log(data.session.access_token);
```

4. Copy the token

### Make API Call

```bash
curl -X POST http://localhost:3000/api/voice/v1/call \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "assistantId": "15c07867-d296-4ece-ba91-f8fa068f894e",
    "customer": {
      "number": "+14155551234",
      "name": "Test User"
    }
  }'
```

Replace `YOUR_TOKEN_HERE` with actual token.

### Expected Response

```json
{
  "success": true,
  "call": {
    "id": "abc123...",
    "status": "queued",
    "customer": {
      "number": "+14155551234"
    },
    "createdAt": "2025-..."
  },
  "callsRemaining": 49
}
```

---

## Common Issues

### "SUPABASE_SERVICE_KEY environment variable is required"

**Solution:** Add service key to `.env` file

### "Cannot connect to backend"

**Solution:** Ensure server is running (`npm run dev`)

### "Unauthorized"

**Solution:** Get fresh JWT token from frontend

### Port 3000 already in use

**Solution:** Kill existing process or change `PORT` in `.env`

```bash
lsof -ti:3000 | xargs kill -9
```

---

## Next Steps

✅ Backend running locally
✅ Database migrations complete
✅ Test call successful

**Now you can:**

1. **Deploy to Production** - Follow `DEPLOYMENT_GUIDE.md`
2. **Configure Webhooks** - Set up Vapi webhooks to receive call events
3. **Test Full Flow** - Make real calls and verify lead capture

---

## Useful Commands

```bash
# Development
npm run dev          # Start dev server with hot reload

# Production
npm run build        # Compile TypeScript
npm start            # Start production server

# Type checking
npm run type-check   # Check TypeScript errors

# Logs
tail -f logs/*.log   # Follow application logs
```

---

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | ✅ | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | ✅ | Service role key (secret) |
| `VAPI_PRIVATE_KEY` | ✅ | Vapi private API key |
| `VAPI_PHONE_ID` | ✅ | Vapi phone number ID |
| `TELEGRAM_BOT_TOKEN` | ⚠️ | Optional (for notifications) |
| `TELEGRAM_CHAT_ID` | ⚠️ | Optional (your Telegram ID) |
| `FLUTTERWAVE_SECRET_KEY` | ⚠️ | Optional (for payments) |

---

## Need Help?

- **Full Documentation**: See `README.md`
- **Deployment Guide**: See `DEPLOYMENT_GUIDE.md`
- **Project Overview**: See `VOICE_API_IMPLEMENTATION_SUMMARY.md`

---

**Happy coding! 🎉**
