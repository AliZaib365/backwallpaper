require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const MainCategory = require('./models/MainCategory');
const SubCategory = require('./models/SubCategory');
const Wallpaper = require('./models/Wallpaper');

const app = express();
app.use(express.json());
app.use(cors());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/public', express.static(path.join(__dirname, 'public')));

if (!fs.existsSync(path.join(__dirname, 'uploads'))) fs.mkdirSync(path.join(__dirname, 'uploads'));

// Multer setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, 'uploads')),
  filename: (req, file, cb) => cb(null, Date.now() + '_' + file.originalname)
});
const upload = multer({ storage });

// Get main categories
app.get('/api/main-categories', async (req, res) => {
  try {
    const cats = await MainCategory.find();
    res.json(cats);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get subcategories for a main category
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

// Get all wallpapers (populated)
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

// ✅ Helper to run ffmpeg as promise (no .run() here)
function runFfmpegPromise(cmd) {
  return new Promise((resolve, reject) => {
    cmd.on('end', resolve).on('error', reject);
  });
}

// Upload wallpapers
app.post('/api/wallpapers', upload.array('files'), async (req, res) => {
  try {
    const { titles, type = 'static', mainCategory, subCategory } = req.body;

    if (!mainCategory || !subCategory) {
      return res.status(400).json({ error: 'Main/subcategory required.' });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded.' });
    }

    // Parse titles — frontend sends JSON string of titles
    let titleArr = [];
    if (titles) {
      if (typeof titles === 'string') {
        try {
          titleArr = JSON.parse(titles);
        } catch (e) {
          titleArr = [titles]; // fallback single title
        }
      } else if (Array.isArray(titles)) {
        titleArr = titles;
      } else {
        titleArr = [String(titles)];
      }
    }

    const results = [];

    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i];
      const title = titleArr[i] || file.originalname.replace(/\.[^/.]+$/, '');
      const originalFilePath = file.path;
      let finalFileUrl = `/uploads/${file.filename}`;
      let snapshotUrl = null;

      if (type === 'live') {
        const lower = file.mimetype ? file.mimetype.toLowerCase() : '';
        if (!lower.startsWith('video/') &&
            !['.mp4', '.mov', '.webm', '.mkv'].includes(path.extname(file.originalname).toLowerCase())) {
          console.warn('Not a recognized video:', file.originalname);
        } else {
          const trimmedFilename = 'trimmed_' + file.filename;
          const trimmedPath = path.join(__dirname, 'uploads', trimmedFilename);

          const snapshotFilename = 'snapshot_' + file.filename + '.jpg';
          const snapshotPath = path.join(__dirname, 'uploads', snapshotFilename);

          // ✅ Use .save() instead of .output() + .run()
          await runFfmpegPromise(
            ffmpeg(originalFilePath)
              .setStartTime(0)
              .setDuration(15)
              .save(trimmedPath)
          );

          // Screenshot
          await runFfmpegPromise(
            ffmpeg(trimmedPath).screenshots({
              timestamps: ['2'],
              filename: path.basename(snapshotPath),
              folder: path.dirname(snapshotPath),
              size: '640x?'
            })
          );

          finalFileUrl = `/uploads/${trimmedFilename}`;
          snapshotUrl = `/uploads/${path.basename(snapshotPath)}`;
        }
      }

      const wallpaper = await Wallpaper.create({
        title,
        type,
        fileUrl: finalFileUrl,
        snapshotUrl,
        mainCategory,
        subCategory
      });

      results.push(wallpaper);
    }

    res.json(results);
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Upload failed', details: err.message });
  }
});

// Serve index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

// Connect DB and start server
const PORT = process.env.PORT || 3000;
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`)))
  .catch(err => {
    console.error('Failed to connect to MongoDB:', err);
    process.exit(1);
  });
