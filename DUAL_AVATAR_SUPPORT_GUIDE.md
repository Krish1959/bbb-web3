# 🎬 DUAL AVATAR SUPPORT - UPDATE GUIDE v5.0

## Overview

Your **bbb-web3** has been updated to support **BOTH**:
- ✅ **Modern Avatar** (Live Avatar with iframe)
- ✅ **Legacy Avatar** (Interactive Avatar with script tags)

All changes are **backward compatible** - old contexts still work!

---

## 📋 FILES UPDATED

### 1️⃣ **form-page_v6.html** (NEW)
   - Removed UUID-only pattern restriction
   - Added support for both Context ID formats
   - Changed field label: "Avatar Embedded Script" (not "LiveAvatar")
   - Helper text: "Copy the complete embed code from Avatar" (not "from LiveAvatar")
   - Detects both <iframe> and <script> tags

### 2️⃣ **server_v5.js** (NEW)
   - Auto-detects avatar type (modern vs legacy)
   - Auto-detects context ID format (UUID vs legacy)
   - Supports both script injection methods
   - Removed all "HeyGen" mentions
   - API calls remain optional (works without API key)

### 3️⃣ **package.json** (NO CHANGES NEEDED)
   - Already has all dependencies

---

## 🔄 WHAT'S NEW IN v5

### Feature 1: Dual Context ID Support

| Format | Example | Type | Support |
|--------|---------|------|---------|
| **UUID (new)** | `6c1a5496-737a-469b-9baf-55ee076f7686` | UUID with hyphens | ✅ v5 |
| **Legacy (old)** | `04712c1a9a9a45a3827afa66927bee3c` | 32 hex chars | ✅ v5 |

**Code Detection:**
```javascript
function detectContextIdFormat(contextId) {
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const legacyPattern = /^[0-9a-f]{32}$/i;
    
    if (uuidPattern.test(contextId)) return 'uuid';
    else if (legacyPattern.test(contextId)) return 'legacy';
    return 'unknown';
}
```

---

### Feature 2: Dual Avatar Script Support

#### **Modern Format (iframe)**
```html
<iframe src="https://embed.liveavatar.com/v1/7ecdd8fb-193b-4fa5-a06d-081a04920a16" 
        allow="microphone" 
        title="Avatar Embed" 
        style="aspect-ratio: 16/9;"></iframe>
```

**Auto-detected as:** `modern`

---

#### **Legacy Format (script tag)**
```html
<script>!function(window){
    const host="https://labs.heygen.com",
    url=host+"/guest/streaming-embed?share=...";
    // ... rest of script
}(globalThis);</script>
```

**Auto-detected as:** `legacy`

---

### Feature 3: Auto-Detection Logic

**In server_v5.js:**
```javascript
function detectAvatarType(script) {
    if (script.includes('<iframe')) {
        return 'modern';   // Live Avatar format
    } else if (script.includes('<script')) {
        return 'legacy';   // Interactive Avatar format
    }
    return 'unknown';
}
```

The system **automatically detects** which type and handles it accordingly!

---

## 🚀 DEPLOYMENT STEPS

### Step 1: Replace Form File
```bash
# OLD → NEW
form-page.html  →  form-page_v6.html

# Then rename
mv form-page_v6.html form-page.html
```

### Step 2: Replace Server File
```bash
# OLD → NEW
server.js  →  server_v5.js

# Then rename
mv server_v5.js server.js
```

### Step 3: Git Commit & Push
```bash
git add form-page.html server.js
git commit -m "Feature: v5.0 - Dual Avatar Support (Modern + Legacy formats)"
git push origin main
```

### Step 4: Render Auto-Deploys
- Render will rebuild automatically
- Status changes: Building → Deploying → Live ✅
- **Wait 2-5 minutes**

---

## ✅ TESTING THE UPDATE

### Test 1: Modern Avatar (Live Avatar)

**Form Input:**
```
Context Name: TestModern
Context ID: 6c1a5496-737a-469b-9baf-55ee076f7686
Avatar Script: <iframe src="https://embed.liveavatar.com/v1/6c1a5496..." style="aspect-ratio: 16/9;"></iframe>
Email: test@example.com
```

**Expected:**
- ✅ Page created
- ✅ Debug shows: "Avatar Type Detected: modern"
- ✅ iframe displays in page

