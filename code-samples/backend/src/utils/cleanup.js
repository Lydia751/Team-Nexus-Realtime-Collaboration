const mongoose = require('mongoose');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const File = require('../models/File');


if (!mongoose.connection.readyState) {
  mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/team-nexus', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  }).then(() => {
    console.log('[CLEANUP] MongoDB connected');
  }).catch((err) => {
    console.error('[CLEANUP] MongoDB connection error:', err);
  });
}


const runCleanup = async () => {
  const threshold = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
  try {
    const expiredFiles = await File.find({ uploadTime: { $lt: threshold } });

    for (const file of expiredFiles) {
      const filePath = path.join(__dirname, '..', '..', 'uploads', file.filename);
      fs.unlink(filePath, (err) => {
        if (err) {
          console.error(`[CLEANUP] Failed to delete file ${file.filename}:`, err);
        } else {
          console.log(`[CLEANUP] Deleted expired file: ${file.filename}`);
        }
      });
      await File.deleteOne({ _id: file._id });
    }

    console.log(`[CLEANUP] Done. ${expiredFiles.length} file(s) removed.`);
  } catch (err) {
    console.error('[CLEANUP] Error during cleanup:', err);
  }
};

cron.schedule('0 0 * * *', runCleanup);
console.log('[CLEANUP] Running immediate cleanup...');
runCleanup();
