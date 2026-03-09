// Server version _v5.8 (ver 8)
// FINAL VERSION: Avatar working + Layout CORRECTED
// Left column: Avatar card container (placeholder shows here)
// Right column: Debug console (safe from popup masking)

const express = require('express');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const nodemailer = require('nodemailer');

dotenv.config();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3000;
const RENDER_DOMAIN = process.env.RENDER_DOMAIN || 'http://localhost:3000';

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

let debugLogs = [];
function addDebugLog(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [${type.toUpperCase()}] ${message}`;
    debugLogs.push(logEntry);
    console.log(logEntry);
}

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'form-page.html'));
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

function detectAvatarType(script) {
    if (script.includes('<iframe')) return 'modern';
    else if (script.includes('<script')) return 'legacy';
    return 'unknown';
}

function detectContextIdFormat(contextId) {
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const legacyPattern = /^[0-9a-f]{32}$/i;
    if (uuidPattern.test(contextId)) return 'uuid';
    else if (legacyPattern.test(contextId)) return 'legacy';
    return 'unknown';
}

function extractScriptContent(scriptTag) {
    const match = scriptTag.match(/<script[^>]*>([\s\S]*?)<\/script>/i);
    return match ? match[1].trim() : scriptTag;
}

function extractIframeSrc(iframeTag) {
    const match = iframeTag.match(/src=["']([^"']+)["']/i);
    return match ? match[1] : '';
}

function escapeHtml(text) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return text.replace(/[&<>"']/g, m => map[m]);
}

app.post('/api/create-avatar-page', async (req, res) => {
    debugLogs = [];
    
    try {
        addDebugLog('NEW REQUEST', 'info');
        const { contextName, contextId, avatarScript, email } = req.body;

        if (!contextName || !contextId || !avatarScript || !email) {
            addDebugLog('Missing required fields', 'error');
            return res.status(400).json({ message: 'Missing required fields' });
        }

        addDebugLog(`Processing: ${contextName}`, 'info');

        const avatarType = detectAvatarType(avatarScript);
        const contextIdFormat = detectContextIdFormat(contextId);
        addDebugLog(`Avatar Type: ${avatarType} | Context ID Format: ${contextIdFormat}`, 'info');

        if (contextIdFormat === 'legacy') {
            addDebugLog(`Info: Legacy format - skipping API fetch`, 'info');
        }

        const pageSlug = contextName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        const pageUrl = `${RENDER_DOMAIN}/avatars/${pageSlug}.html`;

        addDebugLog(`Generating page: ${pageSlug}`, 'info');
        
        let avatarContent = '';
        if (avatarType === 'modern') {
            avatarContent = extractIframeSrc(avatarScript);
        } else if (avatarType === 'legacy') {
            avatarContent = extractScriptContent(avatarScript);
        }

        const htmlContent = generateAvatarPage({
            contextName,
            contextId,
            avatarType,
            avatarContent,
            pageSlug,
            debugLogs
        });

        const outputDir = path.join(__dirname, 'avatars');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        const filePath = path.join(outputDir, `${pageSlug}.html`);
        fs.writeFileSync(filePath, htmlContent);
        addDebugLog(`Page saved successfully`, 'success');

        await sendEmailNotification(email, contextName, pageUrl);
        addDebugLog(`Email sent to ${email}`, 'success');

        res.status(200).json({
            success: true,
            message: 'Avatar page created successfully',
            pageUrl,
            debug: debugLogs
        });

    } catch (error) {
        addDebugLog(`Error: ${error.message}`, 'error');
        res.status(500).json({ 
            message: 'Internal server error', 
            error: error.message, 
            debug: debugLogs 
        });
    }
});

function generateAvatarPage({ contextName, contextId, avatarType, avatarContent, pageSlug, debugLogs }) {
    
    const debugHtml = debugLogs.map(log => {
        if (log.includes('[SUCCESS]')) {
            return '<div class="success">' + escapeHtml(log) + '</div>';
        } else if (log.includes('[ERROR]')) {
            return '<div class="error">' + escapeHtml(log) + '</div>';
        } else if (log.includes('[WARNING]')) {
            return '<div class="warning">' + escapeHtml(log) + '</div>';
        } else {
            return '<div class="info">' + escapeHtml(log) + '</div>';
        }
    }).join('');

    let avatarScript = '';
    if (avatarType === 'modern') {
        avatarScript = `
      const iframe = document.createElement('iframe');
      iframe.src = '${escapeHtml(avatarContent)}';
      iframe.title = '${escapeHtml(contextName)} Avatar';
      iframe.allow = 'microphone; camera; autoplay; fullscreen';
      iframe.allowFullscreen = true;
      card.appendChild(iframe);
        `;
    } else {
        avatarScript = `
      const wrapper = document.createElement('div');
      wrapper.id = 'avatar-wrapper';
      wrapper.style.width = '100%';
      wrapper.style.height = '100%';
      wrapper.style.position = 'relative';
      card.appendChild(wrapper);

      const bodyAppendChild = document.body.appendChild;
      const wrapperAppendChild = wrapper.appendChild.bind(wrapper);

      document.body.appendChild = function(element) {
        if (element.id === 'heygen-streaming-embed') {
          return wrapperAppendChild(element);
        }
        return bodyAppendChild.call(document.body, element);
      };

      (function() {
        ${avatarContent}
      })();

      document.body.appendChild = bodyAppendChild;
        `;
    }

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Avatar Agentic AI – ${escapeHtml(contextName)}</title>

  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@700;900&family=Cinzel:wght@600&family=Raleway:wght@400;600&display=swap" rel="stylesheet" />

  <style>
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
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .content-right {
      display: flex;
      flex-direction: column;
      justify-content: flex-start;
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

    .debug-console {
      width: 100%;
      background: #0a0a0a;
      border: 1px solid var(--gold-deep);
      border-radius: 8px;
      padding: 15px;
      font-family: 'Courier New', monospace;
      font-size: 0.7rem;
      color: #0f0;
      max-height: 450px;
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
      }
    }
  </style>
</head>
<body>

  <section class="hero" aria-label="Main heading">
    <canvas id="starCanvas" aria-hidden="true"></canvas>
    <div class="hero-content">
      <h1 class="main-heading">Avatar Agentic AI</h1>
      <hr class="hero-rule" />
    </div>
  </section>

  <section class="subhero" aria-label="Sub-heading">
    <h2 class="sub-heading">${escapeHtml(contextName)}</h2>
  </section>

  <section class="content-wrapper">
    <div class="content-left">
      <div class="avatar-card" id="avatarCard"></div>
    </div>
    
    <div class="content-right">
      <div class="debug-console">
        <div class="title">Debug Console - v5.8</div>
        <div class="info">Avatar Type: ${avatarType}</div>
        <div class="info">Context: ${escapeHtml(contextName)}</div>
        <div class="info">Context ID Format: ${detectContextIdFormat(contextId)}</div>
        <div class="info">Page: ${pageSlug}</div>
        <div class="info">────────────────────────</div>
        ${debugHtml}
      </div>
    </div>
  </section>

  <footer>
    &copy; 2025 Avatar Agentic AI | Powered by Avatar Agentic AI Pte Ltd
  </footer>

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

  <script>
    const card = document.getElementById('avatarCard');
    ${avatarScript}
  </script>

</body>
</html>`;
}

async function sendEmailNotification(email, contextName, pageUrl) {
    const mailOptions = {
        from: process.env.SMTP_FROM || 'noreply@avatarai.com',
        to: email,
        subject: `Avatar Page Created: ${contextName}`,
        html: `<h2>Your Avatar Page is Ready!</h2><p>Your avatar page for <strong>${escapeHtml(contextName)}</strong> has been created.</p><p><a href="${escapeHtml(pageUrl)}">View Your Avatar</a></p>`
    };
    return transporter.sendMail(mailOptions);
}

app.get('/avatars/:slug.html', (req, res) => {
    const filePath = path.join(__dirname, 'avatars', req.params.slug + '.html');
    if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
    } else {
        res.status(404).json({ message: 'Avatar page not found' });
    }
});

app.listen(PORT, () => {
    console.log(`✅ Avatar Agentic AI v5.8 running on port ${PORT}`);
});

module.exports = app;
