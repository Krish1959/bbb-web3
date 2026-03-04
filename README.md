# 🤖 AGENTIC AVATAR AI

**Production-ready system for generating interactive avatar pages using HeyGen API + LangGraph/n8n automation**

---

## **WHAT IS THIS?**

A complete application with 3 parts:
1. **Part A:** Web form to collect user input
2. **Part B:** Backend that fetches HeyGen context and generates static pages
3. **Part C:** Optional agentic workflows (n8n, LangGraph)

---

## **QUICK START (15 min)**

### **1. Get HeyGen API Key**
- Go to heygen.com → Settings → API Keys
- Copy your API key

### **2. Deploy to Render**
- Go to render.com
- Connect your GitHub account
- Create Web Service
- Select `agentic-avatar-ai` repository
- Add Environment Variables:
  - `HEYGEN_API_KEY` = your_key
  - `RENDER_DOMAIN` = https://your-service.onrender.com
- Deploy!

### **3. Test**
```bash
curl https://your-service.onrender.com/api/health
```

---

## **WHAT YOU GET**

**Form Page (Part A):**
- User submits: Context Name, Context ID (UUID), iframe Script, Email
- Client-side validation with golden UI

**Backend (Part B):**
- Fetches context from HeyGen API
- Generates static HTML page
- Saves to /generated-pages/avatars/
- Triggers optional webhook

**Generated Page:**
- Header: Golden text on brown background
- Left column (8 cols): Context content + ID
- Right column (4 cols): Avatar iframe
- Bottom: References (extracted URLs)

---

## **REQUIRED ENVIRONMENT VARIABLES**

```
HEYGEN_API_KEY=your_key_here        (MANDATORY)
HEYGEN_API_BASE=https://api.liveavatar.com  (optional)
NODE_ENV=production
PORT=3000
RENDER_DOMAIN=https://your-service.onrender.com
AGENTIC_WEBHOOK_URL=...              (optional, for automation)
```

---

## **FILES IN THIS PROJECT**

```
├── form-page.html       → Part A: Web form
├── server.js            → Part B: Backend service
├── package.json         → Dependencies
├── .env.example         → Environment template
├── QUICK_START.md       → Quick deployment guide
├── ARCHITECTURE.md      → Design & features
└── README.md            → This file
```

---

## **HOW IT WORKS**

```
User → Form → /api/create-avatar-page → Fetch HeyGen context 
                                              ↓
                                        Generate HTML page
                                              ↓
                                        Save to /avatars/
                                              ↓
                                        (Optional) Webhook
                                              ↓
                                        Return page URL
```

---

## **API ENDPOINTS**

```
GET  /                       → Form page
GET  /api/health             → Health check
POST /api/create-avatar-page → Create page
GET  /avatars/*.html         → Generated page
```

---

## **DEPLOYING TO RENDER**

1. **Repository:** Push code to GitHub
2. **Create Service:** render.com → Web Service
3. **Build:** `npm install`
4. **Start:** `npm start`
5. **Env Vars:** Add HEYGEN_API_KEY + others
6. **Deploy!** Watch logs for "Live" status

---

## **OPTIONAL: AUTOMATION WITH N8N**

When page created → Webhook triggers n8n workflow:
- Send email notification
- Post to Slack
- Update database
- Anything you want!

**Setup:**
1. Create n8n workflow with webhook trigger
2. Copy webhook URL
3. Set `AGENTIC_WEBHOOK_URL` in Render
4. Done!

---

## **OPTIONAL: AUTOMATION WITH LANGGRAPH**

Use LangGraph agents to:
- Analyze page quality
- Make recommendations
- Trigger follow-up actions
- Full reasoning chain

**Setup:** See ARCHITECTURE.md

---

## **MERITS (Why This Solution Works)**

✅ Scalable - handles 100+ submissions  
✅ Modular - parts work independently  
✅ Cost-efficient - ~$0-30/month  
✅ Intelligent - integrates with AI  
✅ Audit-ready - logs everything  
✅ Modern - REST API best practices  

---

## **LIMITATIONS & SOLUTIONS**

| Issue | Solution |
|-------|----------|
| HeyGen rate limits | Add retry logic |
| Pages lost on restart | Use S3 storage |
| No persistent storage | Add PostgreSQL |
| No user dashboard | Build admin panel |
| Security gaps | Add validation + helmet.js |

---

## **WHAT TO CUSTOMIZE**

- Page colors, fonts, layout
- Form fields and validation
- Database integration
- Email templates
- Workflow automation

---

## **TROUBLESHOOTING**

**"HEYGEN_API_KEY undefined"**  
→ Check Render environment variables

**"Failed to fetch context"**  
→ Verify Context ID format and API key validity

**"Pages disappear after restart"**  
→ Use S3 instead of local filesystem

**"Webhook not working"**  
→ Check URL matches exactly and n8n is running

---

## **DOCUMENTATION**

- **QUICK_START.md** - Deploy in 15 min
- **ARCHITECTURE.md** - Design & integration
- **.env.example** - Config template
- **server.js** - Code with comments
- **form-page.html** - UI code

---

## **COST ESTIMATE**

- Render: $0-7/month
- HeyGen API: $5-20/month (usage-based)
- n8n: $10/month (if cloud)
- **Total MVP: $0-30/month**

---

## **NEXT STEPS**

1. Get HeyGen API key
2. Follow QUICK_START.md
3. Deploy to Render
4. Test with your contexts
5. (Optional) Add n8n/LangGraph
6. (Optional) Add database

---

## **SUPPORT**

**Avatar Agentic AI Pte Ltd**  
Contact: Krish Ambady (97890305 HP)  
GitHub: https://github.com/Krish1959

---

**Ready to deploy? → See QUICK_START.md**
