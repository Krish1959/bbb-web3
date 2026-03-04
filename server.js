const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { v4: uuidv4 } = require('uuid');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;
const HEYGEN_API_BASE = process.env.HEYGEN_API_BASE || 'https://api.liveavatar.com';
const RENDER_DOMAIN = process.env.RENDER_DOMAIN || 'localhost:3000';

app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));
app.use(express.static('generated-pages'));

/**
 * POST /api/create-avatar-page
 * Main endpoint: Receives form data, fetches HeyGen context, generates static page
 */
app.post('/api/create-avatar-page', async (req, res) => {
    try {
        const { contextName, contextId, iframeScript, email } = req.body;

        if (!contextName || !contextId || !iframeScript || !email) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        console.log(`[${new Date().toISOString()}] Processing: ${contextName}`);

        // Fetch context from HeyGen API
        let contextData;
        try {
            contextData = await fetchHeyGenContext(contextId);
        } catch (error) {
            console.error('HeyGen API Error:', error.message);
            return res.status(400).json({ 
                message: 'Failed to fetch context from HeyGen API',
                error: error.message 
            });
        }

        // Generate static HTML page
        const pageSlug = contextName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        const pageUrl = `${RENDER_DOMAIN}/avatars/${pageSlug}.html`;
        const htmlContent = generateAvatarPage({ contextName, contextId, iframeScript, contextData, email, pageSlug });

        // Save to file system
        const outputDir = path.join(__dirname, 'generated-pages', 'avatars');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        const filePath = path.join(outputDir, `${pageSlug}.html`);
        fs.writeFileSync(filePath, htmlContent);

        // Log metadata
        const metadata = {
            id: uuidv4(),
            contextName,
            contextId,
            pageSlug,
            pageUrl,
            email,
            createdAt: new Date().toISOString()
        };

        logPageMetadata(metadata);
        triggerAgenticWorkflow(metadata);

        res.status(200).json({ success: true, message: 'Avatar page created', pageUrl, metadata });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
});

// Fetch context from HeyGen API
async function fetchHeyGenContext(contextId) {
    try {
        const response = await axios.get(
            `${HEYGEN_API_BASE}/v1/contexts/${contextId}`,
            {
                headers: {
                    'X-API-Key': HEYGEN_API_KEY,
                    'Content-Type': 'application/json'
                }
            }
        );

        return {
            id: response.data.id,
            name: response.data.name,
            description: response.data.description || '',
            content: response.data.content || '',
            metadata: response.data.metadata || {}
        };

    } catch (error) {
        throw new Error(`HeyGen API Error: ${error.response?.data?.message || error.message}`);
    }
}

// Generate HTML page
function generateAvatarPage({ contextName, contextId, iframeScript, contextData, email, pageSlug }) {
    const contextText = (contextData.content || contextData.description || 'Content unavailable').substring(0, 500);
    const references = extractUrls(contextData.content || '');

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Avatar Agentic AI - ${escapeHtml(contextName)}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; min-height: 100vh; background: #f5f5f5; }

        .header {
            background: linear-gradient(135deg, #3d2314 0%, #5c3a2d 25%, #3d2314 50%, #5c3a2d 75%, #3d2314 100%);
            background-size: 400% 400%;
            animation: glitter 3s ease-in-out infinite;
            padding: 40px 20px;
            text-align: center;
            position: relative;
            overflow: hidden;
        }

        .header::before {
            content: '';
            position: absolute;
            top: 0;
            left: -100%;
            width: 200%;
            height: 100%;
            background: linear-gradient(90deg, transparent 0%, rgba(255, 215, 0, 0.1) 25%, rgba(255, 215, 0, 0.3) 50%, rgba(255, 215, 0, 0.1) 75%, transparent 100%);
            animation: shimmer 2.5s infinite;
        }

        @keyframes glitter { 0%, 100% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } }
        @keyframes shimmer { 0% { transform: translateX(-50%); } 100% { transform: translateX(50%); } }

        .header h1 {
            color: #FFD700;
            font-size: 3rem;
            font-weight: 700;
            text-shadow: 0 0 10px rgba(255, 215, 0, 0.5), 0 0 20px rgba(255, 215, 0, 0.3), 2px 2px 4px rgba(0, 0, 0, 0.5);
            position: relative;
            z-index: 1;
            margin-bottom: 10px;
        }

        .header h2 {
            color: #FFD700;
            font-size: 1.5rem;
            font-weight: 400;
            text-shadow: 0 0 8px rgba(255, 215, 0, 0.4), 1px 1px 3px rgba(0, 0, 0, 0.5);
            position: relative;
            z-index: 1;
        }

        .gold-divider {
            height: 3px;
            background: linear-gradient(90deg, transparent 0%, rgba(255, 215, 0, 0.3) 20%, rgba(255, 215, 0, 0.8) 50%, rgba(255, 215, 0, 0.3) 80%, transparent 100%);
        }

        .container { max-width: 1400px; margin: 30px auto; padding: 20px; }

        .content-wrapper { display: grid; grid-template-columns: 2fr 1fr; gap: 30px; margin-bottom: 30px; }

        .content-left {
            background: white;
            padding: 30px;
            border-radius: 12px;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
        }

        .content-left h3 {
            color: #3d2314;
            font-size: 1.5rem;
            margin-bottom: 15px;
            border-bottom: 2px solid #FFD700;
            padding-bottom: 10px;
        }

        .content-left p {
            color: #555;
            line-height: 1.8;
            margin-bottom: 15px;
        }

        .content-right {
            background: white;
            padding: 20px;
            border-radius: 12px;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
            overflow: hidden;
        }

        .content-right iframe {
            width: 100%;
            height: 500px;
            border: none;
            border-radius: 8px;
        }

        .references {
            background: white;
            padding: 30px;
            border-radius: 12px;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
            margin-top: 30px;
        }

        .references h3 {
            color: #3d2314;
            font-size: 1.5rem;
            margin-bottom: 20px;
            border-bottom: 2px solid #FFD700;
            padding-bottom: 10px;
        }

        .references ul { list-style: none; columns: 2; column-gap: 30px; }
        .references li { margin-bottom: 12px; break-inside: avoid; }
        .references a { color: #FFD700; text-decoration: none; font-weight: 500; word-break: break-all; }
        .references a:hover { text-decoration: underline; }

        .metadata {
            background: #E8D4A8;
            padding: 20px;
            text-align: center;
            margin-top: 30px;
            border-radius: 8px;
            font-size: 0.85rem;
            color: #333;
        }

        @media (max-width: 1024px) {
            .content-wrapper { grid-template-columns: 1fr; }
            .references ul { columns: 1; }
        }
    </style>
</head>
<body>
    <header class="header">
        <h1>Avatar Agentic AI Demo</h1>
        <h2>Interactive GPT for ${escapeHtml(contextName)}</h2>
    </header>
    <div class="gold-divider"></div>

    <div class="container">
        <div class="content-wrapper">
            <div class="content-left">
                <h3>📚 Context Information</h3>
                <p>${escapeHtml(contextText)}</p>
                <p><strong>Context ID:</strong> ${escapeHtml(contextId)}</p>
            </div>
            <div class="content-right">
                ${iframeScript}
            </div>
        </div>

        ${references.length > 0 ? '<div class="references"><h3>📖 References</h3><ul>' + 
            references.map(url => '<li><a href="' + escapeHtml(url) + '" target="_blank">' + escapeHtml(url) + '</a></li>').join('') + 
            '</ul></div>' : ''}

        <div class="metadata">
            <p>Generated by <strong>Avatar Agentic AI Pte Ltd.</strong> | Page: ${pageSlug}</p>
            <p>Created: ${new Date().toLocaleString()} | Contact: <a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></p>
        </div>
    </div>
</body>
</html>`;
}

function extractUrls(text) {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const matches = text.match(urlRegex) || [];
    return [...new Set(matches)].slice(0, 10);
}

function escapeHtml(text) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return String(text).replace(/[&<>"']/g, m => map[m]);
}

function logPageMetadata(metadata) {
    const logDir = path.join(__dirname, 'logs');
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
    fs.appendFileSync(path.join(logDir, 'pages-generated.jsonl'), JSON.stringify(metadata) + '\n');
}

function triggerAgenticWorkflow(metadata) {
    const webhookUrl = process.env.AGENTIC_WEBHOOK_URL;
    if (!webhookUrl) return;

    axios.post(webhookUrl, {
        event: 'avatar_page_created',
        timestamp: new Date().toISOString(),
        data: metadata
    }).catch(error => console.error('Webhook error:', error.message));
}

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', service: 'Agentic Avatar AI', timestamp: new Date().toISOString() });
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'form-page.html'));
});

app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({ message: 'Internal Server Error' });
});

app.listen(PORT, () => {
    console.log(`🤖 Agentic Avatar AI Backend running on port ${PORT}`);
});
