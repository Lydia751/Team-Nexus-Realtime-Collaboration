const express = require('express');
const multer = require('multer');
const path = require('path');
const File = require('../models/File');
const fs = require('fs');
const router = express.Router();
const { getIo } = require("../socket");

// Configure multer storage for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/'); // Files will be saved to the 'uploads' folder
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname); // Unique file name with timestamp
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 } // Max file size: 5MB
});

// API to upload a file
router.post('/upload', upload.single('file'), async (req, res) => {
    try {
        console.log('[UPLOAD] Incoming file:', req.file);
    console.log('[UPLOAD] Incoming body:', req.body);

        const { workplaceId } = req.body;
        const newFile = new File({
            filename: req.file.filename,
            fileUrl: `/uploads/${req.file.filename}`,
            uploader: req.user ? req.user._id : null,
            workplaceId: workplaceId
        });
        await newFile.save();
        getIo().emit("file_upload", newFile); // Emit the file upload to connected clients
        console.log('✅ File saved:', newFile);
        res.status(201).json(newFile);
    } catch (error) {
        console.error('❌ [ERROR] Upload failed:', error);
        res.status(500).json({ message: 'File upload failed', error });
    }
});

// API to get all files for a workplace
router.get('/:workplaceId', async (req, res) => {
    try {
      const files = await File.find({ workplaceId: req.params.workplaceId }).lean();
  
      const now = new Date();
  
      const filesWithDaysLeft = files.map(file => {
        const uploadDate = new Date(file.uploadTime);
        const diffInMs = now - uploadDate;
        const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
        return {
          ...file,
          daysLeft: Math.max(30 - diffInDays, 0)
        };
      });
  
      res.json(filesWithDaysLeft);
    } catch (err) {
      console.error('[ERROR] Fetching files failed:', err);
      res.status(500).json({ error: 'Failed to fetch files' });
    }
});  

// DELETE /api/files/:id
router.delete('/:id', async (req, res) => {
    try {
      const file = await File.findById(req.params.id);
      if (!file) return res.status(404).json({ message: 'File not found' });
  
      //
      fs.unlinkSync(`uploads/${file.filename}`);
  
      // 
      await file.deleteOne();
      res.json({ message: 'File deleted' });
    } catch (err) {
      console.error('[ERROR] Failed to delete file:', err);
      res.status(500).json({ message: 'Failed to delete file' });
    }
  });

module.exports = router;
