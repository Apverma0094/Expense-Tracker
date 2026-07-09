function formatAmount(amount) {
    return "Rs. " + Number(amount || 0).toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

function reminderBadgeClass(status) {
    if (status === "overdue") {
        return "bg-danger-subtle text-danger";
    }

    if (status === "due-today") {
        return "bg-warning-subtle text-warning";
    }

    return "bg-primary-subtle text-primary";
}

function reminderPriorityClass(priority) {
    if (priority === "high") {
        return "bg-danger-subtle text-danger";
    }

    if (priority === "low") {
        return "bg-success-subtle text-success";
    }

    return "bg-warning-subtle text-warning";
}

function buildDashboardViewModel({
    monthOverview = [],
    categoryBreakdown = [],
    walletBalances = [],
    budgetTarget = 0,
    reminderSummary = {},
}) {
    const monthLabels = monthOverview.map((item) => item.label);
    const monthIncome = monthOverview.map((item) => Number(item.income || 0));
    const monthExpense = monthOverview.map((item) => Number(item.expense || 0));
    const monthBalance = monthOverview.map((item) => Number(item.balance || 0));
    const categoryLabels = categoryBreakdown.map((item) => item.category);
    const categoryValues = categoryBreakdown.map((item) => Number(item.amount || 0));
    const walletLabels = walletBalances.map((item) => item.name);
    const walletValues = walletBalances.map((item) => Number(item.balance || 0));
    const monthCapacity = monthOverview.map((item) => Math.max(
        Number(item.income || 0),
        Number(item.expense || 0),
        Number(budgetTarget || 0)
    ));
    const monthCapacityRemainder = monthCapacity.map((value, index) => Math.max(value - monthExpense[index], 0));
    const monthSavingsRate = monthOverview.map((item) => (
        Number(item.income || 0) > 0
            ? Number((((item.income - item.expense) / item.income) * 100).toFixed(2))
            : 0
    ));
    const monthBudgetUseTrend = monthOverview.map((item) => (
        Number(budgetTarget || 0) > 0
            ? Number(Math.min(((Number(item.expense || 0) / Number(budgetTarget || 0)) * 100), 100).toFixed(2))
            : 0
    ));
    const monthBudgetLeftTrend = monthBudgetUseTrend.map((value) => Number((100 - value).toFixed(2)));
    const totalCategoryAmount = categoryValues.reduce((sum, value) => sum + value, 0);
    const totalWalletBalance = walletValues.reduce((sum, value) => sum + value, 0);
    const topCategory = categoryBreakdown[0] || null;
    const bestBalanceMonth = monthOverview.reduce((best, month) => (
        !best || Number(month.balance || 0) > Number(best.balance || 0) ? month : best
    ), null);
    const reminderPayProgress = reminderSummary.moneyToPay > 0
        ? Math.min((reminderSummary.overdue / Math.max(reminderSummary.totalActive, 1)) * 100, 100)
        : 0;

    return {
        formatAmount,
        reminderBadgeClass,
        reminderPriorityClass,
        topCategory,
        bestBalanceMonth,
        totalWalletBalance,
        reminderPayProgress,
        pageStyles: ["assets2/css/dashboard.css"],
        pageScripts: ["assets2/js/dashboard.js"],
        chartData: {
            monthLabels,
            monthIncome,
            monthExpense,
            monthBalance,
            monthSavingsRate,
            monthBudgetLeftTrend,
            monthBudgetUseTrend,
            monthCapacityRemainder,
            categoryLabels: categoryLabels.length ? categoryLabels : ["No Data"],
            categoryValues: categoryValues.length ? categoryValues : [1],
            categoryTotalLabel: totalCategoryAmount > 0 ? "100%" : "0%",
            walletLabels: walletLabels.length ? walletLabels : ["No Wallets"],
            walletValues: walletValues.length ? walletValues : [0],
        },
    };
}

module.exports = {
    formatAmount,
    reminderBadgeClass,
    reminderPriorityClass,
    buildDashboardViewModel,
};
