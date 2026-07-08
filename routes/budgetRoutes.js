const express = require("express");

const router = express.Router();

const { auth } = require("../middleware/auth");
const {
    showBudgetPage,
    saveBudgetOverview,
    saveCategoryBudget,
    deleteCategoryBudget,
} = require("../controllers/budgetController");

router.get("/", auth, showBudgetPage);
router.post("/save", auth, saveBudgetOverview);
router.post("/category/save", auth, saveCategoryBudget);
router.post("/category/delete", auth, deleteCategoryBudget);

module.exports = router;
