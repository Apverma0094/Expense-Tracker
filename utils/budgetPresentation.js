const {
    normalizeMonthKey,
    normalizeDateKey,
    normalizePeriodType,
} = require("../collections/budgets");

function getMonthKey(dateValue = new Date()) {
    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
        return "";
    }

    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getMonthLabel(monthKey) {
    const normalized = normalizeMonthKey(monthKey);
    if (!normalized) {
        return "";
    }

    const [year, month] = normalized.split("-").map(Number);
    return new Date(year, month - 1, 1).toLocaleDateString("en-GB", {
        month: "long",
        year: "numeric",
    });
}

function getMonthDateRange(monthKey) {
    const normalized = normalizeMonthKey(monthKey);
    if (!normalized) {
        return { start: null, end: null };
    }

    const [year, month] = normalized.split("-").map(Number);
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59, 999);

    return { start, end };
}

function getCustomDateRange(startDate, endDate) {
    const startKey = normalizeDateKey(startDate);
    const endKey = normalizeDateKey(endDate);

    if (!startKey || !endKey) {
        return { start: null, end: null };
    }

    const start = new Date(`${startKey}T00:00:00`);
    const end = new Date(`${endKey}T23:59:59.999`);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
        return { start: null, end: null };
    }

    return { start, end };
}

function getBudgetPeriodRange(period = {}) {
    const periodType = normalizePeriodType(period.periodType);

    if (periodType === "custom") {
        return getCustomDateRange(period.startDate, period.endDate);
    }

    return getMonthDateRange(period.monthKey);
}

function formatDateLabel(dateValue) {
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) {
        return "";
    }

    return date.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
}

function getBudgetPeriodLabel(period = {}) {
    const periodType = normalizePeriodType(period.periodType);
    if (periodType === "custom") {
        const start = normalizeDateKey(period.startDate);
        const end = normalizeDateKey(period.endDate);

        if (!start || !end) {
            return "Custom Range";
        }

        return `${formatDateLabel(start)} - ${formatDateLabel(end)}`;
    }

    return getMonthLabel(period.monthKey);
}

function buildPeriodExpenseTransactions(transactions, period = {}) {
    const { start, end } = getBudgetPeriodRange(period);
    if (!start || !end) {
        return [];
    }

    return transactions.filter((transaction) => {
        const date = new Date(transaction.transactionDate);
        return transaction.type === "expense"
            && !Number.isNaN(date.getTime())
            && date >= start
            && date <= end;
    });
}

function buildMonthExpenseTransactions(transactions, monthKey) {
    return buildPeriodExpenseTransactions(transactions, {
        periodType: "monthly",
        monthKey,
    });
}

function buildCategoryExpenseMap(transactions) {
    return transactions.reduce((map, transaction) => {
        const key = String(transaction.category || "Uncategorized");
        map[key] = Number(map[key] || 0) + Number(transaction.amount || 0);
        return map;
    }, {});
}

function buildBudgetStatus(limit, spent) {
    const safeLimit = Number(limit || 0);
    const safeSpent = Number(spent || 0);
    const usedPercent = safeLimit > 0 ? (safeSpent / safeLimit) * 100 : 0;

    return {
        usedPercent: safeLimit > 0 ? Math.min(usedPercent, 100) : 0,
        remaining: safeLimit - safeSpent,
        status: safeLimit <= 0
            ? "Not Set"
            : safeSpent > safeLimit
                ? "Over"
                : usedPercent >= 80
                    ? "Near Limit"
                    : "On Track",
    };
}

function buildBudgetHistoryRows(monthKeys, budgets, transactionsByMonth) {
    return monthKeys.map((monthKey) => {
        const budget = budgets.find((item) => (
            normalizePeriodType(item.periodType) === "monthly"
            && item.monthKey === monthKey
        )) || null;
        const expenses = transactionsByMonth[monthKey] || [];
        const spent = expenses.reduce((sum, item) => sum + Number(item.amount || 0), 0);
        const overallLimit = Number(budget?.overallLimit || 0);
        const meta = buildBudgetStatus(overallLimit, spent);

        return {
            monthKey,
            label: getMonthLabel(monthKey),
            overallLimit,
            spent,
            remaining: meta.remaining,
            usedPercent: meta.usedPercent,
            status: overallLimit <= 0
                ? "No Budget"
                : spent > overallLimit
                    ? "Over Budget"
                    : meta.usedPercent >= 80
                        ? "At Risk"
                        : "On Track",
        };
    });
}

function isBudgetActiveOnDate(budget = {}, dateValue = new Date()) {
    const periodType = normalizePeriodType(budget.periodType);
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) {
        return false;
    }

    if (periodType === "custom") {
        const { start, end } = getCustomDateRange(budget.startDate, budget.endDate);
        return Boolean(start && end && date >= start && date <= end);
    }

    return normalizeMonthKey(budget.monthKey) === getMonthKey(date);
}

module.exports = {
    getMonthKey,
    getMonthLabel,
    getMonthDateRange,
    getCustomDateRange,
    getBudgetPeriodRange,
    getBudgetPeriodLabel,
    buildPeriodExpenseTransactions,
    buildMonthExpenseTransactions,
    buildCategoryExpenseMap,
    buildBudgetStatus,
    buildBudgetHistoryRows,
    isBudgetActiveOnDate,
};
