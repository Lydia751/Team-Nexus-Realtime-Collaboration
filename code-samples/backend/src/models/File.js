const mongoose = require('mongoose');

const fileSchema = new mongoose.Schema({
    filename: { type: String, required: true },           
    fileUrl: { type: String, required: true },             
    uploader: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },

    workplaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workplace', required: true }, 
    uploadTime: { type: Date, default: Date.now }          
});

module.exports = mongoose.model('File', fileSchema);
