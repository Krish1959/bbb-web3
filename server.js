const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { v4: uuidv4 } = require('uuid');
const nodemailer = require('nodemailer');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;
const HEYGEN_API_BASE = process.env.HEYGEN_API_BASE || 'https://api.liveavatar.com';
const RENDER_DOMAIN = process.env.RENDER_DOMAIN || 'localhost:3000';

// Debug logging array
const debugLogs = [];

function addDebugLog(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [${type.toUpperCase()}] ${message}`;
    console.log(logEntry);
    debugLogs.push(logEntry);
    // Keep last 100 logs
    if (debugLogs.length > 100) debugLogs.shift();
}

// Email transporter setup
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.SMTP_USER || 'agentic.avai@gmail.com',
        pass: process.env.SMTP_PASS || ''
    }
});

// Test email connection
transporter.verify((error, success) => {
    if (error) {
        addDebugLog(`❌ Email service error: ${error.message}`, 'error');
    } else {
        addDebugLog('✅ Email service ready', 'success');
    }
});

app.use(express.json({ limit: '10mb' }));
app.use(express.static('.'));

/**
 * POST /api/create-avatar-page
 * Main endpoint for creating avatar pages
 */
app.post('/api/create-avatar-page', async (req, res) => {
    try {
        addDebugLog('--- NEW REQUEST ---', 'info');
        const { contextName, contextId, iframeScript, email } = req.body;

        // Validation
        if (!contextName || !contextId || !iframeScript || !email) {
            const error = 'Missing required fields';
            addDebugLog(error, 'error');
            return res.status(400).json({ message: error });
        }

        addDebugLog(`Processing: ${contextName}`, 'info');
        addDebugLog(`API Key present: ${HEYGEN_API_KEY ? '✅ Yes' : '❌ No'}`, 'info');

        // Fetch context from HeyGen API
        let contextData;
        try {
            addDebugLog(`Fetching from HeyGen: ${contextId}`, 'info');
            contextData = await fetchHeyGenContext(contextId);
            addDebugLog(`✅ HeyGen fetch successful`, 'success');
        } catch (error) {
            addDebugLog(`❌ HeyGen API Error: ${error.message}`, 'error');
            return res.status(400).json({ 
                message: 'Failed to fetch context from HeyGen API',
                error: error.message,
                debug: debugLogs
            });
        }

        // Generate static HTML page
        const pageSlug = contextName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        const pageUrl = `${RENDER_DOMAIN}/avatars/${pageSlug}.html`;
        
        addDebugLog(`Generating page: ${pageSlug}`, 'info');
        const htmlContent = generateAvatarPage({
            contextName,
            contextId,
            iframeScript,
            contextData,
            email,
            pageSlug
        });

        // Save to file system
        const outputDir = path.join(__dirname, 'avatars');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        const filePath = path.join(outputDir, `${pageSlug}.html`);
        fs.writeFileSync(filePath, htmlContent);
        addDebugLog(`✅ Page saved: ${filePath}`, 'success');

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

        // Send email notification
        await sendEmailNotification(email, contextName, pageUrl, metadata);

        addDebugLog(`✅ All tasks completed`, 'success');

        res.status(200).json({
            success: true,
            message: 'Avatar page created successfully',
            pageUrl,
            metadata,
            debug: debugLogs
        });

    } catch (error) {
        addDebugLog(`❌ Unexpected error: ${error.message}`, 'error');
        res.status(500).json({ 
            message: 'Internal server error',
            error: error.message,
            debug: debugLogs
        });
    }
});

/**
 * Fetch context from HeyGen API
 */
async function fetchHeyGenContext(contextId) {
    try {
        const url = `${HEYGEN_API_BASE}/v1/contexts/${contextId}`;
        addDebugLog(`Making API call to: ${url}`, 'info');
        
        const response = await axios.get(url, {
            headers: {
                'X-API-Key': HEYGEN_API_KEY,
                'Content-Type': 'application/json'
            },
            timeout: 10000
        });

        addDebugLog(`API Response status: ${response.status}`, 'info');

        if (!response.data) {
            throw new Error('No data in response');
        }

        return {
            id: response.data.id || contextId,
            name: response.data.name || 'Unnamed Context',
            description: response.data.description || '',
            content: response.data.content || response.data.description || 'Context content available',
            metadata: response.data.metadata || {}
        };

    } catch (error) {
        addDebugLog(`API Error Details:`, 'error');
        addDebugLog(`  Status: ${error.response?.status || 'Unknown'}`, 'error');
        addDebugLog(`  Message: ${error.response?.data?.message || error.message}`, 'error');
        throw new Error(`HeyGen API Error: ${error.response?.data?.message || error.message}`);
    }
}

/**
 * Generate HTML page
 */
function generateAvatarPage({ contextName, contextId, iframeScript, contextData, email, pageSlug }) {
    const contextText = (contextData.content || 'Context content available').substring(0, 500);
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

        .debug-console {
            background: #1a1a1a;
            color: #0f0;
            padding: 15px;
            border-radius: 8px;
            font-family: 'Courier New', monospace;
            font-size: 0.8rem;
            line-height: 1.4;
            margin-top: 30px;
            max-height: 300px;
            overflow-y: auto;
            border: 2px solid #FFD700;
        }

        .debug-console .info { color: #0f0; }
        .debug-console .error { color: #f00; }
        .debug-console .success { color: #0f0; }
        .debug-console .warning { color: #ff0; }

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

        <div class="debug-console" id="debugConsole">
            <div class="info">Debug Console - Page Generation Details</div>
            <div class="info">=====================================</div>
            <div class="info">Context Name: ${escapeHtml(contextName)}</div>
            <div class="info">Context ID: ${escapeHtml(contextId)}</div>
            <div class="info">Page Slug: ${pageSlug}</div>
            <div class="info">Generated: ${new Date().toISOString()}</div>
            <div class="info">API Base: ${HEYGEN_API_BASE}</div>
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

/**
 * Send email notification
 */
async function sendEmailNotification(email, contextName, pageUrl, metadata) {
    try {
        addDebugLog(`Sending email to: ${email}`, 'info');

        if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
            addDebugLog(`⚠️ Email credentials not configured`, 'warning');
            return;
        }

        const mailOptions = {
            from: process.env.SMTP_FROM || 'agentic.avai@gmail.com',
            to: email,
            subject: `✅ Your Avatar Page is Ready! - ${contextName}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #3d2314;">🎉 Your Avatar Page Has Been Created!</h2>
                    
                    <p>Hello,</p>
                    
                    <p>Your avatar context <strong>${escapeHtml(contextName)}</strong> has been successfully processed and is now live!</p>
                    
                    <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <h3 style="color: #FFD700;">📄 Page Details</h3>
                        <p><strong>Context Name:</strong> ${escapeHtml(contextName)}</p>
                        <p><strong>Page URL:</strong> <a href="${pageUrl}" style="color: #FFD700;">${pageUrl}</a></p>
                        <p><strong>Created:</strong> ${new Date().toLocaleString()}</p>
                    </div>
                    
                    <p>
                        <a href="${pageUrl}" style="display: inline-block; background: #FFD700; color: #3d2314; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                            View Your Avatar Page →
                        </a>
                    </p>
                    
                    <hr style="border: none; border-top: 2px solid #FFD700; margin: 30px 0;">
                    
                    <p style="font-size: 0.9rem; color: #666;">
                        Generated by <strong>Avatar Agentic AI Pte Ltd.</strong><br>
                        Contact: support@avataragentic.com
                    </p>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);
        addDebugLog(`✅ Email sent successfully`, 'success');

    } catch (error) {
        addDebugLog(`❌ Email send failed: ${error.message}`, 'error');
    }
}

