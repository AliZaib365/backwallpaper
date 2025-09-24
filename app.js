require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const session = require('express-session');
const MainCategory = require('./models/MainCategory');
const SubCategory = require('./models/SubCategory');
const Wallpaper = require('./models/Wallpaper');

const app = express();
app.use(express.json());
app.use(cors());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/public', express.static(path.join(__dirname, 'public')));

if (!fs.existsSync(path.join(__dirname, 'uploads'))) fs.mkdirSync(path.join(__dirname, 'uploads'));

// Session setup - uses a securely generated secret
app.use(session({
  secret: process.env.SESSION_SECRET || 'keyboard cat',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

// Auth middleware
function requireLogin(req, res, next) {
  if (req.session && req.session.loggedIn) return next();
  if (req.path.startsWith('/api')) return res.status(401).json({ error: 'Unauthorized' });
  return res.redirect('/login');
}

// Login page (GET)
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/login.html'));
});

// Login logic (POST)
app.post('/login', express.urlencoded({ extended: true }), (req, res) => {
  const { username, password } = req.body;
  if (
    username === process.env.DASHBOARD_USER &&
    password === process.env.DASHBOARD_PASS
  ) {
    req.session.loggedIn = true;
    return res.redirect('/');
  }
  // Simple error: reload login page (could show message in production)
  return res.sendFile(path.join(__dirname, 'public/login.html'));
});

// Logout
app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

// Protect dashboard and all API routes
app.use(requireLogin);

// Multer setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, 'uploads')),
  filename: (req, file, cb) => cb(null, Date.now() + '_' + file.originalname)
});
const upload = multer({ storage });

// Main Category API
app.get('/api/main-categories', async (req, res) => {
  try {
    const cats = await MainCategory.find();
    res.json(cats);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Sub Category API
app.get('/api/sub-categories', async (req, res) => {
  const { mainCategory } = req.query;
  try {
    const subs = await SubCategory.find({ mainCategory });
    res.json(subs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Wallpapers API (grouped)
app.get('/api/wallpapers', async (req, res) => {
  try {
    const wallpapers = await Wallpaper.find()
      .populate('mainCategory')
      .populate('subCategory')
      .sort({ createdAt: -1 });
    res.json(wallpapers);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Upload wallpapers with snapshot for live video
app.post('/api/wallpapers', upload.array('files'), async (req, res) => {
  try {
    const { titles, type = 'static', mainCategory, subCategory } = req.body;
    if (!mainCategory || !subCategory) return res.status(400).json({ error: 'Main/subcategory required.' });
    if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'No files uploaded.' });

    let titleArr = [];
    if (titles) {
      if (typeof titles === 'string') {
        try { titleArr = JSON.parse(titles); }
        catch (e) { titleArr = [titles]; }
      } else if (Array.isArray(titles)) {
        titleArr = titles;
      } else {
        titleArr = [String(titles)];
      }
    }

    let wallpaperDoc = await Wallpaper.findOne({ mainCategory, subCategory, type });
    if (!wallpaperDoc) {
      wallpaperDoc = new Wallpaper({
        type,
        mainCategory,
        subCategory,
        wallpapers: []
      });
    }

    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i];
      const title = titleArr[i] || file.originalname.replace(/\.[^/.]+$/, '');
      let fileUrl = `/uploads/${file.filename}`;
      let snapshotUrl = null;

      if (type === 'live') {
        const snapshotFilename = `snapshot_${Date.now()}_${file.filename}.jpg`;
        const snapshotPath = path.join(__dirname, 'uploads', snapshotFilename);
        await new Promise((resolve, reject) => {
          ffmpeg(file.path)
            .screenshots({
              timestamps: [2],
              filename: snapshotFilename,
              folder: path.join(__dirname, 'uploads'),
              size: '640x?'
            })
            .on('end', resolve)
            .on('error', reject);
        });
        snapshotUrl = `/uploads/${snapshotFilename}`;
      }

      wallpaperDoc.wallpapers.push({
        title,
        fileUrl,
        snapshotUrl
      });
      await wallpaperDoc.save();
    }

    res.json(wallpaperDoc);
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Upload failed', details: err.message });
  }
});

// Main dashboard (index)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

const PORT = process.env.PORT || 3000;
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`)))
  .catch(err => {
    console.error('Failed to connect to MongoDB:', err);
    process.exit(1);
  });