---

### Test 2: Legacy Avatar (Interactive Avatar)

**Form Input:**
```
Context Name: TestLegacy
Context ID: 04712c1a9a9a45a3827afa66927bee3c
Avatar Script: <script>!function(window){const host="https://labs.heygen.com"...}(globalThis);</script>
Email: test@example.com
```

**Expected:**
- ✅ Page created
- ✅ Debug shows: "Avatar Type Detected: legacy"
- ✅ Script embeds and runs in page

---

### Test 3: Both Context ID Formats

**UUID Format Test:**
```
Context ID: 6c1a5496-737a-469b-9baf-55ee076f7686
Expected: "Context ID Format: uuid" in debug
```

**Legacy Format Test:**
```
Context ID: 04712c1a9a9a45a3827afa66927bee3c
Expected: "Context ID Format: legacy" in debug
```

---

## 🔍 WHAT CHANGED IN DETAILS

### form-page.html Changes

#### Before (v4):
```html
<label for="contextId" class="required">Context ID</label>
<input 
    type="text" 
    id="contextId" 
    pattern="^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"
    ... />
```
❌ Only accepts UUID format (with hyphens)

#### After (v6):
```html
<label for="contextId" class="required">Context ID</label>
<input 
    type="text" 
    id="contextId"
    placeholder="e.g., 6c1a5496-737a-469b-9baf-55ee076f7686 or 04712c1a9a9a45a3827afa66927bee3c"
    ... />
```
✅ Accepts both formats

---

#### Before (v4):
```html
<label for="iframeScript" class="required">LiveAvatar Embed Script</label>
```
❌ "LiveAvatar" specific

#### After (v6):
```html
<label for="avatarScript" class="required">Avatar Embedded Script</label>
```
✅ Generic "Avatar" naming

---

#### Before (v4):
```html
<div class="helper-text">Copy the complete iframe embed code from LiveAvatar</div>
```
❌ Specific to Live Avatar

#### After (v6):
```html
<div class="helper-text">Copy the complete embed code from Avatar</div>
<div class="format-note">✓ Supports both Modern iframe and Legacy script formats</div>
```
✅ Supports both formats with clear messaging

---

### server.js Changes

#### Form Field Naming
```javascript
// BEFORE (v4)
const { contextName, contextId, iframeScript, email } = req.body;

// AFTER (v5)
const { contextName, contextId, avatarScript, email } = req.body;
```

---

#### Auto-Detection Added
```javascript
// NEW: Auto-detect avatar type
const avatarType = detectAvatarType(avatarScript);
const contextIdFormat = detectContextIdFormat(contextId);
addDebugLog(`Avatar Type: ${avatarType} | Context ID Format: ${contextIdFormat}`, 'info');
```

---

#### All "HeyGen" Removed
```javascript
// BEFORE
addDebugLog(`Fetching context from HeyGen API...`, 'info');

// AFTER
addDebugLog(`Fetching context from Avatar API...`, 'info');
```

**All instances:**
- ❌ "HeyGen API" → ✅ "Avatar API"
- ❌ "HeyGen_API_KEY" → ✅ "AVATAR_API_KEY" (backward compatible)
- ❌ "HeyGen embed code" → ✅ "Avatar embed code"

---

#### API Call Now Optional
```javascript
// NEW: Gracefully handles missing API key
if (AVATAR_API_KEY) {
    try {
        contextData = await fetchAvatarContext(contextId);
    } catch (error) {
        addDebugLog(`⚠️ Avatar API Error (continuing anyway)`, 'warning');
        contextData = null; // Continue without context
    }
} else {
    addDebugLog(`⚠️ No API key configured - skipping context fetch`, 'warning');
}
```

**Result:** Form still works even if API key is missing!

---

## 📊 DEBUG OUTPUT EXAMPLES

### Modern Avatar (iframe)
```
[2026-03-07...] [INFO] Avatar Type Detected: modern | Context ID Format: uuid
[2026-03-07...] [SUCCESS] ✅ Avatar Type: modern (Modern iframe-based)
[2026-03-07...] [SUCCESS] ✅ Context ID Format: uuid
```

