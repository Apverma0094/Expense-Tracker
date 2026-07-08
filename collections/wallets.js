const connectDB = require("../config/db");
const { ObjectId } = require("mongodb");

function normalizeUserId(userId) {
    return String(userId || "");
}

function normalizeWalletName(name) {
    return String(name || "").trim();
}

function normalizeWalletType(type) {
    const normalized = String(type || "").trim().toLowerCase();
    return ["bank", "cash", "digital"].includes(normalized)
        ? normalized
        : "";
}

function normalizeCurrency(currency) {
    return String(currency || "").trim().toUpperCase();
}

function buildWalletFilters(userId, filters = {}) {
    const query = {
        userId: normalizeUserId(userId),
    };

    const type = normalizeWalletType(filters.type);
    if (type) {
        query.type = type;
    }

    const currency = normalizeCurrency(filters.currency);
    if (currency) {
        query.currency = currency;
    }

    const search = String(filters.search || "").trim();
    if (search) {
        query.name = { $regex: search, $options: "i" };
    }

    return query;
}

async function createWallet(walletData) {
    const db = await connectDB();

    return db.collection("wallets").insertOne({
        ...walletData,
        userId: normalizeUserId(walletData.userId),
        name: normalizeWalletName(walletData.name),
        type: normalizeWalletType(walletData.type),
        currency: normalizeCurrency(walletData.currency),
        openingBalance: Number(walletData.openingBalance || 0),
        openingBalanceDate: walletData.openingBalanceDate || new Date(),
        notes: String(walletData.notes || "").trim(),
        createdAt: new Date(),
        updatedAt: new Date(),
    });
}

async function getUserWallets(userId, filters = {}) {
    const db = await connectDB();

    return db
        .collection("wallets")
        .find(buildWalletFilters(userId, filters))
        .sort({ createdAt: -1, name: 1 })
        .toArray();
}

async function findUserWalletById(userId, walletId) {
    const db = await connectDB();

    return db.collection("wallets").findOne({
        _id: new ObjectId(walletId),
        userId: normalizeUserId(userId),
    });
}

async function findUserWalletByName(userId, name, excludeId = null) {
    const db = await connectDB();

    const query = {
        userId: normalizeUserId(userId),
        name: normalizeWalletName(name),
    };

    if (excludeId) {
        query._id = { $ne: new ObjectId(excludeId) };
    }

    return db.collection("wallets").findOne(query);
}

async function updateUserWallet(userId, walletId, walletData) {
    const db = await connectDB();

    return db.collection("wallets").updateOne(
        {
            _id: new ObjectId(walletId),
            userId: normalizeUserId(userId),
        },
        {
            $set: {
                name: normalizeWalletName(walletData.name),
                type: normalizeWalletType(walletData.type),
                currency: normalizeCurrency(walletData.currency),
                openingBalance: Number(walletData.openingBalance || 0),
                openingBalanceDate: walletData.openingBalanceDate || new Date(),
                notes: String(walletData.notes || "").trim(),
                updatedAt: new Date(),
            },
        }
    );
}

async function deleteUserWallet(userId, walletId) {
    const db = await connectDB();

    return db.collection("wallets").deleteOne({
        _id: new ObjectId(walletId),
        userId: normalizeUserId(userId),
    });
}

async function getUserWalletTransactionStats(userId) {
    const db = await connectDB();

    const stats = await db.collection("transactions").aggregate([
        {
            $match: {
                userId: normalizeUserId(userId),
                wallet: { $type: "string", $ne: "" },
            },
        },
        {
            $group: {
                _id: "$wallet",
                transactionCount: { $sum: 1 },
                income: {
                    $sum: {
                        $cond: [{ $eq: ["$type", "income"] }, "$amount", 0],
                    },
                },
                expense: {
                    $sum: {
                        $cond: [{ $eq: ["$type", "expense"] }, "$amount", 0],
                    },
                },
                lastTransactionAt: { $max: "$transactionDate" },
            },
        },
    ]).toArray();

    return stats.reduce((map, item) => {
        map[item._id] = {
            transactionCount: item.transactionCount || 0,
            income: item.income || 0,
            expense: item.expense || 0,
            lastTransactionAt: item.lastTransactionAt || null,
        };
        return map;
    }, {});
}

module.exports = {
    normalizeWalletName,
    normalizeWalletType,
    normalizeCurrency,
    createWallet,
    getUserWallets,
    findUserWalletById,
    findUserWalletByName,
    updateUserWallet,
    deleteUserWallet,
    getUserWalletTransactionStats,
};
