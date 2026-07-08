const {
    createTransaction,
    getUserTransactions,
    updateUserTransaction,
    deleteUserTransaction,
} = require("../collections/transactions");
const {
    getUserCategories,
    findUserCategoryByName,
} = require("../collections/categories");
const {
    getUserWallets,
    findUserWalletByName,
} = require("../collections/wallets");
const {
    buildCategoryOptionLabel,
} = require("../utils/categoryPresentation");

function normalizeType(type) {
    const normalized = String(type || "").trim().toLowerCase();
    return ["income", "expense"].includes(normalized)
        ? normalized
        : "";
}

const ALLOWED_BILL_IMAGE_TYPES = new Set([
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/gif",
]);

const MAX_BILL_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

function extractBillImage(body) {
    const billImageData = String(body.billImageData || "").trim();
    const billImageName = String(body.billImageName || "").trim();
    const billImageMime = String(body.billImageMime || "").trim().toLowerCase();

    if (!billImageData) {
        return {
            billImageData: "",
            billImageName: "",
            billImageMime: "",
        };
    }

    return {
        billImageData,
        billImageName: billImageName || "bill-image",
        billImageMime,
    };
}

function validateBillImagePayload(payload) {
    if (!payload.billImageData) {
        return null;
    }

    if (!payload.billImageData.startsWith("data:")) {
        return "Uploaded bill image is invalid";
    }

    if (!ALLOWED_BILL_IMAGE_TYPES.has(payload.billImageMime)) {
        return "Bill image must be JPG, PNG, WEBP, or GIF";
    }

    const base64Content = payload.billImageData.split(",")[1] || "";
    const approxBytes = Buffer.byteLength(base64Content, "base64");

    if (approxBytes > MAX_BILL_IMAGE_SIZE_BYTES) {
        return "Bill image size must be 5MB or less";
    }

    return null;
}

function normalizeTransactionPayload(body) {
    const amount = Number(body.amount);
    const title = String(body.title || "").trim();
    const category = String(body.category || "").trim();
    const wallet = String(body.wallet || "").trim();
    const type = normalizeType(body.type);
    const description = String(body.description || body.note || "").trim();
    const transactionDate = body.transactionDate || body.date
        ? new Date(body.transactionDate || body.date)
        : new Date();

    return {
        title,
        category,
        wallet,
        type,
        amount,
        description,
        transactionDate,
        ...extractBillImage(body),
    };
}

function validateTransactionPayload(payload) {
    if (!payload.title) {
        return "Title is required";
    }

    if (!payload.category) {
        return "Category is required";
    }

    if (!payload.wallet) {
        return "Wallet is required";
    }

    if (!payload.type) {
        return "Type must be income or expense";
    }

    if (!Number.isFinite(payload.amount) || payload.amount <= 0) {
        return "Amount must be greater than 0";
    }

    if (!(payload.transactionDate instanceof Date) || Number.isNaN(payload.transactionDate.getTime())) {
        return "Please select a valid transaction date";
    }

    const billImageError = validateBillImagePayload(payload);
    if (billImageError) {
        return billImageError;
    }

    return null;
}

function buildTransactionFilters(query) {
    return {
        type: normalizeType(query.type),
        category: String(query.category || "").trim(),
        wallet: String(query.wallet || "").trim(),
        search: String(query.search || "").trim(),
    };
}

function buildTransactionMeta(transactions) {
    const categories = [...new Set(transactions.map((item) => item.category).filter(Boolean))].sort();
    const wallets = [...new Set(transactions.map((item) => item.wallet).filter(Boolean))].sort();

    const totalIncome = transactions
        .filter((item) => item.type === "income")
        .reduce((sum, item) => sum + item.amount, 0);

    const totalExpense = transactions
        .filter((item) => item.type === "expense")
        .reduce((sum, item) => sum + item.amount, 0);

    return {
        categories,
        wallets,
        totalIncome,
        totalExpense,
        balance: totalIncome - totalExpense,
    };
}

