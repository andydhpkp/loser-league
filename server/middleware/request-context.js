const { randomUUID } = require("node:crypto");

function requestContext(req, res, next) {
  req.requestId = req.get("x-request-id") || randomUUID();
  res.set("x-request-id", req.requestId);
  next();
}

module.exports = { requestContext };
