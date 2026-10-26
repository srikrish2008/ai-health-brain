import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { v2 as cloudinary } from 'cloudinary';

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { safeFetchCloudinaryDocument } from './urlSecurity.js';
import { createRateLimiter } from './rateLimiter.js';
import { validateDocument } from './documentValidator.js';
import { handleVaultDelete } from './vaultDeletion.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// In Vercel serverless environments, dotenv might fail if .env is missing.
// We only need this for local development. Vercel injects process.env directly.
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());

// Sensible, route-appropriate JSON payload size limits
// 15MB for multimodal lab reports in /api/gemini; 1MB baseline for all other API endpoints
const defaultJsonParser = express.json({ limit: '1mb' });
const geminiJsonParser = express.json({ limit: '15mb' });

app.use((req, res, next) => {
  if (req.path === '/api/gemini') {
    return geminiJsonParser(req, res, next);
  }
  return defaultJsonParser(req, res, next);
});

// Middleware: Handle oversized payload (HTTP 413) and malformed JSON cleanly
app.use((err, req, res, next) => {
  if (err.type === 'entity.too.large' || err.status === 413) {
    return res.status(413).json({
      error: 'Payload Too Large: The submitted request body exceeds the maximum permitted size limit.'
    });
  }
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      error: 'Bad Request: Malformed JSON payload in request body.'
    });
  }
  next(err);
});

// Rate limiters: protect expensive endpoints and prevent abuse
const generalApiLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 60,
  message: 'General API rate limit reached. Please wait a moment before sending more requests.'
});

const geminiRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 20,
  message: 'Gemini AI rate limit reached. Please wait a moment before sending more requests.'
});

const vaultRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 30,
  message: 'Health Vault operation rate limit reached. Please wait a moment before uploading or deleting more files.'
});

app.use('/api', generalApiLimiter);

// Initialize Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Cache for Google's public certificates
let googlePublicKeys = {};

const fetchGooglePublicKeys = async () => {
  try {
    const response = await fetch(
      'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com'
    );
    if (response.ok) {
      googlePublicKeys = await response.json();
      console.log('[Auth] Google public certificates loaded/refreshed');
    } else {
      console.error('[Auth] Failed to fetch Google certificates:', response.statusText);
    }
  } catch (error) {
    console.error('[Auth] Error fetching Google public keys:', error);
  }
};

// Initial fetch and hourly rotation interval (skip timer on Vercel Serverless)
if (!process.env.VERCEL) {
  fetchGooglePublicKeys();
  setInterval(fetchGooglePublicKeys, 3600 * 1000);
}

// Middleware: Verify Firebase ID Token cryptographically using jsonwebtoken
const verifyFirebaseToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    // 1. Decode token to find Key ID (kid) in header
    const decodedToken = jwt.decode(token, { complete: true });
    if (!decodedToken || !decodedToken.header || !decodedToken.header.kid) {
      return res.status(401).json({ error: 'Unauthorized: Invalid token format' });
    }

    const kid = decodedToken.header.kid;
    
    // 2. Fetch/resolve the correct public key certificate
    let publicKey = googlePublicKeys[kid];
    if (!publicKey) {
      console.log(`[Auth] Certificate kid ${kid} not cached, fetching fresh keys...`);
      await fetchGooglePublicKeys();
      publicKey = googlePublicKeys[kid];
    }

    if (!publicKey) {
      return res.status(401).json({ error: 'Unauthorized: Unknown certificate Key ID' });
    }

    // 3. Cryptographically verify signature and standard claims
    const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || 'ai-health-brain';
    const decoded = jwt.verify(token, publicKey, {
      algorithms: ['RS256'],
      audience: projectId,
      issuer: `https://securetoken.google.com/${projectId}`
    });

    req.user = decoded;
    next();
  } catch (error) {
    console.error('[Auth] Token verification failed:', error.message);
    return res.status(401).json({ error: 'Unauthorized: Invalid token', details: error.message });
  }
};

// Middleware: Open to all authenticated users (Public App)
const checkAllowList = (req, res, next) => {
  next();
};

// Test route
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'AI Health Brain server is running.' });
});

// Endpoint: Verify user email status (legacy, bypass)
app.get('/api/verify-user', verifyFirebaseToken, (req, res) => {
  res.json({ allowed: true, email: req.user.email });
});

// Endpoint: Get secure Cloudinary signature for file uploads
app.post('/api/upload-signature', verifyFirebaseToken, vaultRateLimiter, (req, res) => {
  try {
    const timestamp = Math.round(new Date().getTime() / 1000);
    const userFolder = `health-vault/${req.user.uid}`;
    const params = {
      timestamp: timestamp,
      folder: userFolder,
    };
    
    const signature = cloudinary.utils.api_sign_request(
      params,
      process.env.CLOUDINARY_API_SECRET
    );
    
    res.json({
      signature,
      timestamp,
      apiKey: process.env.CLOUDINARY_API_KEY,
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      folder: userFolder,
    });
  } catch (error) {
    console.error('Cloudinary Signature Error:', error);
    res.status(500).json({ error: 'Failed to generate Cloudinary signature' });
  }
});

