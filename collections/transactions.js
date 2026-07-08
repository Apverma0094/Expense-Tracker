const connectDB = require("../config/db");
const { ObjectId } = require("mongodb");

function normalizeUserId(userId) {
    return String(userId || "");
}

function buildTransactionFilters(userId, filters = {}) {
    const query = {
        userId: normalizeUserId(userId),
    };

    if (filters.type) {
        query.type = filters.type;
    }

    if (filters.category) {
        query.category = filters.category;
    }

    if (filters.wallet) {
        query.wallet = filters.wallet;
    }

    if (filters.search) {
        query.$or = [
            { title: { $regex: filters.search, $options: "i" } },
            { category: { $regex: filters.search, $options: "i" } },
            { wallet: { $regex: filters.search, $options: "i" } },
            { description: { $regex: filters.search, $options: "i" } },
        ];
    }

    return query;
}

async function createTransaction(transactionData) {
    try {
        const db = await connectDB();

        const result = await db
            .collection("transactions")
            .insertOne({
                ...transactionData,
                userId: normalizeUserId(transactionData.userId),
                createdAt: new Date(),
                updatedAt: new Date()
            });

        return result;

    } catch (error) {
        console.error(
            "Error creating transaction:",
            error
        );

        throw error;
    }
}

async function getUserTransactions(userId, filters = {}) {
    try {
        const db = await connectDB();

        return await db
            .collection("transactions")
            .find(buildTransactionFilters(userId, filters))
            .sort({ transactionDate: -1, createdAt: -1 })
            .toArray();

    } catch (error) {
        console.error(
            "Error getting transactions:",
            error
        );

        throw error;
    }
}

async function findUserTransactionById(userId, transactionId) {
    try {
        const db = await connectDB();

        return await db
            .collection("transactions")
            .findOne({
                _id: new ObjectId(transactionId),
                userId: normalizeUserId(userId),
            });

    } catch (error) {
        console.error(
            "Error finding transaction:",
            error
        );

        throw error;
    }
}

async function updateUserTransaction(userId, transactionId, transactionData) {
    try {
        const db = await connectDB();

        return await db
            .collection("transactions")
            .updateOne(
                {
                    _id: new ObjectId(transactionId),
                    userId: normalizeUserId(userId),
                },
                {
                    $set: {
                        ...transactionData,
                        updatedAt: new Date(),
                    },
                }
            );

    } catch (error) {
        console.error(
            "Error updating transaction:",
            error
        );

        throw error;
    }
}

async function deleteUserTransaction(userId, transactionId) {
    try {
        const db = await connectDB();

        return await db
            .collection("transactions")
            .deleteOne({
                _id: new ObjectId(transactionId),
                userId: normalizeUserId(userId),
            });

    } catch (error) {
        console.error(
            "Error deleting transaction:",
            error
        );

        throw error;
    }
}

async function renameUserCategoryReferences(userId, oldName, newName) {
    const db = await connectDB();

    return db.collection("transactions").updateMany(
        {
            userId: normalizeUserId(userId),
            category: oldName,
        },
        {
            $set: {
                category: newName,
                updatedAt: new Date(),
            },
        }
    );
}

async function renameUserWalletReferences(userId, oldName, newName) {
    const db = await connectDB();

    return db.collection("transactions").updateMany(
        {
            userId: normalizeUserId(userId),
            wallet: oldName,
        },
        {
            $set: {
                wallet: newName,
                updatedAt: new Date(),
            },
        }
    );
}

module.exports = {
    createTransaction,
    getUserTransactions,
    findUserTransactionById,
    updateUserTransaction,
    deleteUserTransaction,
    renameUserCategoryReferences,
    renameUserWalletReferences,
};
