// Server version _v7.5
// FIXED: Proper script execution + Two-column layout
// Left column: blank, Right column: avatar with talking capability

const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { v4: uuidv4 } = require('uuid');
const nodemailer = require('nodemailer');

dotenv.config();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3000;
const RENDER_DOMAIN = process.env.RENDER_DOMAIN || 'http://localhost:3000';
const AVATAR_API_KEY = process.env.HEYGEN_API_KEY || process.env.AVATAR_API_KEY;
const AVATAR_API_BASE = process.env.HEYGEN_API_BASE || process.env.AVATAR_API_BASE || 'https://api.liveavatar.com';

// Email Configuration
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

// Debug logging
let debugLogs = [];
function addDebugLog(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [${type.toUpperCase()}] ${message}`;
    debugLogs.push(logEntry);
    console.log(logEntry);
}

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Form page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'form-page.html'));
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'Server is running' });
});

// Detect avatar type
function detectAvatarType(script) {
    if (script.includes('<iframe')) return 'modern';
    else if (script.includes('<script')) return 'legacy';
    return 'unknown';
}

// Detect context ID format
function detectContextIdFormat(contextId) {
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const legacyPattern = /^[0-9a-f]{32}$/i;
    
    if (uuidPattern.test(contextId)) {
        return 'uuid';
    } else if (legacyPattern.test(contextId)) {
        return 'legacy';
    }
    return 'unknown';
}

// HTML escape
function escapeHtml(text) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return text.replace(/[&<>"']/g, m => map[m]);
}

// Extract script content from script tag
function extractScriptContent(scriptTag) {
    const match = scriptTag.match(/<script[^>]*>([\s\S]*?)<\/script>/i);
    return match ? match[1].trim() : scriptTag;
}

// Extract iframe src
function extractIframeSrc(iframeTag) {
    const match = iframeTag.match(/src=["']([^"']+)["']/i);
    return match ? match[1] : '';
}

// CREATE AVATAR PAGE ENDPOINT
app.post('/api/create-avatar-page', async (req, res) => {
    debugLogs = [];
    
    try {
        addDebugLog('NEW REQUEST', 'info');
        const { contextName, contextId, avatarScript, email } = req.body;

        if (!contextName || !contextId || !avatarScript || !email) {
            const error = 'Missing required fields';
            addDebugLog(error, 'error');
            return res.status(400).json({ message: error });
        }

        addDebugLog(`Processing: ${contextName}`, 'info');

        // Detect types
        const avatarType = detectAvatarType(avatarScript);
        const contextIdFormat = detectContextIdFormat(contextId);
        addDebugLog(`Avatar Type: ${avatarType} | Context ID Format: ${contextIdFormat}`, 'info');

        if (contextIdFormat === 'legacy') {
            addDebugLog(`ℹ️ Legacy format - skipping API fetch`, 'info');
        }

        // Generate page
        const pageSlug = contextName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        const pageUrl = `${RENDER_DOMAIN}/avatars/${pageSlug}.html`;

        addDebugLog(`Generating page: ${pageSlug}`, 'info');
        
        // Extract script/iframe for proper injection
        let avatarContent = '';
        if (avatarType === 'modern') {
            const iframeSrc = extractIframeSrc(avatarScript);
            avatarContent = iframeSrc;
        } else if (avatarType === 'legacy') {
            const scriptContent = extractScriptContent(avatarScript);
            avatarContent = scriptContent;
        }

        const htmlContent = generateAvatarPage({
            contextName,
            contextId,
            avatarType,
            avatarContent,
            email,
            pageSlug,
            debugLogs
        });

        // Save file
        const outputDir = path.join(__dirname, 'avatars');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        const filePath = path.join(outputDir, `${pageSlug}.html`);
        fs.writeFileSync(filePath, htmlContent);
        addDebugLog(`✅ Page saved: ${filePath}`, 'success');

        // Send email
        await sendEmailNotification(email, contextName, pageUrl);
        addDebugLog(`✅ Email sent`, 'success');

        res.status(200).json({
            success: true,
            message: 'Avatar page created successfully',
            pageUrl,
            debug: debugLogs
        });

    } catch (error) {
        addDebugLog(`❌ Error: ${error.message}`, 'error');
        res.status(500).json({
            message: 'Internal server error',
            error: error.message,
            debug: debugLogs
        });
    }
});

// GENERATE AVATAR PAGE FUNCTION
function generateAvatarPage({ contextName, contextId, avatarType, avatarContent, email, pageSlug, debugLogs }) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Avatar Agentic AI – ${escapeHtml(contextName)}</title>

  <!-- Google Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@700;900&family=Cinzel:wght@600&family=Raleway:wght@400;600&display=swap" rel="stylesheet" />

  <style>
    /* ─── Reset & Base ─────────────────────────────────────────────────────── */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html { font-size: clamp(14px, 1.5vw, 18px); }
    body {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      font-family: 'Raleway', sans-serif;
      overflow-x: hidden;
      background: #0D0D1A;
    }

    /* ─── Golden Colour Palette ─────────────────────────────────────────────── */
    :root {
      --gold-light:   #FFE066;
      --gold-mid:     #FFD700;
      --gold-deep:    #C9A84C;
      --gold-shine:   #FFF5B0;
      --dark-brown:   #1A0A00;
      --ocean-blue:   #020E2A;
      --ocean-mid:    #041E42;
      --ocean-bright: #0A3060;
      --body-bg:      #0D0D1A;
    }

    /* ─── HERO ───────────────────────────────────────────────────────── */
    .hero {
      position: relative;
      width: 100%;
      min-height: clamp(220px, 35vh, 380px);
      background: radial-gradient(ellipse at 50% 0%, #3B1500 0%, #1A0A00 55%, #0D0500 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      padding: clamp(2rem, 5vw, 4rem) clamp(1rem, 4vw, 3rem);
    }

    #starCanvas {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
    }

    .hero-content {
      position: relative;
      z-index: 2;
      text-align: center;
    }

    .main-heading {
      font-family: 'Cinzel Decorative', serif;
      font-weight: 900;
      font-size: clamp(1.8rem, 5.5vw, 5rem);
      letter-spacing: clamp(0.05em, 0.4vw, 0.18em);
      text-transform: uppercase;
      line-height: 1.15;
      background: linear-gradient(180deg, var(--gold-shine) 0%, var(--gold-mid) 30%, var(--gold-deep) 65%, var(--gold-mid) 85%, var(--gold-shine) 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      filter: drop-shadow(0 0 12px rgba(255, 215, 0, 0.65)) drop-shadow(0 0 28px rgba(255, 215, 0, 0.35));
      background-size: 100% 200%;
      animation: shimmer 4s ease-in-out infinite alternate;
    }

    @keyframes shimmer {
      0%   { background-position: 0% 0%; }
      100% { background-position: 0% 100%; }
    }

    .hero-rule {
      width: 80px;
      height: 2px;
      border: none;
      background: linear-gradient(90deg, transparent, var(--gold-mid), transparent);
      margin: 1rem 0 0 0;
    }

    /* ─── SUBHERO ─────────────────────────────────────────────────── */
    .subhero {
      background: linear-gradient(135deg, var(--ocean-mid) 0%, var(--ocean-bright) 100%);
      padding: clamp(1.2rem, 3vw, 2rem) 1rem;
      text-align: center;
    }

    .sub-heading {
      font-family: 'Cinzel', serif;
      font-size: clamp(1rem, 2.5vw, 1.8rem);
      font-weight: 600;
      letter-spacing: 0.08em;
      color: var(--gold-light);
      text-transform: uppercase;
    }

    /* ─── TWO COLUMN LAYOUT ───────────────────────────────────────── */
    .content-wrapper {
      flex: 1;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 2rem;
      padding: clamp(2rem, 4vw, 3rem);
      max-width: 1400px;
      margin: 0 auto;
      width: 100%;
    }

    .content-left {
      /* LEFT COLUMN - BLANK AS REQUESTED */
    }

    .content-right {
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .avatar-card {
      width: 100%;
      aspect-ratio: 16 / 9;
      min-height: 450px;
      border-radius: 12px;
      box-shadow: 0 0 0 1px rgba(255, 215, 0, 0.12), 0 8px 40px rgba(0, 0, 0, 0.7), 0 0 60px rgba(255, 215, 0, 0.08);
      background: #000;
      position: relative;
      overflow: hidden;
    }

    .avatar-card iframe {
      width: 100%;
      height: 100%;
      border: 0;
    }

    #avatar-wrapper {
      width: 100%;
      height: 100%;
      position: relative;
    }

    /* Gold corner accents */
    .avatar-card::before, .avatar-card::after {
      content: '';
      position: absolute;
      width: 28px;
      height: 28px;
      border-color: var(--gold-mid);
      border-style: solid;
      opacity: 0.7;
      z-index: 3;
      pointer-events: none;
    }
    .avatar-card::before {
      top: 10px; left: 10px;
      border-width: 3px 0 0 3px;
      border-radius: 4px 0 0 0;
    }
    .avatar-card::after {
      bottom: 10px; right: 10px;
      border-width: 0 3px 3px 0;
      border-radius: 0 0 4px 0;
    }

    /* Debug Console */
    .debug-console {
      width: 100%;
      max-width: 1400px;
      margin: 2rem auto;
      padding: 0 clamp(2rem, 4vw, 3rem);
      background: #0a0a0a;
      border: 1px solid var(--gold-deep);
      border-radius: 8px;
      padding: 15px;
      font-family: 'Courier New', monospace;
      font-size: 0.7rem;
      color: #0f0;
      max-height: 250px;
      overflow-y: auto;
      line-height: 1.3;
    }

    .debug-console .title {
      color: var(--gold-mid);
      font-weight: bold;
      margin-bottom: 8px;
    }

    .debug-console .info { color: #0f0; }
    .debug-console .success { color: #0f0; }
    .debug-console .warning { color: #ff0; }
    .debug-console .error { color: #f00; }

    footer {
      background: var(--dark-brown);
      text-align: center;
      padding: clamp(0.8rem, 2vw, 1.4rem) 1rem;
      font-size: clamp(0.7rem, 1vw, 0.85rem);
      color: var(--gold-deep);
      letter-spacing: 0.08em;
      opacity: 0.75;
    }

    @media (max-width: 768px) {
      .content-wrapper {
        grid-template-columns: 1fr;
        gap: 1rem;
        padding: 1rem;
      }
      .content-left { display: none; }
    }
  </style>
</head>
<body>

  <!-- HERO -->
  <section class="hero" aria-label="Main heading">
    <canvas id="starCanvas" aria-hidden="true"></canvas>
    <div class="hero-content">
      <h1 class="main-heading">Avatar Agentic AI</h1>
      <hr class="hero-rule" />
    </div>
  </section>

  <!-- SUB-HEADING -->
  <section class="subhero" aria-label="Sub-heading">
    <h2 class="sub-heading">${escapeHtml(contextName)}</h2>
  </section>

  <!-- TWO COLUMN LAYOUT -->
  <section class="content-wrapper">
    <div class="content-left">
      <!-- LEFT COLUMN - BLANK (as requested) -->
    </div>
    
    <div class="content-right">
      <div class="avatar-card" id="avatarCard">
        <!-- Avatar injected here -->
      </div>
    </div>
  </section>

  <!-- DEBUG CONSOLE -->
  <div class="debug-console">
    <div class="title">✅ Debug Console - v5.2 - TWO COLUMN LAYOUT</div>
    <div class="info">Avatar Type: ${avatarType}</div>
    <div class="info">Context: ${escapeHtml(contextName)}</div>
    <div class="info">Page: ${pageSlug}</div>
    ${debugLogs.map(log => {
        if (log.includes('[SUCCESS]')) return '<div class="success">' + escapeHtml(log) + '</div>';
        if (log.includes('[ERROR]')) return '<div class="error">' + escapeHtml(log) + '</div>';
        if (log.includes('[WARNING]')) return '<div class="warning">' + escapeHtml(log) + '</div>';
        return '<div class="info">' + escapeHtml(log) + '</div>';
    }).join('')}
  </div>

  <!-- FOOTER -->
  <footer>
    &copy; 2025 Avatar Agentic AI &nbsp;|&nbsp; Powered by Avatar Agentic AI Pte Ltd
  </footer>

  <!-- STAR ANIMATION -->
  <script>
    (function() {
      const canvas = document.getElementById('starCanvas');
      const ctx = canvas.getContext('2d');
      let stars = [];

      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;

      class Star {
        constructor() {
          this.x = Math.random() * canvas.width;
          this.y = Math.random() * canvas.height;
          this.radius = Math.random() * 1.5;
          this.opacity = Math.random() * 0.5 + 0.3;
          this.twinkleSpeed = Math.random() * 0.03 + 0.01;
          this.twinkleDirection = 1;
        }

        update() {
          this.opacity += this.twinkleSpeed * this.twinkleDirection;
          if (this.opacity >= 1 || this.opacity <= 0.2) {
            this.twinkleDirection *= -1;
          }
        }

        draw() {
          ctx.fillStyle = 'rgba(255, 215, 0, ' + this.opacity + ')';
          ctx.fillRect(this.x, this.y, this.radius, this.radius);
        }
      }

      function initStars() {
        stars = [];
        for (let i = 0; i < 100; i++) {
          stars.push(new Star());
        }
      }

      function animate() {
        ctx.fillStyle = 'rgba(13, 5, 0, 0.2)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        stars.forEach(star => {
          star.update();
          star.draw();
        });
        requestAnimationFrame(animate);
      }

      window.addEventListener('resize', () => {
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;
        initStars();
      });

      initStars();
      animate();
    })();
  </script>

  <!-- AVATAR INJECTION -->
  <script>
    const card = document.getElementById('avatarCard');
    
    ${avatarType === 'modern' ? `
      // MODERN AVATAR - iframe injection
      const iframe = document.createElement('iframe');
      iframe.src = '${escapeHtml(avatarContent)}';
      iframe.title = '${escapeHtml(contextName)} Avatar';
      iframe.allow = 'microphone; camera; autoplay; fullscreen';
      iframe.allowFullscreen = true;
      card.appendChild(iframe);
    ` : `
      // LEGACY AVATAR - script execution with appendChild interception
      const wrapper = document.createElement('div');
      wrapper.id = 'avatar-wrapper';
      wrapper.style.width = '100%';
      wrapper.style.height = '100%';
      wrapper.style.position = 'relative';
      card.appendChild(wrapper);

      // Store original appendChild
      const bodyAppendChild = document.body.appendChild;
      const wrapperAppendChild = wrapper.appendChild.bind(wrapper);

      // Override document.body.appendChild to intercept heygen element
      document.body.appendChild = function(element) {
        if (element.id === 'heygen-streaming-embed') {
          console.log('Intercepting heygen element - injecting to wrapper');
          return wrapperAppendChild(element);
        }
        return bodyAppendChild.call(document.body, element);
      };

      // Execute the legacy avatar script
      (function() {
        ${avatarContent}
      })();

      // Restore original appendChild
      document.body.appendChild = bodyAppendChild;
    `}
  </script>

</body>
</html>`;
}

// Send email notification
async function sendEmailNotification(email, contextName, pageUrl) {
    const mailOptions = {
        from: process.env.SMTP_FROM || 'noreply@avatarai.com',
        to: email,
        subject: `Avatar Page Created: ${contextName}`,
        html: `
            <h2>Your Avatar Page is Ready!</h2>
            <p>Your avatar page for <strong>${escapeHtml(contextName)}</strong> has been created successfully.</p>
            <p><a href="${escapeHtml(pageUrl)}" style="background-color: #FFD700; padding: 10px 20px; text-decoration: none; color: black;">View Your Avatar</a></p>
        `
    };

    return transporter.sendMail(mailOptions);
}

// Serve generated avatar pages
app.get('/avatars/:slug.html', (req, res) => {
    const filePath = path.join(__dirname, 'avatars', req.params.slug + '.html');
    if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
    } else {
        res.status(404).json({ message: 'Avatar page not found' });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`✅ Avatar Agentic AI v5.2 running on port ${PORT}`);
});

module.exports = app;
