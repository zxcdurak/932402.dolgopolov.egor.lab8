const path = require("node:path");
const express = require("express");

const router = express.Router();
const index = path.join(__dirname, "..", "public", "index.html");

router.get("/", (req, res) => res.sendFile(index));

module.exports = router;
