import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { v2 as cloudinary } from 'cloudinary';

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env') });

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
// Increase payload limit to support base64 uploads for analysis
app.use(express.json({ limit: '50mb' }));

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

// Initial fetch and hourly rotation interval
fetchGooglePublicKeys();
setInterval(fetchGooglePublicKeys, 3600 * 1000);

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
    const projectId = process.env.FIREBASE_PROJECT_ID;
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

// Middleware: Check if authenticated user's email is on the allow-list
const checkAllowList = (req, res, next) => {
  const email = req.user.email ? req.user.email.toLowerCase() : '';
  const allowedEmails = process.env.ALLOWED_EMAILS
    ? process.env.ALLOWED_EMAILS.split(',').map(e => e.trim().toLowerCase())
    : [];

  if (!allowedEmails.includes(email)) {
    return res.status(403).json({ error: 'Forbidden: Access denied. Email not on allow-list.' });
  }
  next();
};

// Test route
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'AI Health Brain server is running.' });
});

// Endpoint: Verify user email status
app.get('/api/verify-user', verifyFirebaseToken, checkAllowList, (req, res) => {
  res.json({ allowed: true, email: req.user.email });
});

// Endpoint: Get secure Cloudinary signature for file uploads
app.post('/api/upload-signature', verifyFirebaseToken, checkAllowList, (req, res) => {
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

// Endpoint: Secure Gemini API Proxy
app.post('/api/gemini', verifyFirebaseToken, checkAllowList, async (req, res) => {
  const { prompt, systemInstruction, history, fileData, jsonMode } = req.body;

  if (!prompt && !fileData) {
    return res.status(400).json({ error: 'Prompt or file data is required' });
  }

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    // Prepare inline file part if provided
    let inlinePart = null;
    if (fileData) {
      if (fileData.base64 && fileData.mimeType) {
        inlinePart = {
          inlineData: {
            data: fileData.base64,
            mimeType: fileData.mimeType
          }
        };
      } else if (fileData.url) {
        console.log('[Gemini] Fetching remote document from URL for analysis...');
        const fetchResponse = await fetch(fileData.url);
        if (!fetchResponse.ok) {
          throw new Error(`Failed to fetch remote document from storage: ${fetchResponse.statusText}`);
        }
        const arrayBuffer = await fetchResponse.arrayBuffer();
        const base64Data = Buffer.from(arrayBuffer).toString('base64');
        let contentType = fileData.mimeType || fetchResponse.headers.get('content-type') || 'application/pdf';
        // Normalize typical extension names to valid mime types if needed
        if (contentType === 'jpg' || contentType === 'jpeg') contentType = 'image/jpeg';
        if (contentType === 'png') contentType = 'image/png';
        if (contentType === 'pdf') contentType = 'application/pdf';
        if (contentType === 'webp') contentType = 'image/webp';

        inlinePart = {
          inlineData: {
            data: base64Data,
            mimeType: contentType
          }
        };
      }
    }

    // Use robust fallback array starting with official working gemini-flash-latest
    const candidateModels = [
      'gemini-flash-latest',
      'gemini-pro-latest',
      'gemini-3.5-flash',
      'gemini-2.0-flash-lite'
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
    console.error('Gemini API Error:', error);
    res.status(500).json({ error: 'Failed to communicate with Gemini API', details: error.message });
  }
});

// Serve frontend build in production (when hosted together on Render/Railway/Fly)
if (process.env.NODE_ENV === 'production') {
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

