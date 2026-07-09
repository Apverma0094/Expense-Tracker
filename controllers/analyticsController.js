const { getUserTransactions } = require("../collections/transactions");
const { getUserCategories } = require("../collections/categories");
const { getUserWallets, getUserWalletTransactionStats } = require("../collections/wallets");
const { getUserWalletTransferStats } = require("../collections/walletTransfers");

function getMonthKey(dateValue) {
    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
        return "";
    }

    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getMonthLabel(dateValue) {
    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
        return "";
    }

    return date.toLocaleDateString("en-GB", {
        month: "short",
        year: "2-digit",
    });
}

function buildWalletBalances(wallets, transactionStats, transferStats) {
    return wallets.map((wallet) => {
        const tx = transactionStats[wallet.name] || {};
        const transfer = transferStats[wallet.name] || {};
        const openingBalance = Number(wallet.openingBalance || 0);
        const income = Number(tx.income || 0);
        const expense = Number(tx.expense || 0);
        const incomingTransfers = Number(transfer.incomingAmount || 0);
        const outgoingTransfers = Number(transfer.outgoingAmount || 0);

        return {
            ...wallet,
            balance: openingBalance + income + incomingTransfers - expense - outgoingTransfers,
        };
    });
}

function buildMonthlyOverview(transactions, selectedYear) {
    const months = Array.from({ length: 12 }, (_, index) => {
        const date = new Date(selectedYear, index, 1);
        const key = getMonthKey(date);

        return {
            key,
            label: getMonthLabel(date),
            income: 0,
            expense: 0,
        };
    });

    const monthMap = months.reduce((map, month) => {
        map[month.key] = month;
        return map;
    }, {});

    transactions.forEach((transaction) => {
        const date = new Date(transaction.transactionDate);
        if (Number.isNaN(date.getTime()) || date.getFullYear() !== selectedYear) {
            return;
        }

        const month = monthMap[getMonthKey(date)];
        if (!month) {
            return;
        }

        if (transaction.type === "income") {
            month.income += Number(transaction.amount || 0);
        }

        if (transaction.type === "expense") {
            month.expense += Number(transaction.amount || 0);
        }
    });

    return months.map((month) => ({
        ...month,
        balance: month.income - month.expense,
    }));
}

function buildCategoryBreakdown(transactions, selectedYear) {
    const categoryMap = {};

    transactions.forEach((transaction) => {
        const date = new Date(transaction.transactionDate);
        if (
            transaction.type !== "expense" ||
            Number.isNaN(date.getTime()) ||
            date.getFullYear() !== selectedYear
        ) {
            return;
        }

        const category = transaction.category || "Uncategorized";
        categoryMap[category] = Number(categoryMap[category] || 0) + Number(transaction.amount || 0);
    });

    return Object.entries(categoryMap)
        .map(([category, amount]) => ({ category, amount }))
        .sort((a, b) => b.amount - a.amount);
}

function buildMonthlyTransactionCounts(transactions, selectedYear) {
    const monthlyCounts = Array.from({ length: 12 }, (_, index) => ({
        label: getMonthLabel(new Date(selectedYear, index, 1)),
        count: 0,
    }));

    transactions.forEach((transaction) => {
        const date = new Date(transaction.transactionDate);
        if (Number.isNaN(date.getTime()) || date.getFullYear() !== selectedYear) {
            return;
        }

        monthlyCounts[date.getMonth()].count += 1;
    });

    return monthlyCounts;
}

