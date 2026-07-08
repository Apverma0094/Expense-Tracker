const connectDB = require("../config/db");

function normalizeUserId(userId) {
    return String(userId || "");
}

async function createWalletTransfer(transferData) {
    const db = await connectDB();

    return db.collection("walletTransfers").insertOne({
        ...transferData,
        userId: normalizeUserId(transferData.userId),
        fromWallet: String(transferData.fromWallet || "").trim(),
        toWallet: String(transferData.toWallet || "").trim(),
        amount: Number(transferData.amount || 0),
        note: String(transferData.note || "").trim(),
        transferDate: transferData.transferDate || new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
    });
}

async function getUserWalletTransferStats(userId) {
    const db = await connectDB();

    const transfers = await db.collection("walletTransfers").find({
        userId: normalizeUserId(userId),
    }).toArray();

    return transfers.reduce((map, transfer) => {
        const fromWallet = transfer.fromWallet;
        const toWallet = transfer.toWallet;
        const amount = Number(transfer.amount || 0);
        const transferDate = transfer.transferDate || transfer.createdAt || null;

        if (fromWallet) {
            map[fromWallet] = map[fromWallet] || {
                transferCount: 0,
                incomingAmount: 0,
                outgoingAmount: 0,
                lastTransferAt: null,
            };
            map[fromWallet].transferCount += 1;
            map[fromWallet].outgoingAmount += amount;
            if (!map[fromWallet].lastTransferAt || new Date(transferDate) > new Date(map[fromWallet].lastTransferAt)) {
                map[fromWallet].lastTransferAt = transferDate;
            }
        }

        if (toWallet) {
            map[toWallet] = map[toWallet] || {
                transferCount: 0,
                incomingAmount: 0,
                outgoingAmount: 0,
                lastTransferAt: null,
            };
            map[toWallet].transferCount += 1;
            map[toWallet].incomingAmount += amount;
            if (!map[toWallet].lastTransferAt || new Date(transferDate) > new Date(map[toWallet].lastTransferAt)) {
                map[toWallet].lastTransferAt = transferDate;
            }
        }

        return map;
    }, {});
}

async function renameUserWalletTransferReferences(userId, oldName, newName) {
    const db = await connectDB();
    const normalizedUserId = normalizeUserId(userId);

    await db.collection("walletTransfers").updateMany(
        {
            userId: normalizedUserId,
            fromWallet: oldName,
        },
        {
            $set: {
                fromWallet: newName,
                updatedAt: new Date(),
            },
        }
    );

    return db.collection("walletTransfers").updateMany(
        {
            userId: normalizedUserId,
            toWallet: oldName,
        },
        {
            $set: {
                toWallet: newName,
                updatedAt: new Date(),
            },
        }
    );
}

module.exports = {
    createWalletTransfer,
    getUserWalletTransferStats,
    renameUserWalletTransferReferences,
};
