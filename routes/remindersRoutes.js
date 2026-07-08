const express = require("express");

const router = express.Router();

const { auth } = require("../middleware/auth");
const {
    showRemindersPage,
    addReminder,
    updateReminder,
    removeReminder,
    markReminderPaid,
    markReminderReturned,
    markReminderReceived,
    markReminderComplete,
} = require("../controllers/remindersController");

router.get("/", auth, showRemindersPage);
router.post("/add", auth, addReminder);
router.post("/:id/update", auth, updateReminder);
router.post("/:id/delete", auth, removeReminder);
router.post("/:id/mark-paid", auth, markReminderPaid);
router.post("/:id/mark-returned", auth, markReminderReturned);
router.post("/:id/mark-received", auth, markReminderReceived);
router.post("/:id/mark-complete", auth, markReminderComplete);

module.exports = router;
