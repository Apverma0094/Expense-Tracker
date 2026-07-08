const express = require("express");

const router = express.Router();

const { auth } = require("../middleware/auth");
const {
    showWalletPage,
    addWallet,
    updateWallet,
    removeWallet,
    transferBetweenWallets,
} = require("../controllers/walletController");

router.get("/", auth, showWalletPage);
router.post("/add", auth, addWallet);
router.post("/transfer", auth, transferBetweenWallets);
router.post("/:id/update", auth, updateWallet);
router.post("/:id/delete", auth, removeWallet);

module.exports = router;
