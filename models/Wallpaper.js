const mongoose = require('mongoose');

const wallpaperItemSchema = new mongoose.Schema({
  title: String,
  fileUrl: String,
  snapshotUrl: String,
  createdAt: { type: Date, default: Date.now }
});

const wallpaperSchema = new mongoose.Schema({
  type: { type: String, default: 'static' },
  mainCategory: { type: mongoose.Schema.Types.ObjectId, ref: 'MainCategory' },
  subCategory: { type: mongoose.Schema.Types.ObjectId, ref: 'SubCategory' },
  wallpapers: [wallpaperItemSchema] // Array of wallpaper items
}, { timestamps: true });

module.exports = mongoose.model('Wallpaper', wallpaperSchema);