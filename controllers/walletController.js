const {
    createWallet,
    getUserWallets,
    findUserWalletByName,
    updateUserWallet,
    deleteUserWallet,
    getUserWalletTransactionStats,
} = require("../collections/wallets");
const {
    createWalletTransfer,
    getUserWalletTransferStats,
    renameUserWalletTransferReferences,
} = require("../collections/walletTransfers");
const {
    renameUserWalletReferences,
} = require("../collections/transactions");

function normalizeWalletType(type) {
    const normalized = String(type || "").trim().toLowerCase();
    return ["bank", "cash", "digital"].includes(normalized)
        ? normalized
        : "";
}

function normalizeWalletPayload(body) {
    const openingBalance = Number(body.openingBalance);
    const openingBalanceDate = body.openingBalanceDate
        ? new Date(body.openingBalanceDate)
        : new Date();

    return {
        name: String(body.name || body.walletName || "").trim(),
        type: normalizeWalletType(body.type),
        currency: String(body.currency || "INR").trim().toUpperCase(),
        openingBalance,
        openingBalanceDate,
        notes: String(body.notes || body.note || "").trim(),
    };
}

function validateWalletPayload(payload) {
    if (!payload.name) {
        return "Wallet name is required";
    }

    if (!payload.type) {
        return "Wallet type is required";
    }

    if (!payload.currency) {
        return "Currency is required";
    }

    if (!Number.isFinite(payload.openingBalance) || payload.openingBalance < 0) {
        return "Opening balance must be 0 or greater";
    }

    if (!(payload.openingBalanceDate instanceof Date) || Number.isNaN(payload.openingBalanceDate.getTime())) {
        return "Please select a valid opening date";
    }

    return null;
}

function normalizeTransferPayload(body) {
    const transferDate = body.transferDate
        ? new Date(body.transferDate)
        : new Date();

    return {
        fromWallet: String(body.fromWallet || "").trim(),
        toWallet: String(body.toWallet || "").trim(),
        amount: Number(body.amount),
        transferDate,
        note: String(body.note || "").trim(),
    };
}

function validateTransferPayload(payload, walletNames) {
    if (!payload.fromWallet || !payload.toWallet) {
        return "Please select both wallets";
    }

    if (payload.fromWallet === payload.toWallet) {
        return "Transfer wallets must be different";
    }

    if (!walletNames.includes(payload.fromWallet) || !walletNames.includes(payload.toWallet)) {
        return "Selected wallet was not found";
    }

    if (!Number.isFinite(payload.amount) || payload.amount <= 0) {
        return "Transfer amount must be greater than 0";
    }

    if (!(payload.transferDate instanceof Date) || Number.isNaN(payload.transferDate.getTime())) {
        return "Please select a valid transfer date";
    }

    return null;
}

function buildWalletFilters(query) {
    return {
        type: normalizeWalletType(query.type),
        currency: String(query.currency || "").trim().toUpperCase(),
        search: String(query.search || "").trim(),
    };
}

function walletIconClass(type) {
    switch (type) {
        case "bank":
            return "ti ti-building-bank";
        case "cash":
            return "ti ti-wallet";
        case "digital":
            return "ti ti-device-mobile";
        default:
            return "ti ti-wallet";
    }
}

function walletBadgeClass(type) {
    switch (type) {
        case "bank":
            return "bg-success-subtle text-success";
        case "cash":
            return "bg-warning-subtle text-warning";
        case "digital":
            return "bg-info-subtle text-info";
        default:
            return "bg-light text-dark";
    }
}

function walletTypeLabel(type) {
    if (!type) {
        return "Wallet";
    }

    return type.charAt(0).toUpperCase() + type.slice(1);
}

function buildWalletViewModel(wallets, transactionStats, transferStats) {
    return wallets.map((wallet) => {
        const tx = transactionStats[wallet.name] || {};
        const transfer = transferStats[wallet.name] || {};
        const openingBalance = Number(wallet.openingBalance || 0);
        const income = Number(tx.income || 0);
        const expense = Number(tx.expense || 0);
        const incomingTransfers = Number(transfer.incomingAmount || 0);
        const outgoingTransfers = Number(transfer.outgoingAmount || 0);
        const balance = openingBalance + income + incomingTransfers - expense - outgoingTransfers;
        const lastActivityCandidates = [
            wallet.updatedAt,
            wallet.openingBalanceDate,
            tx.lastTransactionAt,
            transfer.lastTransferAt,
        ].filter(Boolean).map((value) => new Date(value));
        const lastActivity = lastActivityCandidates.length
            ? new Date(Math.max(...lastActivityCandidates.map((value) => value.getTime())))
            : null;

        return {
            ...wallet,
            iconClass: walletIconClass(wallet.type),
            badgeClass: walletBadgeClass(wallet.type),
            typeLabel: walletTypeLabel(wallet.type),
            transactionCount: Number(tx.transactionCount || 0),
            transferCount: Number(transfer.transferCount || 0),
            totalIncome: income,
            totalExpense: expense,
            incomingTransfers,
            outgoingTransfers,
            balance,
            lastActivity,
        };
    });
}

