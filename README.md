# CallWaitingAI Voice API Gateway

White-labeled voice API gateway that proxies Vapi while maintaining ODIADEV branding. Provider-agnostic architecture allows easy migration to ODIADEV-TTS in the future.

---

## 🎯 Features

- ✅ **White-labeled Vapi Proxy** - Hides all Vapi credentials from frontend
- ✅ **RESTful API** - Clean endpoints under `/api/voice/v1`
- ✅ **Supabase Integration** - Stores calls, leads, and logs
- ✅ **Telegram Notifications** - Instant lead alerts
- ✅ **Flutterwave Payments** - Auto-generate payment links for qualified leads
- ✅ **Provider-Agnostic** - Easy migration from Vapi → ODIADEV-TTS
- ✅ **TypeScript** - Fully typed for safety
- ✅ **Security** - JWT authentication, CORS allowlist, webhook verification

---

## 📦 Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Language**: TypeScript
- **Database**: Supabase (PostgreSQL)
- **Voice Provider**: Vapi (swappable to ODIADEV-TTS)
- **Deployment**: Render.com

---

## 🚀 Quick Start

### 1. Prerequisites

- Node.js 18+ installed
- Supabase account with database set up
- Vapi account with API keys
- Telegram bot (optional, for notifications)
- Flutterwave account (optional, for payments)

### 2. Installation

```bash
cd backend
npm install
```

### 3. Environment Setup

Create `.env` file (copy from `.env.example`):

```bash
cp .env.example .env
```

Fill in your credentials:

```env
# Server
NODE_ENV=development
PORT=3000
API_BASE_URL=http://localhost:3000

# Supabase
SUPABASE_URL=https://bcufohulqrceytkrqpgd.supabase.co
SUPABASE_SERVICE_KEY=your-service-key-here
SUPABASE_ANON_KEY=your-anon-key-here

# Vapi
VAPI_PRIVATE_KEY=27dbe3f9-8abd-4894-8d2f-0d70f19c8374
VAPI_PUBLIC_KEY=ddd720c5-6fb8-4174-b7a6-729d7b308cb9
VAPI_PHONE_ID=15c07867-d296-4ece-ba91-f8fa068f894e

# Telegram (optional)
TELEGRAM_BOT_TOKEN=your-bot-token
TELEGRAM_CHAT_ID=6526780056

# Flutterwave (optional)
FLUTTERWAVE_SECRET_KEY=your-secret-key
FLUTTERWAVE_PUBLIC_KEY=your-public-key
```

### 4. Database Setup

Run migrations in Supabase SQL Editor:

```bash
# Copy contents of migrations.sql and run in Supabase dashboard
```

Or use Supabase CLI:

```bash
supabase db push
```

### 5. Run Development Server

```bash
npm run dev
```

Server starts at `http://localhost:3000`

### 6. Test the API

```bash
# Health check
curl http://localhost:3000/health

# Test call (requires authentication)
curl -X POST http://localhost:3000/api/voice/v1/call \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SUPABASE_JWT" \
  -d '{
    "assistantId": "15c07867-d296-4ece-ba91-f8fa068f894e",
    "customer": {
      "number": "+14155551234",
      "name": "Test User"
    }
  }'
```

---

## 📡 API Endpoints

### Public Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/` | API info |
| POST | `/api/voice/v1/webhook/vapi` | Vapi webhook receiver |

### Authenticated Endpoints (Require JWT)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/voice/v1/call` | Initiate outbound call |
| GET | `/api/voice/v1/calls` | List all user calls |
| GET | `/api/voice/v1/call/:callId` | Get call details |
| GET | `/api/voice/v1/assistant/:id` | Get assistant |
| POST | `/api/voice/v1/assistant` | Create assistant |
| PATCH | `/api/voice/v1/assistant/:id` | Update assistant |
| DELETE | `/api/voice/v1/assistant/:id` | Delete assistant |
| GET | `/api/voice/v1/logs` | Get call logs |

---

## 🔐 Authentication

All protected endpoints require a Supabase JWT token:

```javascript
const { data: { session } } = await supabase.auth.getSession();
const token = session.access_token;

fetch('https://api.callwaitingai.dev/api/voice/v1/call', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});
```

---

## 🔔 Webhook Setup

### Configure Vapi Webhook

1. Go to Vapi Dashboard → Settings → Webhooks
2. Add webhook URL: `https://api.callwaitingai.dev/api/voice/v1/webhook/vapi`
3. Select events:
   - `call.started`
   - `call.ended`
   - `call.failed`
   - `transcript`
4. Copy webhook secret and add to `.env` as `VAPI_WEBHOOK_SECRET`

### Webhook Events Handled

- **call.started** - Updates call status in database
- **call.ended** - Saves transcript, extracts lead, sends notifications
- **call.failed** - Logs error and notifies admin
- **transcript** - Real-time transcript processing

---

## 🎨 Provider Migration (Vapi → ODIADEV)

The architecture is designed for easy provider swapping:

### Current: Using Vapi

```env
VOICE_PROVIDER=vapi
VAPI_PRIVATE_KEY=your-key
```

### Future: Switch to ODIADEV-TTS

```env
VOICE_PROVIDER=odiadev
ODIADEV_API_KEY=your-key
ODIADEV_BASE_URL=https://api.odiadev.ai/v1
```

**Implementation Steps:**

