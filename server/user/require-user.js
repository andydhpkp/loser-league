function requireUser(req, res, next) {
  if (req.session?.loggedIn === true && Number.isInteger(req.session.user_id)) {
    next();
    return;
  }
  res.status(401).json({ error: "UNAUTHORIZED", message: "User authentication required" });
}

module.exports = { requireUser };
