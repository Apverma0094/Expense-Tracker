const express = require("express");
const router = express.Router();
const { auth } = require("../middleware/auth");

const {
  showTransactionForm,
  addTransaction,
  updateTransaction,
  deleteTransaction,
} = require("../controllers/transactionController");

router.get("/",auth,showTransactionForm);
router.post("/add",auth,addTransaction);
router.post("/:id/update",auth,updateTransaction);
router.post("/:id/delete",auth,deleteTransaction);

module.exports = router;
