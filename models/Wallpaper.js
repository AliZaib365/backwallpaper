const mongoose = require('mongoose');
const WallpaperSchema = new mongoose.Schema({
  title: { type: String, required: true },
  type: { type: String, enum: ['static', 'live'], required: true },
  fileUrl: { type: String, required: true },
  snapshotUrl: { type: String }, // For live wallpapers
  mainCategory: { type: mongoose.Schema.Types.ObjectId, ref: 'MainCategory', required: true },
  subCategory: { type: mongoose.Schema.Types.ObjectId, ref: 'SubCategory', required: true },
  createdAt: { type: Date, default: Date.now }
});
module.exports = mongoose.model('Wallpaper', WallpaperSchema);