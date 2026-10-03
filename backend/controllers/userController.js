function getUser(req, res) {
  const { id, login, name, email, avatar_url, is_demo } = req.user;
  res.json({ id, login, name, email, avatarUrl: avatar_url, isDemo: is_demo });
}

module.exports = { getUser };
