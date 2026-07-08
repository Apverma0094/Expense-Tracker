const express = require("express");

const router = express.Router();

const { auth } = require("../middleware/auth");
const {
    showAnalyticsPage,
} = require("../controllers/analyticsController");

router.get("/", auth, showAnalyticsPage);

module.exports = router;
