const {
    createTransaction,
    getUserTransactions,
    findUserTransactionById,
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
    getUserWalletTransactionStats,
} = require("../collections/wallets");
const {
    getUserWalletTransferStats,
} = require("../collections/walletTransfers");
const {
    buildCategoryOptionLabel,
} = require("../utils/categoryPresentation");
const {
    buildWalletBalanceMap,
    applyTransactionToWalletBalanceMap,
    getNegativeWallets,
} = require("../utils/walletBalance");

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

function buildTransactionMeta(
    transactions,
    walletList = [],
    walletTransactionStats = {},
    walletTransferStats = {}
) {
    const categories = [...new Set(transactions.map((item) => item.category).filter(Boolean))].sort();
    const wallets = [...new Set(transactions.map((item) => item.wallet).filter(Boolean))].sort();

    const totalIncome = transactions
        .filter((item) => item.type === "income")
        .reduce((sum, item) => sum + item.amount, 0);

    const totalExpense = transactions
        .filter((item) => item.type === "expense")
        .reduce((sum, item) => sum + item.amount, 0);

    const currentBalance = walletTransactionStats && walletList.length
        ? walletList.reduce((sum, wallet) => {
            const stats = walletTransactionStats[wallet.name] || {};
            const transferStats = walletTransferStats[wallet.name] || {};
            const openingBalance = Number(wallet.openingBalance || 0);
            const income = Number(stats.income || 0);
            const expense = Number(stats.expense || 0);
            const incomingTransfers = Number(transferStats.incomingAmount || 0);
            const outgoingTransfers = Number(transferStats.outgoingAmount || 0);

            return sum + openingBalance + income + incomingTransfers - expense - outgoingTransfers;
        }, 0)
        : totalIncome - totalExpense;

    return {
        categories,
        wallets,
        totalIncome,
        totalExpense,
        balance: currentBalance,
    };
}

function buildAddTransactionFormState(payload = {}, errorMessage = "") {
    return {
        mode: "add",
        errorMessage,
        values: {
            amount: payload.amount || "",
            title: payload.title || "",
            category: payload.category || "",
            wallet: payload.wallet || "",
            type: payload.type || "",
            description: payload.description || "",
            transactionDate: payload.transactionDate || "",
            billImageData: payload.billImageData || "",
            billImageName: payload.billImageName || "",
            billImageMime: payload.billImageMime || "",
        },
    };
}

function isAjaxRequest(req) {
    return req.get("x-requested-with") === "XMLHttpRequest"
        || String(req.get("accept") || "").includes("application/json");
}

function saveTransactionFormState(req, formState) {
    req.session.transactionFormState = formState;

    return new Promise((resolve, reject) => {
        req.session.save((error) => {
            if (error) {
                reject(error);
                return;
            }

            resolve();
        });
    });
}

async function validateWalletBalancesAfterTransaction(userId, nextTransaction, currentTransaction = null) {
    const [wallets, walletTransactionStats, walletTransferStats] = await Promise.all([
        getUserWallets(userId),
        getUserWalletTransactionStats(userId),
        getUserWalletTransferStats(userId),
    ]);
    const balanceMap = buildWalletBalanceMap(wallets, walletTransactionStats, walletTransferStats);

    if (currentTransaction) {
        applyTransactionToWalletBalanceMap(balanceMap, currentTransaction, -1);
    }

    applyTransactionToWalletBalanceMap(balanceMap, nextTransaction, 1);

    return getNegativeWallets(balanceMap);
}

async function renderTransactionPage(req, res, options = {}) {
    const filters = buildTransactionFilters(options.filters || req.query);
    const allTransactions = await getUserTransactions(req.session.userId);
    const transactions = await getUserTransactions(req.session.userId, filters);
    const categoryOptions = await getUserCategories(req.session.userId);
    const walletOptions = await getUserWallets(req.session.userId);
    const walletTransactionStats = await getUserWalletTransactionStats(req.session.userId);
    const walletTransferStats = await getUserWalletTransferStats(req.session.userId);
    const meta = buildTransactionMeta(
        allTransactions,
        walletOptions,
        walletTransactionStats,
        walletTransferStats
    );

    return res.render("panels/transaction", {
        transactions,
        filters,
        meta,
        pageStyles: ["assets2/css/transactions.css"],
        pageScripts: ["assets2/js/transactions.js"],
        categoryOptions: categoryOptions.map((category) => ({
            ...category,
            optionLabel: buildCategoryOptionLabel(category),
        })),
        walletOptions,
        addTransactionState: options.addTransactionState || null,
    });
}

async function showTransactionForm(req, res) {
    try {
        const addTransactionState = req.session.transactionFormState || null;
        delete req.session.transactionFormState;

        return await renderTransactionPage(req, res, {
            addTransactionState,
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
            if (isAjaxRequest(req)) {
                return res.status(422).json({
                    success: false,
                    message: validationError,
                });
            }
            await saveTransactionFormState(req, buildAddTransactionFormState(payload, validationError));
            return res.redirect("/transactions");
        }

        const [category, wallet] = await Promise.all([
            findUserCategoryByName(req.session.userId, payload.category),
            findUserWalletByName(req.session.userId, payload.wallet),
        ]);

        if (!category) {
            if (isAjaxRequest(req)) {
                return res.status(422).json({
                    success: false,
                    message: "Please select a valid category",
                });
            }
            await saveTransactionFormState(req, buildAddTransactionFormState(payload, "Please select a valid category"));
            return res.redirect("/transactions");
        }

        if (category.type !== payload.type) {
            if (isAjaxRequest(req)) {
                return res.status(422).json({
                    success: false,
                    message: "Selected category does not match the transaction type",
                });
            }
            await saveTransactionFormState(
                req,
                buildAddTransactionFormState(payload, "Selected category does not match the transaction type")
            );
            return res.redirect("/transactions");
        }

        if (!wallet) {
            if (isAjaxRequest(req)) {
                return res.status(422).json({
                    success: false,
                    message: "Please select a valid wallet",
                });
            }
            await saveTransactionFormState(req, buildAddTransactionFormState(payload, "Please select a valid wallet"));
            return res.redirect("/transactions");
        }

        const negativeWallets = await validateWalletBalancesAfterTransaction(
            req.session.userId,
            payload
        );
        if (negativeWallets.length) {
            if (isAjaxRequest(req)) {
                return res.status(422).json({
                    success: false,
                    message: "Insufficient balance in the selected wallet",
                });
            }
            await saveTransactionFormState(
                req,
                buildAddTransactionFormState(payload, "Insufficient balance in the selected wallet")
            );
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

        if (isAjaxRequest(req)) {
            return res.json({
                success: true,
                redirect: "/transactions",
            });
        }

        return res.redirect("/transactions");

    } catch (error) {
        console.error(error);

        if (isAjaxRequest(req)) {
            return res.status(500).json({
                success: false,
                message: "Failed To Add Transaction",
            });
        }

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

        const currentTransaction = await findUserTransactionById(req.session.userId, req.params.id);
        if (!currentTransaction) {
            req.flash("error_msg", "Transaction not found");
            return res.redirect("/transactions");
        }

        const negativeWallets = await validateWalletBalancesAfterTransaction(
            req.session.userId,
            payload,
            currentTransaction
        );
        if (negativeWallets.length) {
            req.flash("error_msg", "Insufficient balance in the selected wallet");
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
