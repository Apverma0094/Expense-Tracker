const {
    findUserById,
    buildDefaultUserSettings,
} = require("../collections/users");
const {
    getUserTransactions,
} = require("../collections/transactions");
const {
    getUserCategories,
} = require("../collections/categories");
const {
    getUserWallets,
    getUserWalletTransactionStats,
} = require("../collections/wallets");
const {
    getUserWalletTransferStats,
} = require("../collections/walletTransfers");
const {
    getUserReminders,
} = require("../collections/reminders");
const {
    buildReminderSummary,
    buildReminderAlertItems,
    getReminderStatusMeta,
    formatInputDate,
} = require("../utils/reminderPresentation");
const {
    getUserBudgets,
} = require("../collections/budgets");
const {
    getMonthKey,
    getBudgetPeriodLabel,
    buildPeriodExpenseTransactions,
    buildBudgetStatus,
    isBudgetActiveOnDate,
} = require("../utils/budgetPresentation");
const {
    buildDashboardViewModel,
} = require("../utils/dashboardPresentation");

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

function buildLastSixMonthsOverview(transactions) {
    const now = new Date();
    const months = Array.from({ length: 6 }, (_, index) => {
        const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
        return {
            key: getMonthKey(date),
            label: getMonthLabel(date),
            income: 0,
            expense: 0,
            categories: {},
        };
    });

    const monthMap = months.reduce((map, month) => {
        map[month.key] = month;
        return map;
    }, {});

    transactions.forEach((transaction) => {
        const date = new Date(transaction.transactionDate);
        if (Number.isNaN(date.getTime())) {
            return;
        }

        const month = monthMap[getMonthKey(date)];
        if (!month) {
            return;
        }

        const amount = Number(transaction.amount || 0);
        if (transaction.type === "income") {
            month.income += amount;
        }

        if (transaction.type === "expense") {
            month.expense += amount;
            const category = transaction.category || "Uncategorized";
            month.categories[category] = Number(month.categories[category] || 0) + amount;
        }
    });

    return months.map((month) => {
        const topCategoryEntry = Object.entries(month.categories)
            .sort((a, b) => b[1] - a[1])[0];

        return {
            label: month.label,
            income: month.income,
            expense: month.expense,
            balance: month.income - month.expense,
            topCategory: topCategoryEntry ? topCategoryEntry[0] : "-",
        };
    });
}

