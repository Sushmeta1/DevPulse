function getUser(req, res) {
  const { id, login, name, email, avatar_url } = req.user;
  res.json({ id, login, name, email, avatarUrl: avatar_url });
}

module.exports = { getUser };
