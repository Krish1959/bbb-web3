// Server version _v5
// UPDATED FOR DUAL AVATAR SUPPORT
// Changes from v4:
// - Support BOTH Old (Interactive Avatar) and New (Live Avatar) formats
// - Detect avatar type automatically (script tag vs iframe)
// - Support both Context ID formats (UUID with hyphens or legacy 32-char hex)
// - Removed "HeyGen" mentions - replaced with generic "Avatar" references
// - Auto-detects and handles both avatar script types seamlessly

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

const AVATAR_API_KEY = process.env.HEYGEN_API_KEY || process.env.AVATAR_API_KEY;
const AVATAR_API_BASE = process.env.HEYGEN_API_BASE || process.env.AVATAR_API_BASE || 'https://api.liveavatar.com';
const RENDER_DOMAIN = process.env.RENDER_DOMAIN || 'localhost:3000';

// Debug logging array
const debugLogs = [];

function addDebugLog(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [${type.toUpperCase()}] ${message}`;
    console.log(logEntry);
    debugLogs.push(logEntry);
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
 * Detect avatar type from script
 * Returns: 'modern' (iframe) or 'legacy' (script tag)
 */
function detectAvatarType(script) {
    if (script.includes('<iframe')) {
        return 'modern';  // Modern Live Avatar format
    } else if (script.includes('<script')) {
        return 'legacy';  // Legacy Interactive Avatar format
    }
    return 'unknown';
}

/**
 * Detect context ID format
 * Returns: 'uuid' (with hyphens) or 'legacy' (32 hex chars)
 */
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

/**
 * POST /api/create-avatar-page
 * Main endpoint for creating avatar pages
 * Supports both Old Interactive Avatar and New Live Avatar
 */
app.post('/api/create-avatar-page', async (req, res) => {
    try {
        addDebugLog('--- NEW REQUEST ---', 'info');
        const { contextName, contextId, avatarScript, email } = req.body;

        if (!contextName || !contextId || !avatarScript || !email) {
            const error = 'Missing required fields (contextName, contextId, avatarScript, email)';
            addDebugLog(error, 'error');
            return res.status(400).json({ message: error });
        }

        addDebugLog(`Processing: ${contextName}`, 'info');
        addDebugLog(`API Key present: ${AVATAR_API_KEY ? '✅ Yes' : '❌ No'}`, 'info');

        // Detect avatar types
        const avatarType = detectAvatarType(avatarScript);
        const contextIdFormat = detectContextIdFormat(contextId);
        addDebugLog(`Avatar Type Detected: ${avatarType} | Context ID Format: ${contextIdFormat}`, 'info');

        // Fetch context from Avatar API (if API key is available)
        let contextData = null;
        if (AVATAR_API_KEY) {
            try {
                addDebugLog(`Fetching context from Avatar API...`, 'info');
                contextData = await fetchAvatarContext(contextId);
                addDebugLog(`✅ Avatar API fetch successful`, 'success');
            } catch (error) {
                addDebugLog(`⚠️ Avatar API Error (continuing anyway): ${error.message}`, 'warning');
                contextData = null; // Continue without context data
            }
        } else {
            addDebugLog(`⚠️ No API key configured - skipping context fetch`, 'warning');
            contextData = null;
        }

        // Generate static HTML page
        const pageSlug = contextName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        const pageUrl = `${RENDER_DOMAIN}/avatars/${pageSlug}.html`;
        
        addDebugLog(`Generating page: ${pageSlug}`, 'info');
        const htmlContent = generateAvatarPage({
            contextName,
            contextId,
            avatarScript,
            avatarType,
            contextData,
            email,
            pageSlug,
            debugLogs
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
            avatarType,
            contextIdFormat,
            createdAt: new Date().toISOString()
        };

        logPageMetadata(metadata);
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
 * Fetch context from Avatar API
 * v5: Handles both old and new context formats
 */
async function fetchAvatarContext(contextId) {
    try {
        const url = `${AVATAR_API_BASE}/v1/contexts/${contextId}`;
        addDebugLog(`API Call: ${url}`, 'info');
        addDebugLog(`Auth Method: X-API-Key header`, 'info');
        
        const response = await axios.get(url, {
            headers: {
                'X-API-Key': AVATAR_API_KEY,
                'Content-Type': 'application/json'
            },
            timeout: 10000
        });

        addDebugLog(`✅ Response Status: ${response.status} ${response.statusText}`, 'success');
        
        // Extract from NESTED data structure
        // Avatar API returns: { code, data: { ... }, message }
        const nestedData = response.data.data || response.data;
        
        addDebugLog(`Response structure: code=${response.data.code}, data keys=${Object.keys(nestedData).join(', ')}`, 'info');

        // Extract content from multiple possible fields
        const contextContent = nestedData.description || 
                             nestedData.content || 
                             nestedData.prompt ||
                             nestedData.opening_intro ||
                             'No context content available';

        const contentLength = contextContent.length;
        addDebugLog(`✅ Context content extracted: ${contentLength} characters`, 'success');

        return {
            id: nestedData.id || contextId,
            name: nestedData.name || 'Unnamed Context',
            description: nestedData.description || '',
            content: contextContent,
            opening_intro: nestedData.opening_intro || '',
            urls: nestedData.urls || [],
            persona: nestedData.persona || '',
            metadata: nestedData.metadata || {}
        };

    } catch (error) {
        addDebugLog(`API Error Status: ${error.response?.status || 'Unknown'}`, 'error');
        addDebugLog(`API Error: ${error.response?.data?.message || error.message}`, 'error');
        throw new Error(`Avatar API Error (${error.response?.status}): ${error.response?.data?.message || error.message}`);
    }
}

/**
 * Generate HTML page
 * v5: Supports both avatar types (modern iframe and legacy script)
 */
function generateAvatarPage({ contextName, contextId, avatarScript, avatarType, contextData, email, pageSlug, debugLogs }) {
    const contextText = (contextData?.content || 'Context content available').substring(0, 1000);
    const references = contextData ? extractUrls(contextData.content || '') : [];

    return `<!DOCTYPE html>
<!-- server_v5.js - DUAL AVATAR SUPPORT -->
<!-- Supports both Modern Live Avatar (iframe) and Legacy Interactive Avatar (script) -->
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Avatar Agentic AI - ${escapeHtml(contextName)}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; min-height: 100vh; background: #f5f5f5; }

        /* Glittering dark brown header */
        .header {
            background: linear-gradient(135deg, #3d2314 0%, #5c3a2d 25%, #3d2314 50%, #5c3a2d 75%, #3d2314 100%);
            background-size: 400% 400%;
            animation: glitter 3s ease-in-out infinite;
            padding: 40px 20px;
            text-align: center;
            position: relative;
            overflow: hidden;
            color: white;
        }

        .header::before {
            content: '';
            position: absolute;
            top: 0;
            left: -100%;
            width: 200%;
            height: 100%;
            background: linear-gradient(
                90deg,
                transparent 0%,
                rgba(255, 215, 0, 0.1) 25%,
                rgba(255, 215, 0, 0.3) 50%,
                rgba(255, 215, 0, 0.1) 75%,
                transparent 100%
            );
            animation: shimmer 2.5s infinite;
        }

        @keyframes glitter {
            0%, 100% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
        }

        @keyframes shimmer {
            0% { transform: translateX(-50%); }
            100% { transform: translateX(50%); }
        }

        .header h1 {
            color: #FFD700;
            font-size: 2.5rem;
            font-weight: 700;
            text-shadow: 0 0 20px rgba(255, 215, 0, 0.4), 2px 2px 4px rgba(0, 0, 0, 0.5);
            letter-spacing: 2px;
            position: relative;
            z-index: 1;
            margin-bottom: 5px;
        }

        .header h2 {
            color: rgba(255, 215, 0, 0.9);
            font-size: 1.2rem;
            font-weight: 400;
            position: relative;
            z-index: 1;
        }

        .gold-divider {
            height: 3px;
            background: linear-gradient(90deg, transparent 0%, #FFD700 50%, transparent 100%);
        }

        .container {
            max-width: 1400px;
            margin: 30px auto;
            padding: 20px;
        }

        .content-wrapper {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 30px;
            margin-bottom: 30px;
        }

        .content-left, .content-right {
            background: white;
            padding: 30px;
            border-radius: 12px;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
            overflow: hidden;
            display: flex;
            flex-direction: column;
        }

        .content-left h3, .content-right h3 {
            color: #3d2314;
            font-size: 1.5rem;
            margin-bottom: 20px;
            border-bottom: 2px solid #FFD700;
            padding-bottom: 10px;
        }

        .content-left p {
            color: #555;
            line-height: 1.6;
            margin-bottom: 15px;
            text-align: justify;
        }

        .content-left code {
            background: #f0f0f0;
            padding: 2px 6px;
            border-radius: 4px;
            font-family: 'Courier New', monospace;
            color: #c41e3a;
        }

        .content-right {
            min-height: 500px;
            justify-content: center;
            align-items: center;
            padding: 20px;
        }

        /* Handle both iframe and script embed styles */
        .content-right iframe {
            width: 100%;
            height: 600px;
            border: none;
            border-radius: 8px;
            flex-grow: 1;
        }

        .content-right script {
            display: block;
            width: 100%;
        }

        #heygen-streaming-embed {
            max-width: 100% !important;
        }

        .references {
            background: white;
            padding: 30px;
            border-radius: 12px;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
            margin-top: 30px;
            width: 100%;
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
            width: 100%;
        }

        .metadata a {
            color: #3d2314;
            text-decoration: none;
            font-weight: bold;
        }

        .metadata a:hover {
            text-decoration: underline;
        }

        .debug-console {
            background: #1a1a1a;
            color: #0f0;
            padding: 20px;
            border-radius: 8px;
            font-family: 'Courier New', monospace;
            font-size: 0.75rem;
            line-height: 1.5;
            margin-top: 30px;
            max-height: 400px;
            overflow-y: auto;
            border: 3px solid #FFD700;
            width: 100%;
        }

        .debug-console .title {
            color: #FFD700;
            font-weight: bold;
            margin-bottom: 10px;
            border-bottom: 1px solid #FFD700;
            padding-bottom: 10px;
        }

        .debug-console .info { color: #0f0; }
        .debug-console .error { color: #f00; }
        .debug-console .success { color: #0f0; }
        .debug-console .warning { color: #ff0; }

        @media (max-width: 1024px) {
            .content-wrapper { grid-template-columns: 1fr; }
            .references ul { columns: 1; }
            .content-right iframe { height: 450px; }
        }
    </style>
</head>
<body>
    <header class="header">
        <h1>Avatar Agentic AI Demo</h1>
        <h2>Interactive AI Assistant for ${escapeHtml(contextName)}</h2>
    </header>
    <div class="gold-divider"></div>

    <div class="container">
        <div class="content-wrapper">
            <div class="content-left">
                <h3>📚 Context Information</h3>
                <p>${escapeHtml(contextText)}</p>
                <p><strong>Context ID:</strong> <code>${escapeHtml(contextId)}</code></p>
                ${contextData?.opening_intro ? `<p><strong>Welcome:</strong> ${escapeHtml(contextData.opening_intro)}</p>` : ''}
            </div>
            <div class="content-right">
                ${avatarScript}
            </div>
        </div>

        ${references.length > 0 ? '<div class="references"><h3>📖 References</h3><ul>' + 
            references.map(url => '<li><a href="' + escapeHtml(url) + '" target="_blank" rel="noopener">' + escapeHtml(url) + '</a></li>').join('') + 
            '</ul></div>' : ''}

        <div class="metadata">
            <p>Generated by <strong>Avatar Agentic AI Pte Ltd.</strong> | Page: ${pageSlug} | v5.0</p>
            <p>Avatar Type: ${avatarType} | Created: ${new Date().toLocaleString()} | Support: <a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></p>
        </div>

        <div class="debug-console">
            <div class="title">✅ Debug Console - v5.0 Dual Avatar Support</div>
            <div class="info">═══════════════════════════════════════════════════════════</div>
            <div class="success">✅ Avatar Type: ${avatarType} (${avatarType === 'modern' ? 'Modern iframe-based' : 'Legacy script-based'})</div>
            <div class="success">✅ Context ID Format: ${escapeHtml(contextIdFormat)}</div>
            <div class="info">Context: ${escapeHtml(contextName)}</div>
            <div class="info">ID: ${escapeHtml(contextId)}</div>
            <div class="info">Page: ${pageSlug}</div>
            <div class="info">Generated: ${new Date().toISOString()}</div>
            <div class="info">═══════════════════════════════════════════════════════════</div>
            <div class="info"><strong>Execution Log:</strong></div>
            ${debugLogs.map(log => {
                let className = 'info';
                if (log.includes('[ERROR]')) className = 'error';
                if (log.includes('[SUCCESS]')) className = 'success';
                if (log.includes('[WARNING]')) className = 'warning';
                return `<div class="${className}">${escapeHtml(log)}</div>`;
            }).join('')}
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

async function sendEmailNotification(email, contextName, pageUrl, metadata) {
    try {
        addDebugLog(`Sending email to: ${email}`, 'info');

        if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
            addDebugLog(`⚠️ Email service not configured`, 'warning');
            return;
        }

        const mailOptions = {
            from: process.env.SMTP_FROM || 'agentic.avai@gmail.com',
            to: email,
            subject: `✅ Your Avatar Page is Ready! - ${contextName}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #3d2314;">🎉 Your Avatar Page Has Been Created!</h2>
                    <p>Your avatar context <strong>${escapeHtml(contextName)}</strong> is now live!</p>
                    <p><strong>Avatar Type:</strong> ${metadata.avatarType === 'modern' ? 'Modern (Live)' : 'Legacy (Interactive)'}</p>
                    <p><a href="${pageUrl}" style="display: inline-block; background: #FFD700; color: #3d2314; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">View Your Avatar Page →</a></p>
                    <p style="font-size: 0.9rem; color: #666; margin-top: 20px;">Avatar Agentic AI Pte Ltd.</p>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);
        addDebugLog(`✅ Email sent successfully`, 'success');

    } catch (error) {
        addDebugLog(`❌ Email failed: ${error.message}`, 'error');
    }
}

function logPageMetadata(metadata) {
    const logDir = path.join(__dirname, 'logs');
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
    fs.appendFileSync(path.join(logDir, 'pages-generated.jsonl'), JSON.stringify(metadata) + '\n');
}

app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'Avatar Agentic AI',
        version: 'v5.0-PRODUCTION',
        features: ['Modern Avatar (iframe)', 'Legacy Avatar (script)', 'Dual Context ID Support'],
        timestamp: new Date().toISOString(),
        auth: '✅ X-API-Key',
        avatar_api: AVATAR_API_KEY ? '✅ Configured' : '⚠️ Optional',
        email_service: process.env.SMTP_USER ? '✅ Configured' : '❌ Not configured'
    });
});

app.get('/api/debug', (req, res) => {
    res.json({
        debug_logs: debugLogs,
        total_logs: debugLogs.length,
        version: 'v5.0',
        timestamp: new Date().toISOString()
    });
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'form-page.html'));
});

app.use((err, req, res, next) => {
    addDebugLog(`Unhandled error: ${err.message}`, 'error');
    res.status(500).json({ message: 'Internal Server Error', error: err.message });
});

app.listen(PORT, () => {
    addDebugLog(`🤖 Avatar Agentic AI v5.0 PRODUCTION running on port ${PORT}`, 'success');
    addDebugLog(`✅ Dual Avatar Support: Modern (iframe) + Legacy (script)`, 'success');
    addDebugLog(`✅ Context ID Support: UUID + Legacy 32-char hex format`, 'success');
    addDebugLog(`✅ X-API-Key authentication enabled`, 'success');
    addDebugLog(`Environment: ${process.env.NODE_ENV}`, 'info');
});