async function showWalletPage(req, res) {
    try {
        const filters = buildWalletFilters(req.query);
        const walletOptions = await getUserWallets(req.session.userId);
        const wallets = await getUserWallets(req.session.userId, filters);
        const transactionStats = await getUserWalletTransactionStats(req.session.userId);
        const transferStats = await getUserWalletTransferStats(req.session.userId);
        const walletList = buildWalletViewModel(wallets, transactionStats, transferStats);
        const allWalletsView = buildWalletViewModel(walletOptions, transactionStats, transferStats);
        const currencies = [...new Set(walletOptions.map((wallet) => wallet.currency).filter(Boolean))].sort();
        const meta = {
            totalWallets: walletList.length,
            totalBalance: allWalletsView.reduce((sum, wallet) => sum + wallet.balance, 0),
            currencies,
        };

        return res.render("wallet/wallet", {
            wallets: walletList,
            walletOptions: allWalletsView,
            filters,
            meta,
        });
    } catch (error) {
        console.error(error);
        req.flash("error_msg", "Failed to load wallets");
        return res.redirect("/dashboard");
    }
}

async function addWallet(req, res) {
    try {
        const payload = normalizeWalletPayload(req.body);
        const validationError = validateWalletPayload(payload);

        if (validationError) {
            req.flash("error_msg", validationError);
            return res.redirect("/wallet");
        }

        const existingWallet = await findUserWalletByName(req.session.userId, payload.name);
        if (existingWallet) {
            req.flash("error_msg", "A wallet with this name already exists");
            return res.redirect("/wallet");
        }

        await createWallet({
            userId: req.session.userId,
            ...payload,
        });

        req.flash("success_msg", "Wallet added successfully");
        return res.redirect("/wallet");
    } catch (error) {
        console.error(error);
        req.flash("error_msg", "Failed to add wallet");
        return res.redirect("/wallet");
    }
}

async function updateWallet(req, res) {
    try {
        const payload = normalizeWalletPayload(req.body);
        const validationError = validateWalletPayload(payload);

        if (validationError) {
            req.flash("error_msg", validationError);
            return res.redirect("/wallet");
        }

        const existingWallet = await findUserWalletByName(req.session.userId, payload.name, req.params.id);
        if (existingWallet) {
            req.flash("error_msg", "A wallet with this name already exists");
            return res.redirect("/wallet");
        }

        const wallets = await getUserWallets(req.session.userId);
        const currentWallet = wallets.find((item) => String(item._id) === req.params.id);

        if (!currentWallet) {
            req.flash("error_msg", "Wallet not found");
            return res.redirect("/wallet");
        }

        const result = await updateUserWallet(req.session.userId, req.params.id, payload);
        if (!result.matchedCount) {
            req.flash("error_msg", "Wallet not found");
            return res.redirect("/wallet");
        }

        if (currentWallet.name !== payload.name) {
            await renameUserWalletReferences(
                req.session.userId,
                currentWallet.name,
                payload.name
            );
            await renameUserWalletTransferReferences(
                req.session.userId,
                currentWallet.name,
                payload.name
            );
        }

        req.flash("success_msg", "Wallet updated successfully");
        return res.redirect("/wallet");
    } catch (error) {
        console.error(error);
        req.flash("error_msg", "Failed to update wallet");
        return res.redirect("/wallet");
    }
}

async function removeWallet(req, res) {
    try {
        const wallets = await getUserWallets(req.session.userId);
        const transactionStats = await getUserWalletTransactionStats(req.session.userId);
        const transferStats = await getUserWalletTransferStats(req.session.userId);
        const wallet = wallets.find((item) => String(item._id) === req.params.id);

        if (!wallet) {
            req.flash("error_msg", "Wallet not found");
            return res.redirect("/wallet");
        }

        const transactionCount = Number((transactionStats[wallet.name] || {}).transactionCount || 0);
        const transferCount = Number((transferStats[wallet.name] || {}).transferCount || 0);

        if (transactionCount > 0 || transferCount > 0) {
            req.flash("error_msg", "Wallet is in use and cannot be deleted");
            return res.redirect("/wallet");
        }

        const result = await deleteUserWallet(req.session.userId, req.params.id);
        if (!result.deletedCount) {
            req.flash("error_msg", "Wallet not found");
            return res.redirect("/wallet");
        }

        req.flash("success_msg", "Wallet deleted successfully");
        return res.redirect("/wallet");
    } catch (error) {
        console.error(error);
        req.flash("error_msg", "Failed to delete wallet");
        return res.redirect("/wallet");
    }
}

async function transferBetweenWallets(req, res) {
    try {
        const payload = normalizeTransferPayload(req.body);
        const wallets = await getUserWallets(req.session.userId);
        const walletNames = wallets.map((wallet) => wallet.name);
        const validationError = validateTransferPayload(payload, walletNames);

        if (validationError) {
            req.flash("error_msg", validationError);
            return res.redirect("/wallet");
        }

        const transactionStats = await getUserWalletTransactionStats(req.session.userId);
        const transferStats = await getUserWalletTransferStats(req.session.userId);
        const walletBalances = buildWalletViewModel(wallets, transactionStats, transferStats)
            .reduce((map, wallet) => {
                map[wallet.name] = wallet.balance;
                return map;
            }, {});

        if (Number(walletBalances[payload.fromWallet] || 0) < payload.amount) {
            req.flash("error_msg", "Insufficient balance in the source wallet");
            return res.redirect("/wallet");
        }

        await createWalletTransfer({
            userId: req.session.userId,
            ...payload,
        });

        req.flash("success_msg", "Wallet transfer completed successfully");
        return res.redirect("/wallet");
    } catch (error) {
        console.error(error);
        req.flash("error_msg", "Failed to transfer between wallets");
        return res.redirect("/wallet");
    }
}

module.exports = {
    showWalletPage,
    addWallet,
    updateWallet,
    removeWallet,
    transferBetweenWallets,
};