// Endpoint: Securely delete a Cloudinary asset and Firestore record belonging to the authenticated user
app.post('/api/vault/delete-file', verifyFirebaseToken, vaultRateLimiter, async (req, res) => {
  return handleVaultDelete(req, res);
});

// Endpoint: Secure Gemini API Proxy
app.post('/api/gemini', verifyFirebaseToken, geminiRateLimiter, async (req, res) => {
  const { prompt, systemInstruction, history, fileData, jsonMode } = req.body;

  if (!prompt && !fileData) {
    return res.status(400).json({ error: 'Prompt or file data is required' });
  }

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    // Prepare inline file part if provided
    let inlinePart = null;
    if (fileData) {
      try {
        if (fileData.base64) {
          const buffer = Buffer.from(fileData.base64, 'base64');
          const validation = validateDocument(buffer, fileData.mimeType);
          inlinePart = {
            inlineData: {
              data: fileData.base64,
              mimeType: validation.mimeType
            }
          };
        } else if (fileData.url) {
          console.log('[Gemini] Securely fetching document from Cloudinary URL for analysis...');
          const { base64Data, contentType } = await safeFetchCloudinaryDocument(fileData.url, {
            expectedCloudName: process.env.CLOUDINARY_CLOUD_NAME || 'offfbqj0',
            maxSizeBytes: 10 * 1024 * 1024, // 10MB document size limit
            timeoutMs: 10000 // 10-second download timeout
          });

          const buffer = Buffer.from(base64Data, 'base64');
          const validation = validateDocument(buffer, fileData.mimeType || contentType);

          inlinePart = {
            inlineData: {
              data: base64Data,
              mimeType: validation.mimeType
            }
          };
        } else {
          return res.status(400).json({ error: 'fileData must contain either base64 or a valid url.' });
        }
      } catch (docErr) {
        console.warn('[Gemini] Document validation rejected:', docErr.message);
        return res.status(400).json({ error: docErr.message });
      }
    }

    // Robust fallback list of models verified available on current API key
    const candidateModels = [
      'gemini-flash-latest',
      'gemini-3.5-flash',
      'gemini-3.6-flash',
      'gemini-3.7-flash',
      'gemini-3.8-flash',
      'gemini-pro-latest'
    ];
    let lastError = null;
    let result = null;

    for (const modelName of candidateModels) {
      try {
        const modelConfig = {
          model: modelName,
          systemInstruction: systemInstruction || "You are AI Health Brain, a personal health companion. You analyze user's medical logs, reports, and questions, giving clear, empathetic, and scientifically accurate insights. Always recommend consulting a real doctor for medical decisions."
        };

        if (jsonMode) {
          modelConfig.generationConfig = { responseMimeType: 'application/json' };
        }

        const model = genAI.getGenerativeModel(modelConfig);

        if (history && history.length > 0) {
          const chat = model.startChat({
            history: history.map(h => ({
              role: h.role === 'user' ? 'user' : 'model',
              parts: [{ text: h.text }]
            }))
          });
          const messagePayload = inlinePart
            ? [prompt || "Analyze this attached document within our conversation.", inlinePart]
            : prompt;
          result = await chat.sendMessage(messagePayload);
        } else if (inlinePart) {
          result = await model.generateContent([prompt || "Analyze this medical report in detail.", inlinePart]);
        } else {
          result = await model.generateContent(prompt);
        }
        
        // Success!
        lastError = null;
        break;
      } catch (modelErr) {
        console.warn(`[Gemini] Model ${modelName} failed (${modelErr.message}), trying fallback...`);
        lastError = modelErr;
      }
    }

    if (!result || lastError) {
      throw lastError || new Error('All Gemini model candidates failed to generate a response.');
    }

    const response = await result.response;
    const text = response.text();
    res.json({ text });
  } catch (error) {
    console.error('Gemini API Error:', error.message || error);
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ error: error.message || 'Failed to communicate with Gemini API', details: error.message });
  }
});

// Serve frontend build in production (when hosted together on Render/Railway/Fly)
// We SKIP this on Vercel, because Vercel automatically serves static files from `dist`
// via its CDN, and the serverless function does not have access to the `dist` folder.
if (process.env.NODE_ENV === 'production' && !process.env.VERCEL) {
  const distPath = join(__dirname, '../dist');
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    if (!req.url.startsWith('/api')) {
      res.sendFile(join(distPath, 'index.html'));
    }
  });
}

// Start server locally or in stateful host environments
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

// Export Express app for Serverless platforms (Vercel, Netlify Functions, AWS Lambda)
export default app;