1. Create `src/services/odiadev.provider.ts` (same interface as `vapi.service.ts`)
2. Implement `VoiceProvider` interface
3. Update `src/services/vapi.service.ts` to switch based on `VOICE_PROVIDER` env var
4. No frontend changes required!

---

## 📊 Database Schema

### Tables Created by Migrations

- **call_logs** - API request/response logs
- **webhook_events** - Vapi webhook event history
- **leads** - Qualified leads from calls
- **calls** - Call records

### Enhanced Columns Added

- `leads.qualification_score` - AI confidence (0-1)
- `leads.flutterwave_payment_link` - Payment URL
- `leads.payment_status` - pending/completed/failed
- `leads.telegram_notified_at` - Notification timestamp

---

## 🚢 Deployment

### Option 1: Render.com (Recommended)

1. **Push to GitHub**

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin your-repo-url
git push -u origin main
```

2. **Connect Render**

- Go to [Render.com](https://render.com)
- New → Web Service
- Connect your GitHub repo
- Render auto-detects `render.yaml`
- Click "Create Web Service"

3. **Set Environment Variables**

In Render dashboard, add:
- `SUPABASE_SERVICE_KEY`
- `VAPI_PRIVATE_KEY`
- `TELEGRAM_BOT_TOKEN`
- `FLUTTERWAVE_SECRET_KEY`

4. **Configure Custom Domain**

- Render → Settings → Custom Domains
- Add `api.callwaitingai.dev`
- Update DNS:

```
CNAME api.callwaitingai.dev → your-app.onrender.com
```

5. **Update Frontend .env**

```env
VITE_VOICE_API_URL=https://api.callwaitingai.dev
```

### Option 2: Railway

```bash
npm install -g @railway/cli
railway login
railway init
railway up
```

### Option 3: Docker

```bash
docker build -t callwaiting-api .
docker run -p 3000:3000 --env-file .env callwaiting-api
```

---

## 🧪 Testing

### Local Testing with ngrok

```bash
# Terminal 1: Start backend
npm run dev

# Terminal 2: Expose with ngrok
ngrok http 3000
```

Update Vapi webhook URL to: `https://abc123.ngrok.io/api/voice/v1/webhook/vapi`

### Test Telegram Notifications

```bash
# In Node.js REPL
const { telegramService } = require('./dist/services/telegram.service');
await telegramService.testConnection();
```

---

## 📝 Frontend Integration

### Install SDK

Frontend SDK already created at:
```
voice-reception-ai/src/lib/voiceApi.ts
```

### Usage Example

```typescript
import { voiceApi } from '@/lib/voiceApi';

// Initiate call
const result = await voiceApi.initiateCall({
  assistantId: '15c07867-d296-4ece-ba91-f8fa068f894e',
  customerPhone: '+14155551234',
  customerName: 'John Doe'
});

// Get call details
const call = await voiceApi.getCall(result.call.id);

// List user calls
const calls = await voiceApi.listCalls({ limit: 50 });
```

---

## 🐛 Troubleshooting

### Issue: "CORS not allowed"

**Solution:** Add your domain to `src/middleware/cors.middleware.ts`

### Issue: "Unauthorized"

**Solution:** Ensure you're passing valid Supabase JWT in `Authorization` header

### Issue: Webhook not receiving events

**Solution:**
1. Check Vapi dashboard webhook URL is correct
2. Verify webhook secret in `.env`
3. Check server logs for errors

### Issue: Calls not decrementing user quota

**Solution:** Ensure `decrement_calls_remaining` function exists in Supabase

---

## 📚 Project Structure

```
backend/
├── src/
│   ├── routes/           # API route handlers
│   │   ├── call.routes.ts
│   │   ├── assistant.routes.ts
│   │   ├── webhook.routes.ts
│   │   └── logs.routes.ts
│   ├── services/         # Business logic
│   │   ├── vapi.service.ts      # Vapi proxy
│   │   ├── supabase.service.ts  # Database ops
│   │   ├── telegram.service.ts  # Notifications
│   │   └── flutterwave.service.ts # Payments
│   ├── middleware/       # Express middleware
│   │   ├── auth.middleware.ts   # JWT validation
│   │   ├── cors.middleware.ts   # CORS policy
│   │   └── logger.middleware.ts # Request logging
│   ├── types/            # TypeScript definitions
│   │   └── vapi.types.ts
│   └── server.ts         # Express app entry
├── migrations.sql        # Supabase migrations
├── .env.example          # Environment template
├── package.json
├── tsconfig.json
└── README.md
```

---

## 🔒 Security Best Practices

1. ✅ Never expose `VAPI_PRIVATE_KEY` to frontend
2. ✅ Always validate Supabase JWT tokens
3. ✅ Use CORS allowlist
4. ✅ Verify webhook signatures
5. ✅ Sanitize logs (remove sensitive data)
6. ✅ Use HTTPS in production
7. ✅ Rotate API keys regularly

---

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/odiadev/callwaiting-api/issues)
- **Email**: support@odiadev.ai
- **Docs**: https://docs.callwaitingai.dev

---

## 📄 License

MIT License - ODIADEV AI Ltd

---

## 🎉 Next Steps

1. ✅ Deploy backend to Render
2. ✅ Configure custom domain
3. ✅ Update frontend `.env` with production API URL
4. ✅ Set up Vapi webhook
5. ✅ Create Telegram bot and get chat ID
6. ✅ Test end-to-end call flow
7. ✅ Monitor logs in Supabase
8. 🚀 Go live!