function buildCategoryBreakdown(transactions, year) {
    const categoryMap = {};

    transactions.forEach((transaction) => {
        const date = new Date(transaction.transactionDate);
        if (
            transaction.type !== "expense" ||
            Number.isNaN(date.getTime()) ||
            date.getFullYear() !== year
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

async function showDashboard(req, res) {
    try {
        const [user, transactions, categories, wallets, reminders] = await Promise.all([
            findUserById(req.session.userId),
            getUserTransactions(req.session.userId),
            getUserCategories(req.session.userId),
            getUserWallets(req.session.userId),
            getUserReminders(req.session.userId),
        ]);
        const transactionStats = await getUserWalletTransactionStats(req.session.userId);
        const transferStats = await getUserWalletTransferStats(req.session.userId);
        const walletBalances = buildWalletBalances(wallets, transactionStats, transferStats);
        const totalIncome = transactions
            .filter((transaction) => transaction.type === "income")
            .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);
        const totalExpense = transactions
            .filter((transaction) => transaction.type === "expense")
            .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);
        const currentBalance = walletBalances.length
            ? walletBalances.reduce((sum, wallet) => sum + Number(wallet.balance || 0), 0)
            : totalIncome - totalExpense;
        const savingsRate = totalIncome > 0
            ? ((totalIncome - totalExpense) / totalIncome) * 100
            : 0;
        const now = new Date();
        const settings = buildDefaultUserSettings(user || {});
        const budgetRecords = await getUserBudgets(req.session.userId);
        const currentMonthTransactions = transactions.filter((transaction) => {
            const date = new Date(transaction.transactionDate);
            return !Number.isNaN(date.getTime()) &&
                date.getFullYear() === now.getFullYear() &&
                date.getMonth() === now.getMonth();
        });
        const currentMonthExpense = currentMonthTransactions
            .filter((transaction) => transaction.type === "expense")
            .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);
        const currentMonthIncome = currentMonthTransactions
            .filter((transaction) => transaction.type === "income")
            .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);
        const monthOverview = buildLastSixMonthsOverview(transactions);
        const averageMonthlyExpense = monthOverview.length
            ? monthOverview.reduce((sum, month) => sum + month.expense, 0) / monthOverview.length
            : 0;
        const activeBudgetDocs = budgetRecords
            .filter((budget) => isBudgetActiveOnDate(budget, now))
            .sort((a, b) => {
                if (String(a.periodType || "monthly") === "custom" && String(b.periodType || "monthly") !== "custom") {
                    return -1;
                }

                if (String(a.periodType || "monthly") !== "custom" && String(b.periodType || "monthly") === "custom") {
                    return 1;
                }

                return 0;
            });
        const primaryBudgetDoc = activeBudgetDocs.find((item) => Number(item.overallLimit || 0) > 0) || null;
        const derivedBudgetTarget = Math.max(averageMonthlyExpense, currentMonthExpense, currentMonthIncome, 1);
        const budgetTarget = Number(
            primaryBudgetDoc?.overallLimit
            || settings.preferences.monthlyBudgetLimit
            || derivedBudgetTarget
        );
        const budgetUsedPercent = budgetTarget > 0
            ? Math.min((currentMonthExpense / budgetTarget) * 100, 100)
            : 0;
        const budgetLeftPercent = Math.max(100 - budgetUsedPercent, 0);
        const primaryBudgetExpense = primaryBudgetDoc
            ? buildPeriodExpenseTransactions(transactions, primaryBudgetDoc)
                .reduce((sum, item) => sum + Number(item.amount || 0), 0)
            : currentMonthExpense;
        const primaryBudgetMeta = buildBudgetStatus(budgetTarget, primaryBudgetExpense);
        const dashboardBudgetAlerts = activeBudgetDocs.flatMap((budget) => {
            const periodExpenses = buildPeriodExpenseTransactions(transactions, budget);
            const totalSpent = periodExpenses.reduce((sum, item) => sum + Number(item.amount || 0), 0);
            const alerts = [];
            const overallLimit = Number(budget.overallLimit || 0);

            if (overallLimit > 0) {
                const overallMeta = buildBudgetStatus(overallLimit, totalSpent);
                if (overallMeta.status === "Over" || overallMeta.usedPercent >= 80) {
                    alerts.push({
                        title: "Overall Budget",
                        periodLabel: getBudgetPeriodLabel(budget),
                        limit: overallLimit,
                        spent: totalSpent,
                        remaining: overallMeta.remaining,
                        usedPercent: overallMeta.usedPercent,
                        status: overallMeta.status === "Over" ? "Over Budget" : "At Risk",
                    });
                }
            }

            const categorySpentMap = periodExpenses.reduce((map, transaction) => {
                const key = String(transaction.category || "Uncategorized");
                map[key] = Number(map[key] || 0) + Number(transaction.amount || 0);
                return map;
            }, {});

            (budget.categoryBudgets || []).forEach((item) => {
                const limit = Number(item.limit || 0);
                const spent = Number(categorySpentMap[item.category] || 0);
                const meta = buildBudgetStatus(limit, spent);

                if (limit > 0 && (meta.status === "Over" || meta.usedPercent >= 80)) {
                    alerts.push({
                        title: item.category,
                        periodLabel: getBudgetPeriodLabel(budget),
                        limit,
                        spent,
                        remaining: meta.remaining,
                        usedPercent: meta.usedPercent,
                        status: meta.status === "Over" ? "Over Budget" : "At Risk",
                    });
                }
            });

            return alerts;
        })
            .sort((a, b) => {
                const aScore = a.remaining < 0 ? 1000 + Math.abs(a.remaining) : a.usedPercent;
                const bScore = b.remaining < 0 ? 1000 + Math.abs(b.remaining) : b.usedPercent;
                return bScore - aScore;
            })
            .slice(0, 4);
        const categoryBreakdown = buildCategoryBreakdown(transactions, now.getFullYear());
        const todayKey = formatInputDate(now);
        const reminderSummary = buildReminderSummary(reminders, todayKey);
        const reminderAlerts = buildReminderAlertItems(reminders, 4, todayKey);
        const upcomingTasks = reminders
            .map((reminder) => ({
                ...reminder,
                statusMeta: getReminderStatusMeta(reminder, todayKey),
            }))
            .filter((reminder) => reminder.category === "task" && !reminder.statusMeta.isCompleted)
            .sort((a, b) => new Date(a.dueDate || 0) - new Date(b.dueDate || 0))
            .slice(0, 3)
            .map((reminder) => ({
                title: reminder.title || "Untitled Task",
                dueDateText: reminder.dueDate
                    ? new Date(reminder.dueDate).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                    })
                    : "No due date",
                lifecycleStatus: reminder.statusMeta.lifecycleStatus,
                priority: String(reminder.priority || "medium"),
            }));
        const dashboardView = buildDashboardViewModel({
            monthOverview,
            categoryBreakdown,
            walletBalances: walletBalances
                .filter((wallet) => Number(wallet.balance || 0) !== 0)
                .sort((a, b) => Number(b.balance || 0) - Number(a.balance || 0)),
            budgetTarget,
            reminderSummary,
        });
        const sortedWalletBalances = walletBalances
            .filter((wallet) => Number(wallet.balance || 0) !== 0)
            .sort((a, b) => Number(b.balance || 0) - Number(a.balance || 0));

        res.render("dashboard", {
            totalIncome,
            totalExpense,
            currentBalance,
            savingsRate,
            currentMonthExpense,
            currentMonthIncome,
            budgetTarget,
            budgetUsedPercent,
            budgetLeftPercent,
            budgetRemainingAmount: primaryBudgetMeta.remaining,
            budgetPeriodLabel: primaryBudgetDoc ? getBudgetPeriodLabel(primaryBudgetDoc) : new Date(now.getFullYear(), now.getMonth(), 1).toLocaleDateString("en-GB", {
                month: "long",
                year: "numeric",
            }),
            budgetMonthLabel: new Date(now.getFullYear(), now.getMonth(), 1).toLocaleDateString("en-GB", {
                month: "long",
                year: "numeric",
            }),
            monthOverview,
            categoryBreakdown,
            walletBalances: sortedWalletBalances,
            walletCount: wallets.length,
            categoryCount: categories.length,
            reminderSummary,
            reminderAlerts,
            upcomingTasks,
            dashboardBudgetAlerts,
            ...dashboardView,
        });
    } catch (error) {
        console.error("Dashboard Error:", error);
        req.flash("error_msg", "Server Error");
        res.redirect("/");
    }
}

module.exports = {
    showDashboard,
};
