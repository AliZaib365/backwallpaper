const mongoose = require('mongoose');
const MainCategorySchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true }
});
module.exports = mongoose.model('MainCategory', MainCategorySchema);