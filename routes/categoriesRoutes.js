const express = require("express");

const router = express.Router();

const { auth } = require("../middleware/auth");
const {
    showCategoriesPage,
    addCategory,
    updateCategory,
    removeCategory,
} = require("../controllers/categoriesController");

router.get("/", auth, showCategoriesPage);
router.post("/add", auth, addCategory);
router.post("/:id/update", auth, updateCategory);
router.post("/:id/delete", auth, removeCategory);

module.exports = router;
