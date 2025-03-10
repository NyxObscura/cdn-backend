const express = require('express');
const multer = require('multer');
const axios = require('axios');
const rateLimit = require('express-rate-limit');

const app = express();

// Konfigurasi
const GITHUB_TOKEN = process.env.GITHUB_PERSONAL_ACCESS_TOKEN; // Token GitHub dari environment variable
const GITHUB_USERNAME = process.env.USERNAME_GITHUB; // Username GitHub dari environment variable
const REPO_NAME = process.env.REPO_GITHUB; // Nama repository dari environment variable
const BRANCH = process.env.BRANCH_REPO; // Branch yang digunakan dari environment variable
const GITHUB_API_URL = `https://api.github.com/repos/${GITHUB_USERNAME}/${REPO_NAME}/contents/`;

// Batasi ukuran file maksimal 25 MB
const upload = multer({
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'video/mp4',
      'video/avi',
      'video/quicktime',
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('File type not allowed. Only images (JPEG, PNG, GIF) and videos (MP4, AVI, MOV) are accepted.'));
    }
  },
});

// Rate limiting untuk anti-spam (20 upload per menit, blokir selama 30 detik jika melebihi)
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 menit
  max: 20, // Maksimal 20 request per IP dalam 1 menit
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many upload attempts. Please try again in 30 seconds.',
    });
  },
});
app.use(limiter);

// Middleware untuk pretty print JSON
app.set('json spaces', 2); // Format JSON dengan 2 spasi indentasi

// Middleware untuk memblokir metode selain POST
app.use((req, res, next) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed. Only POST requests are accepted.' });
  }
  next();
});

// Endpoint untuk upload file
app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }

    const file = req.file;
    const fileContent = file.buffer.toString('base64'); // Konversi file ke base64
    const filePath = `uploads/${file.originalname}`; // Path di repo GitHub

    // Data untuk GitHub API
    const data = {
      message: `Upload file ${file.originalname}`,
      content: fileContent,
      branch: BRANCH,
    };

    // Kirim ke GitHub API
    const response = await axios.put(GITHUB_API_URL + filePath, data, {
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        'User-Agent': 'Node.js-Upload-Script',
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (response.status === 201) {
      return res.json({ success: true, url: response.data.content.download_url });
    } else {
      return res.status(500).json({ error: 'Failed to upload to GitHub', details: response.data });
    }
  } catch (error) {
    console.error(error);
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File size exceeds limit. Maximum file size is 25MB.' });
    }
    if (error.message.includes('File type not allowed')) {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Export sebagai Vercel Serverless Function
module.exports = app;