async function showAnalyticsPage(req, res) {
    try {
        const [transactions, categories, wallets] = await Promise.all([
            getUserTransactions(req.session.userId),
            getUserCategories(req.session.userId),
            getUserWallets(req.session.userId),
        ]);

        const transactionStats = await getUserWalletTransactionStats(req.session.userId);
        const transferStats = await getUserWalletTransferStats(req.session.userId);
        const walletBalances = buildWalletBalances(wallets, transactionStats, transferStats);
        const years = [...new Set(
            transactions
                .map((transaction) => new Date(transaction.transactionDate))
                .filter((date) => !Number.isNaN(date.getTime()))
                .map((date) => date.getFullYear())
        )].sort((a, b) => b - a);
        const currentYear = new Date().getFullYear();
        const selectedYear = years.includes(Number(req.query.year))
            ? Number(req.query.year)
            : (years[0] || currentYear);
        const monthlyOverview = buildMonthlyOverview(transactions, selectedYear);
        const monthlyTransactionCounts = buildMonthlyTransactionCounts(transactions, selectedYear);
        const categoryBreakdown = buildCategoryBreakdown(transactions, selectedYear);
        const yearTransactions = transactions.filter((transaction) => {
            const date = new Date(transaction.transactionDate);
            return !Number.isNaN(date.getTime()) && date.getFullYear() === selectedYear;
        });
        const totalIncome = yearTransactions
            .filter((transaction) => transaction.type === "income")
            .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);
        const totalExpense = yearTransactions
            .filter((transaction) => transaction.type === "expense")
            .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);
        const netFlow = totalIncome - totalExpense;
        const savingsRate = totalIncome > 0
            ? ((netFlow / totalIncome) * 100)
            : 0;
        const averageExpense = yearTransactions.filter((transaction) => transaction.type === "expense").length
            ? totalExpense / yearTransactions.filter((transaction) => transaction.type === "expense").length
            : 0;
        const recentTransactions = [...transactions]
            .sort((a, b) => new Date(b.transactionDate) - new Date(a.transactionDate))
            .slice(0, 6);
        const visibleWalletBalances = walletBalances
            .filter((wallet) => wallet.balance !== 0)
            .sort((a, b) => b.balance - a.balance);
        const totalWalletBalance = visibleWalletBalances.reduce((sum, wallet) => sum + Number(wallet.balance || 0), 0);
        const topCategory = categoryBreakdown[0] || null;
        const strongestMonth = monthlyOverview.reduce((best, month) => (
            !best || Number(month.balance || 0) > Number(best.balance || 0) ? month : best
        ), null);
        const topExpenseMonths = [...monthlyOverview]
            .filter((item) => Number(item.expense || 0) > 0)
            .sort((a, b) => Number(b.expense || 0) - Number(a.expense || 0))
            .slice(0, 5);

        return res.render("panels/analytics", {
            filters: {
                year: selectedYear,
            },
            meta: {
                years: years.length ? years : [currentYear],
                totalIncome,
                totalExpense,
                totalBalance: totalWalletBalance,
                netFlow,
                savingsRate,
                averageExpense,
                transactionCount: yearTransactions.length,
                categoryCount: categories.length,
                walletCount: wallets.length,
            },
            monthlyOverview,
            monthlyTransactionCounts,
            categoryBreakdown,
            walletBalances: visibleWalletBalances,
            recentTransactions,
            totalWalletBalance,
            topCategory,
            strongestMonth,
            pageScripts: ["assets2/js/analytics.js"],
            chartData: {
                monthLabels: monthlyOverview.map((item) => item.label),
                monthIncome: monthlyOverview.map((item) => Number(item.income || 0)),
                monthExpense: monthlyOverview.map((item) => Number(item.expense || 0)),
                monthBalance: monthlyOverview.map((item) => Number(item.balance || 0)),
                monthlyTransactionSeries: monthlyTransactionCounts.map((item) => Number(item.count || 0)),
                categoryLabels: categoryBreakdown.length ? categoryBreakdown.slice(0, 6).map((item) => item.category) : ["No Data"],
                categoryValues: categoryBreakdown.length ? categoryBreakdown.slice(0, 6).map((item) => Number(item.amount || 0)) : [0],
                incomeExpenseSplitLabels: ["Income", "Expense"],
                incomeExpenseSplit: [Number(totalIncome || 0), Number(totalExpense || 0)].some((value) => value > 0)
                    ? [Number(totalIncome || 0), Number(totalExpense || 0)]
                    : [1, 1],
                topExpenseMonthLabels: topExpenseMonths.length ? topExpenseMonths.map((item) => item.label) : ["No Data"],
                topExpenseMonthValues: topExpenseMonths.length ? topExpenseMonths.map((item) => Number(item.expense || 0)) : [0],
                walletLabels: visibleWalletBalances.length ? visibleWalletBalances.map((item) => item.name) : ["No Wallets"],
                walletValues: visibleWalletBalances.length ? visibleWalletBalances.map((item) => Number(item.balance || 0)) : [1],
            },
        });
    } catch (error) {
        console.error(error);
        req.flash("error_msg", "Failed to load analytics");
        return res.redirect("/dashboard");
    }
}

module.exports = {
    showAnalyticsPage,
};