### Legacy Avatar (script)
```
[2026-03-07...] [INFO] Avatar Type Detected: legacy | Context ID Format: legacy
[2026-03-07...] [SUCCESS] ✅ Avatar Type: legacy (Legacy script-based)
[2026-03-07...] [SUCCESS] ✅ Context ID Format: legacy
```

---

## 🛡️ BACKWARD COMPATIBILITY

✅ **All old code still works!**

| Aspect | Old (v4) | New (v5) | Compatible? |
|--------|----------|----------|-------------|
| UUID Context IDs | ✅ | ✅ | ✅ Yes |
| Live Avatar (iframe) | ✅ | ✅ | ✅ Yes |
| Environment Variables | ✅ | ✅ | ✅ Yes |
| Generated Pages | ✅ | ✅ | ✅ Yes |
| Email Notifications | ✅ | ✅ | ✅ Yes |
| API Calls (X-API-Key) | ✅ | ✅ | ✅ Yes |

---

## 🌐 ENVIRONMENT VARIABLES

**No new variables needed!** All existing env vars work:

```bash
# Still works in v5
HEYGEN_API_KEY=...
HEYGEN_API_BASE=...
RENDER_DOMAIN=...
SMTP_USER=...
SMTP_PASS=...
```

**Optional (new names, backward compatible):**
```bash
# Alternative names (fallback if HEYGEN_* not set)
AVATAR_API_KEY=...
AVATAR_API_BASE=...
```

---

## 📝 QUICK REFERENCE

### Supported Context ID Formats
| Format | Example | Validation |
|--------|---------|-----------|
| UUID | `6c1a5496-737a-469b-9baf-55ee076f7686` | 8-4-4-4-12 hex chars with hyphens |
| Legacy | `04712c1a9a9a45a3827afa66927bee3c` | 32 hex chars, no hyphens |

### Supported Avatar Scripts
| Type | Tag | Example |
|------|-----|---------|
| Modern | `<iframe>` | `<iframe src="https://embed.liveavatar.com/v1/..." />` |
| Legacy | `<script>` | `<script>!function(window){...}(globalThis);</script>` |

---

## 🐛 TROUBLESHOOTING

### Problem: "Invalid Context ID format"
**Solution:** 
- Check Context ID matches one of: UUID (with hyphens) OR Legacy (32 hex chars)
- Copy-paste exactly from your Avatar provider

### Problem: "Avatar script validation failed"
**Solution:**
- Ensure script contains `<iframe` OR `<script` tag
- Copy entire embed code (not just the URL)

### Problem: "Avatar Type shows 'unknown' in debug"
**Solution:**
- Check your embed code actually contains `<iframe` or `<script` tag
- Copy complete embed code from Avatar

### Problem: API returns error but page still creates
**Expected behavior!**
- API errors are non-fatal in v5
- Page generates without context data
- This is intentional for resilience

---

## ✨ NEW FEATURES SUMMARY

| Feature | v4 | v5 |
|---------|----|----|
| Modern Avatar (iframe) | ✅ | ✅ |
| Legacy Avatar (script) | ❌ | ✅ |
| UUID Context IDs | ✅ | ✅ |
| Legacy Context IDs | ❌ | ✅ |
| Auto-detection | ❌ | ✅ |
| Generic Avatar naming | ❌ | ✅ |
| Optional API key | ❌ | ✅ |
| Both formats in debug | ❌ | ✅ |
| Email shows avatar type | ❌ | ✅ |

---

## 📦 DEPLOYMENT CHECKLIST

- [ ] Download form-page_v6.html
- [ ] Download server_v5.js
- [ ] Rename files to form-page.html and server.js
- [ ] Test locally (optional)
- [ ] Commit to Git
- [ ] Push to GitHub
- [ ] Watch Render redeploy (2-5 mins)
- [ ] Test form with both avatar types
- [ ] Test with both context ID formats
- [ ] Verify debug console shows detected types
- [ ] Confirm emails still send

---

## 🎯 READY TO DEPLOY!

All files are ready. Simply:

1. **Replace** form-page.html with form-page_v6.html
2. **Replace** server.js with server_v5.js
3. **Commit & Push** to GitHub
4. **Render auto-deploys** ✅

**No new environment variables needed!**
**No new dependencies!**
**Full backward compatibility!**

---

**Version:** v5.0  
**Release:** 2026-03-07  
**Status:** ✅ Production Ready
