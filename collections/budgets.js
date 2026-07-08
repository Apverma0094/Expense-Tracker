const connectDB = require("../config/db");

function normalizeUserId(userId) {
    return String(userId || "");
}

function normalizeMonthKey(monthKey) {
    const normalized = String(monthKey || "").trim();
    return /^\d{4}-\d{2}$/.test(normalized)
        ? normalized
        : "";
}

function normalizeDateKey(dateValue) {
    const normalized = String(dateValue || "").trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(normalized)
        ? normalized
        : "";
}

function normalizePeriodType(periodType) {
    return String(periodType || "").trim().toLowerCase() === "custom"
        ? "custom"
        : "monthly";
}

function normalizeCategoryBudgetItem(item = {}) {
    return {
        category: String(item.category || "").trim(),
        limit: Number(item.limit || 0),
    };
}

function buildBudgetIdentity(period = {}) {
    const periodType = normalizePeriodType(period.periodType);

    if (periodType === "custom") {
        return {
            periodType,
            startDate: normalizeDateKey(period.startDate),
            endDate: normalizeDateKey(period.endDate),
        };
    }

    return {
        periodType: "monthly",
        monthKey: normalizeMonthKey(period.monthKey),
    };
}

function buildBudgetLookupQuery(userId, period = {}) {
    const identity = buildBudgetIdentity(period);
    const baseQuery = { userId: normalizeUserId(userId) };

    if (identity.periodType === "custom") {
        return {
            ...baseQuery,
            periodType: "custom",
            startDate: identity.startDate,
            endDate: identity.endDate,
        };
    }

    return {
        ...baseQuery,
        monthKey: identity.monthKey,
        $or: [
            { periodType: "monthly" },
            { periodType: { $exists: false } },
        ],
    };
}

async function getUserBudgetForPeriod(userId, period = {}) {
    const db = await connectDB();
    return db.collection("budgets").findOne(buildBudgetLookupQuery(userId, period));
}

async function getUserBudgetByMonth(userId, monthKey) {
    return getUserBudgetForPeriod(userId, {
        periodType: "monthly",
        monthKey,
    });
}

async function getUserBudgets(userId) {
    const db = await connectDB();

    return db.collection("budgets")
        .find({ userId: normalizeUserId(userId) })
        .sort({ updatedAt: -1, monthKey: -1, endDate: -1, createdAt: -1 })
        .toArray();
}

async function upsertUserBudget(userId, budgetData = {}) {
    const db = await connectDB();
    const identity = buildBudgetIdentity(budgetData);

    return db.collection("budgets").updateOne(
        buildBudgetLookupQuery(userId, identity),
        {
            $set: {
                periodType: identity.periodType,
                monthKey: identity.periodType === "monthly" ? identity.monthKey : "",
                startDate: identity.periodType === "custom" ? identity.startDate : "",
                endDate: identity.periodType === "custom" ? identity.endDate : "",
                overallLimit: Number(budgetData.overallLimit || 0),
                notes: String(budgetData.notes || "").trim(),
                categoryBudgets: Array.isArray(budgetData.categoryBudgets)
                    ? budgetData.categoryBudgets
                        .map(normalizeCategoryBudgetItem)
                        .filter((item) => item.category)
                    : [],
                updatedAt: new Date(),
            },
            $setOnInsert: {
                userId: normalizeUserId(userId),
                createdAt: new Date(),
            },
        },
        { upsert: true }
    );
}

module.exports = {
    normalizeMonthKey,
    normalizeDateKey,
    normalizePeriodType,
    buildBudgetIdentity,
    getUserBudgetByMonth,
    getUserBudgetForPeriod,
    getUserBudgets,
    upsertUserBudget,
};
