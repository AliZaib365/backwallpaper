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
app.use('/uploads', express.static('uploads'));
app.use('/public', express.static('public'));

if (!fs.existsSync('./uploads')) fs.mkdirSync('./uploads');

// Multer setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, Date.now() + '_' + file.originalname)
});
const upload = multer({ storage });

// Get main categories
app.get('/api/main-categories', async (req, res) => {
  res.json(await MainCategory.find());
});

// Get subcategories for a main category
app.get('/api/sub-categories', async (req, res) => {
  const { mainCategory } = req.query;
  res.json(await SubCategory.find({ mainCategory }));
});

// Get all wallpapers
app.get('/api/wallpapers', async (req, res) => {
  res.json(await Wallpaper.find().populate('mainCategory').populate('subCategory'));
});

// Upload wallpapers
app.post('/api/wallpapers', upload.array('files'), async (req, res) => {
  const { titles, type, mainCategory, subCategory } = req.body;
  if (!mainCategory || !subCategory) return res.status(400).json({ error: 'Main/subcategory required.' });

  let results = [];
  let titleArr = Array.isArray(titles) ? titles : [titles];
  for (let i = 0; i < req.files.length; i++) {
    let file = req.files[i];
    let title = titleArr[i] || file.originalname;
    let fileUrl = `/uploads/${file.filename}`;
    let snapshotUrl = null;
    let finalFileUrl = fileUrl;

    if (type === 'live') {
      // Trim video and get snapshot
      const trimmedPath = path.join('uploads', 'trimmed_' + file.filename);
      const snapshotPath = path.join('uploads', 'snapshot_' + file.filename + '.jpg');
      await new Promise((resolve, reject) => {
        ffmpeg(file.path)
          .setStartTime(0)
          .setDuration(15)
          .output(trimmedPath)
          .on('end', resolve)
          .on('error', reject)
          .run();
      });
      await new Promise((resolve, reject) => {
        ffmpeg(trimmedPath)
          .screenshots({ timestamps: ['2'], filename: path.basename(snapshotPath), folder: 'uploads' })
          .on('end', resolve)
          .on('error', reject)
          .run();
      });
      snapshotUrl = `/uploads/${path.basename(snapshotPath)}`;
      finalFileUrl = `/uploads/trimmed_${file.filename}`;
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
});

// Serve index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

// Connect DB and start server
const PORT = process.env.PORT || 3000;
mongoose.connect(process.env.MONGO_URI)
  .then(() => app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`)));