const express = require("express");

const router = express.Router();

const {
    auth,
    alreadyAuth,
} = require("../middleware/auth");

const {
    showAuthPage,
    authHandler,
    showDashboard,
    logout,
} = require("../controllers/authController");

router.get("/", alreadyAuth, showAuthPage);

router.post("/", alreadyAuth, authHandler);

router.get("/dashboard", auth, showDashboard);

router.get("/logout", auth, logout);

module.exports = router;