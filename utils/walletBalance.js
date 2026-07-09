function buildWalletBalanceMap(wallets = [], transactionStats = {}, transferStats = {}) {
    return wallets.reduce((map, wallet) => {
        const tx = transactionStats[wallet.name] || {};
        const transfer = transferStats[wallet.name] || {};
        const openingBalance = Number(wallet.openingBalance || 0);
        const income = Number(tx.income || 0);
        const expense = Number(tx.expense || 0);
        const incomingTransfers = Number(transfer.incomingAmount || 0);
        const outgoingTransfers = Number(transfer.outgoingAmount || 0);

        map[wallet.name] = openingBalance + income + incomingTransfers - expense - outgoingTransfers;
        return map;
    }, {});
}

function transactionBalanceImpact(transaction = {}) {
    const amount = Number(transaction.amount || 0);

    if (transaction.type === "income") {
        return amount;
    }

    if (transaction.type === "expense") {
        return -amount;
    }

    return 0;
}

function applyTransactionToWalletBalanceMap(balanceMap, transaction = {}, direction = 1) {
    const walletName = String(transaction.wallet || "").trim();

    if (!walletName) {
        return balanceMap;
    }

    const impact = transactionBalanceImpact(transaction) * direction;
    balanceMap[walletName] = Number(balanceMap[walletName] || 0) + impact;
    return balanceMap;
}

function getNegativeWallets(balanceMap = {}) {
    return Object.entries(balanceMap)
        .filter(([, balance]) => Number(balance || 0) < 0)
        .map(([walletName]) => walletName);
}

module.exports = {
    buildWalletBalanceMap,
    applyTransactionToWalletBalanceMap,
    getNegativeWallets,
};
