const express = require('express');
const router = express.Router();
const Link = require('../models/Link');

router.post('/', async (req, res) => {
  const { title, url, workplaceId } = req.body;

  console.log("[DEBUG] POST /api/links received body:", req.body);

  if (!title || !url || !workplaceId) {
    console.log("[WARN] Missing required fields");
    return res.status(400).json({ message: 'Missing required fields' });
  }

  try {
    const newLink = new Link({
      title,
      url,
      workplaceId,
      uploader: null 
    });

    await newLink.save();

    console.log("[DEBUG] Link saved successfully:", newLink);
    res.status(201).json(newLink);
  } catch (err) {
    console.error("[ERROR] Failed to save link:", err);
    res.status(500).json({ message: 'Failed to create link', error: err.message });
  }
});

router.get('/:workplaceId', async (req, res) => {
  try {
    const links = await Link.find({ workplaceId: req.params.workplaceId });
    res.json(links);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch links', error: err.message });
  }
});

// DELETE /api/links/:id
router.delete('/:id', async (req, res) => {
    try {
      await Link.findByIdAndDelete(req.params.id);
      res.json({ message: 'Link deleted' });
    } catch (err) {
      console.error('[ERROR] Failed to delete link:', err);
      res.status(500).json({ message: 'Failed to delete link' });
    }
  });
  

module.exports = router;
