# 🚀 AGENTIC AVATAR AI - QUICK START GUIDE

## **REQUIRED API KEYS**

You will need **ONE mandatory key** to get started:

### **1. HEYGEN_API_KEY** (Essential ✅)
- **Where:** HeyGen Dashboard → Settings → API Keys
- **What it does:** Fetches context/knowledge base from HeyGen
- **Format:** String like `hg_live_abc123def456ghi789...`
- **Cost:** Free with HeyGen account

### **2. RENDER_DOMAIN** (Auto-generated)
- **Where:** Provided by Render after deployment
- **Example:** `https://agentic-avatar-demo.onrender.com`

### **3. AGENTIC_WEBHOOK_URL** (Optional)
- **Where:** Your n8n or LangGraph instance (if using automation)
- **When needed:** Only if you want AI workflows to auto-trigger
- **Example:** `https://n8n.company.com/webhook/avatar-created`

---

## **GITHUB SETUP (5 minutes)**

### **Step 1: Create Repository**
```bash
# Fork or create new repo at:
https://github.com/Krish1959/agentic-avatar-ai

# OR clone existing:
git clone https://github.com/Krish1959/agentic-avatar-ai.git
cd agentic-avatar-ai
```

### **Step 2: Add Files to GitHub**
Your repo should contain:
```
agentic-avatar-ai/
├── form-page.html          ← Part A: User form
├── server.js               ← Part B: Backend service
├── package.json            ← Dependencies
├── .env.example            ← Example config
├── .gitignore              ← Files to ignore
└── README.md               ← Documentation
```

### **Step 3: Push to GitHub**
```bash
git add .
git commit -m "Initial: Agentic Avatar AI application"
git push origin main
```

---

## **RENDER.COM DEPLOYMENT (10 minutes)**

### **Step 1: Connect to Render**
1. Go to https://render.com
2. Sign up → Authorize with GitHub
3. Click "New +" → "Web Service"
4. Select your GitHub repository
5. Configure:
   - **Name:** agentic-avatar-ai
   - **Environment:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Plan:** Free or Paid (Free has limitations)

### **Step 2: Set Environment Variables**
In Render Dashboard → Your Service → Environment:

```
HEYGEN_API_KEY = your_actual_key_here
HEYGEN_API_BASE = https://api.liveavatar.com
NODE_ENV = production
PORT = 3000
RENDER_DOMAIN = https://your-service-name.onrender.com
```

*Don't forget to update RENDER_DOMAIN with your actual Render URL!*

### **Step 3: Deploy**
- Click "Create Web Service"
- Render builds & deploys automatically
- Wait for "Live" status (2-5 minutes)
- Your app is now at: `https://your-service-name.onrender.com`

### **Step 4: Test It**
```bash
# Health check
curl https://your-service-name.onrender.com/api/health

# Open in browser
https://your-service-name.onrender.com
```

---

## **PART A: FORM PAGE EXPLAINED**

**What it does:** Collects user input for avatar context creation

**Form Fields:**
1. **Context Name** - Name of your AI context (e.g., "FinanceBot_v2")
2. **Context ID** - UUID from HeyGen (format: xxx-xxx-xxx-xxx-xxx)
3. **LiveAvatar Embed Script** - iframe code (copy from LiveAvatar)
4. **Email** - For notifications

**What happens on submit:**
- Client validates input
- Sends POST to `/api/create-avatar-page`
- Displays loading spinner
- Redirects to generated page on success

---

## **PART B: BACKEND SERVICE EXPLAINED**

**What it does:** 
1. Receives form data from Part A
2. Fetches context from HeyGen API using Context ID
3. Generates static HTML page
4. Saves to `/generated-pages/avatars/`
5. Triggers optional webhook for AI workflows

**API Endpoints:**
- `POST /api/create-avatar-page` - Create new avatar page
- `GET /api/health` - Health check
- `GET /` - Serve form page
- `GET /avatars/*.html` - Access generated pages

**Generated Page Layout:**
```
┌─────────────────────────────────────────┐
│     Golden Header (Avatar Agentic AI)   │
├──────────────────┬──────────────────────┤
│  Left (8 cols):  │  Right (4 cols):    │
│  - Context text  │  - Avatar iframe    │
│  - Context ID    │  - Microphone input │
├──────────────────┴──────────────────────┤
│  References (extracted URLs)            │
├─────────────────────────────────────────┤
│  Footer (metadata, contact info)        │
└─────────────────────────────────────────┘
```

---

## **OPTIONAL: WEBHOOK INTEGRATION**

To enable AI automation when pages are created:

### **For n8n Users:**
1. Create n8n workflow
2. Add "Webhook" trigger node
3. Copy webhook URL
4. In Render → Set `AGENTIC_WEBHOOK_URL` to that URL
5. When form is submitted, n8n workflow auto-triggers

### **For LangGraph Users:**
```python
# Run webhook server alongside main app
from fastapi import FastAPI
from langraph import create_agent

app = FastAPI()

@app.post("/webhook/avatar-created")
async def on_avatar_created(data: dict):
    # LangGraph processes the data
    result = await agent.ainvoke(data)
    return result
```

---

## **TROUBLESHOOTING**

### **Error: "HEYGEN_API_KEY is undefined"**
→ Check Environment variables in Render dashboard

### **Error: "Failed to fetch context"**
→ Verify Context ID is valid UUID format

### **Pages not saving after restart**
→ Render's filesystem is temporary. Use S3 storage for persistence.

### **Webhook not triggering**
→ Check n8n/LangGraph webhook URL exactly matches AGENTIC_WEBHOOK_URL

---

## **NEXT STEPS**

✅ **Immediate (Production Ready):**
- Deploy to Render
- Test form submission
- Verify page generation

🔄 **Short Term (Recommended):**
- Set up n8n webhook for email notifications
- Add database for tracking pages
- Enable S3 storage for persistence

🚀 **Future (Enterprise Features):**
- Build admin dashboard
- Add MCP interface for Claude/ChatGPT
- Implement advanced content enrichment
- Multi-user support with authentication

---

**For complete deployment guide, see: DEPLOYMENT_GUIDE.md**
