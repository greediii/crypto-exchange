router.get('/settings', auth, (req, res) => {
  try {
    const userId = req.user.id; // Assuming you have user authentication
    const settings = db.prepare(`
      SELECT * FROM user_settings WHERE user_id = ?
    `).get(userId);

    if (!settings) {
      return res.status(404).json({ message: 'Settings not found' });
    }

    res.json(settings);
  } catch (error) {
    console.error('Error fetching user settings:', error);
    res.status(500).json({ message: 'Server error' });
  }
}); 