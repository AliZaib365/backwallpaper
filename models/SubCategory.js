const mongoose = require('mongoose');
const SubCategorySchema = new mongoose.Schema({
  name: { type: String, required: true },
  mainCategory: { type: mongoose.Schema.Types.ObjectId, ref: 'MainCategory', required: true }
});
module.exports = mongoose.model('SubCategory', SubCategorySchema);