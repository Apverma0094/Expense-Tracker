const express = require("express");

const router = express.Router();

const { auth } = require("../middleware/auth");
const {
    showSettingsPage,
    updateSettings,
} = require("../controllers/settingsController");

router.get("/", auth, showSettingsPage);
router.post("/update", auth, updateSettings);

module.exports = router;