function logPageMetadata(metadata) {
    const logDir = path.join(__dirname, 'logs');
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
    fs.appendFileSync(path.join(logDir, 'pages-generated.jsonl'), JSON.stringify(metadata) + '\n');
}

/**
 * GET /api/health
 */
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'Agentic Avatar AI',
        timestamp: new Date().toISOString(),
        heygen_api: HEYGEN_API_KEY ? '✅ Configured' : '❌ Missing',
        email_service: process.env.SMTP_USER ? '✅ Configured' : '❌ Not configured',
        debug_logs: debugLogs.slice(-20)
    });
});

/**
 * GET /api/debug
 * View all debug logs
 */
app.get('/api/debug', (req, res) => {
    res.json({
        debug_logs: debugLogs,
        total_logs: debugLogs.length,
        timestamp: new Date().toISOString()
    });
});

/**
 * GET /
 */
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'form-page.html'));
});

app.use((err, req, res, next) => {
    addDebugLog(`Unhandled error: ${err.message}`, 'error');
    res.status(500).json({ message: 'Internal Server Error', error: err.message });
});

app.listen(PORT, () => {
    addDebugLog(`🤖 Agentic Avatar AI Backend running on port ${PORT}`, 'success');
    addDebugLog(`Environment: ${process.env.NODE_ENV || 'development'}`, 'info');
});
