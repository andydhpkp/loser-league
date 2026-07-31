function requireAdmin(req, res, next) {
  if (req.session?.adminAuthenticated === true) {
    next();
    return;
  }

  res.status(401).json({
    error: "UNAUTHORIZED",
    message: "Admin authentication required",
  });
}

module.exports = { requireAdmin };