async function showTransactionForm(req, res) {
    try {
        const filters = buildTransactionFilters(req.query);
        const allTransactions = await getUserTransactions(req.session.userId);
        const transactions = await getUserTransactions(req.session.userId, filters);
        const categoryOptions = await getUserCategories(req.session.userId);
        const walletOptions = await getUserWallets(req.session.userId);
        const meta = buildTransactionMeta(allTransactions);

        return res.render("transactions/transaction", {
            transactions,
            filters,
            meta,
            categoryOptions: categoryOptions.map((category) => ({
                ...category,
                optionLabel: buildCategoryOptionLabel(category),
            })),
            walletOptions,
        });

    } catch (error) {
        console.error(error);

        req.flash(
            "error_msg",
            "Failed To Load Transactions"
        );

        return res.redirect("/dashboard");
    }
}

async function addTransaction(req, res) {
    try {
        const payload = normalizeTransactionPayload(req.body);
        const validationError = validateTransactionPayload(payload);

        if (validationError) {
            req.flash("error_msg", validationError);
            return res.redirect("/transactions");
        }

        const [category, wallet] = await Promise.all([
            findUserCategoryByName(req.session.userId, payload.category),
            findUserWalletByName(req.session.userId, payload.wallet),
        ]);

        if (!category) {
            req.flash("error_msg", "Please select a valid category");
            return res.redirect("/transactions");
        }

        if (category.type !== payload.type) {
            req.flash("error_msg", "Selected category does not match the transaction type");
            return res.redirect("/transactions");
        }

        if (!wallet) {
            req.flash("error_msg", "Please select a valid wallet");
            return res.redirect("/transactions");
        }

        await createTransaction({
            userId: req.session.userId,
            ...payload,
        });

        req.flash(
            "success_msg",
            "Transaction Added Successfully"
        );

        return res.redirect("/transactions");

    } catch (error) {
        console.error(error);

        req.flash(
            "error_msg",
            "Failed To Add Transaction"
        );

        return res.redirect("/transactions");
    }
}

async function updateTransaction(req, res) {
    try {
        const payload = normalizeTransactionPayload(req.body);
        const validationError = validateTransactionPayload(payload);

        if (validationError) {
            req.flash("error_msg", validationError);
            return res.redirect("/transactions");
        }

        const [category, wallet] = await Promise.all([
            findUserCategoryByName(req.session.userId, payload.category),
            findUserWalletByName(req.session.userId, payload.wallet),
        ]);

        if (!category) {
            req.flash("error_msg", "Please select a valid category");
            return res.redirect("/transactions");
        }

        if (category.type !== payload.type) {
            req.flash("error_msg", "Selected category does not match the transaction type");
            return res.redirect("/transactions");
        }

        if (!wallet) {
            req.flash("error_msg", "Please select a valid wallet");
            return res.redirect("/transactions");
        }

        const result = await updateUserTransaction(
            req.session.userId,
            req.params.id,
            payload
        );

        if (!result.matchedCount) {
            req.flash("error_msg", "Transaction not found");
            return res.redirect("/transactions");
        }

        req.flash(
            "success_msg",
            "Transaction Updated Successfully"
        );

        return res.redirect("/transactions");

    } catch (error) {
        console.error(error);

        req.flash(
            "error_msg",
            "Failed To Update Transaction"
        );

        return res.redirect("/transactions");
    }
}

async function deleteTransaction(req, res) {
    try {
        const result = await deleteUserTransaction(
            req.session.userId,
            req.params.id
        );

        if (!result.deletedCount) {
            req.flash("error_msg", "Transaction not found");
            return res.redirect("/transactions");
        }

        req.flash(
            "success_msg",
            "Transaction Deleted Successfully"
        );

        return res.redirect("/transactions");

    } catch (error) {
        console.error(error);

        req.flash(
            "error_msg",
            "Failed To Delete Transaction"
        );

        return res.redirect("/transactions");
    }
}

module.exports = {
    showTransactionForm,
    addTransaction,
    updateTransaction,
    deleteTransaction,
};
