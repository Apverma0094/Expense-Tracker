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
    getUserBudgetByMonth,
    getUserBudgetForPeriod,
    getUserBudgets,
    upsertUserBudget,
    normalizeMonthKey,
    normalizeDateKey,
    normalizePeriodType,
    buildBudgetIdentity,
} = require("../collections/budgets");
const {
    getMonthKey,
    getMonthLabel,
    getBudgetPeriodLabel,
    buildPeriodExpenseTransactions,
    buildCategoryExpenseMap,
    buildBudgetHistoryRows,
    buildBudgetStatus,
} = require("../utils/budgetPresentation");

function normalizeBudgetFilters(query = {}) {
    const periodType = normalizePeriodType(query.periodType);
    const month = normalizeMonthKey(query.month) || getMonthKey(new Date());
    const startDate = normalizeDateKey(query.startDate);
    const endDate = normalizeDateKey(query.endDate);

    if (periodType === "custom" && startDate && endDate) {
        return {
            periodType: "custom",
            month,
            startDate,
            endDate,
        };
    }

    return {
        periodType: "monthly",
        month,
        startDate: "",
        endDate: "",
    };
}

function normalizeBudgetPayload(body) {
    return {
        periodType: normalizePeriodType(body.periodType),
        monthKey: normalizeMonthKey(body.monthKey),
        startDate: normalizeDateKey(body.startDate),
        endDate: normalizeDateKey(body.endDate),
        overallLimit: Number(body.overallLimit || 0),
        notes: String(body.notes || "").trim(),
    };
}

function normalizeCategoryBudgetPayload(body) {
    return {
        periodType: normalizePeriodType(body.periodType),
        monthKey: normalizeMonthKey(body.monthKey),
        startDate: normalizeDateKey(body.startDate),
        endDate: normalizeDateKey(body.endDate),
        category: String(body.category || "").trim(),
        originalCategory: String(body.originalCategory || body.category || "").trim(),
        limit: Number(body.limit || 0),
    };
}

function validatePeriodFields(payload) {
    if (payload.periodType === "custom") {
        if (!payload.startDate || !payload.endDate) {
            return "Please select a valid start and end date";
        }

        if (payload.startDate > payload.endDate) {
            return "Start date must be before end date";
        }

        return null;
    }

    if (!payload.monthKey) {
        return "Please select a valid month";
    }

    return null;
}

function validateBudgetPayload(payload) {
    const periodError = validatePeriodFields(payload);
    if (periodError) {
        return periodError;
    }

    if (!Number.isFinite(payload.overallLimit) || payload.overallLimit < 0) {
        return "Overall budget must be 0 or greater";
    }

    return null;
}

function validateCategoryBudgetPayload(payload, validCategoryNames) {
    const periodError = validatePeriodFields(payload);
    if (periodError) {
        return periodError;
    }

    if (!payload.category) {
        return "Please select a category";
    }

    if (!validCategoryNames.includes(payload.category)) {
        return "Please select a valid expense category";
    }

    if (!Number.isFinite(payload.limit) || payload.limit < 0) {
        return "Category budget must be 0 or greater";
    }

    return null;
}

function getLastSixMonthKeys(baseDate = new Date()) {
    return Array.from({ length: 6 }, (_, index) => {
        const date = new Date(baseDate.getFullYear(), baseDate.getMonth() - index, 1);
        return getMonthKey(date);
    }).reverse();
}

function buildCategoryRows(expenseCategories, categoryBudgets, categorySpentMap) {
    const limitMap = (categoryBudgets || []).reduce((map, item) => {
        map[item.category] = Number(item.limit || 0);
        return map;
    }, {});

    const names = [...new Set([
        ...expenseCategories.map((item) => item.name),
        ...Object.keys(limitMap),
        ...Object.keys(categorySpentMap),
    ])];

    return names
        .map((name) => {
            const limit = Number(limitMap[name] || 0);
            const spent = Number(categorySpentMap[name] || 0);
            const meta = buildBudgetStatus(limit, spent);

            return {
                category: name,
                limit,
                spent,
                remaining: meta.remaining,
                usedPercent: meta.usedPercent,
                status: meta.status,
            };
        })
        .sort((a, b) => b.spent - a.spent || a.category.localeCompare(b.category));
}

function buildRedirectQuery(payload) {
    if (payload.periodType === "custom") {
        return `periodType=custom&startDate=${payload.startDate}&endDate=${payload.endDate}`;
    }

    return `periodType=monthly&month=${payload.monthKey}`;
}

async function showBudgetPage(req, res) {
    try {
        const filters = normalizeBudgetFilters(req.query);
        const [user, transactions, categories, allBudgets] = await Promise.all([
            findUserById(req.session.userId),
            getUserTransactions(req.session.userId),
            getUserCategories(req.session.userId),
            getUserBudgets(req.session.userId),
        ]);
        const settings = buildDefaultUserSettings(user || {});
        const expenseCategories = categories.filter((category) => category.type === "expense");
        const budgetDoc = filters.periodType === "custom"
            ? await getUserBudgetForPeriod(req.session.userId, filters)
            : await getUserBudgetByMonth(req.session.userId, filters.month);
        const expenseTransactions = buildPeriodExpenseTransactions(transactions, {
            periodType: filters.periodType,
            monthKey: filters.month,
            startDate: filters.startDate,
            endDate: filters.endDate,
        });
        const totalSpent = expenseTransactions.reduce((sum, item) => sum + Number(item.amount || 0), 0);
        const overallLimit = Number(
            budgetDoc?.overallLimit
            || (filters.periodType === "monthly" ? settings.preferences.monthlyBudgetLimit : 0)
            || 0
        );
        const statusMeta = buildBudgetStatus(overallLimit, totalSpent);
        const categorySpentMap = buildCategoryExpenseMap(expenseTransactions);
        const categoryRows = buildCategoryRows(expenseCategories, budgetDoc?.categoryBudgets || [], categorySpentMap);
        const alertRows = categoryRows
            .filter((item) => item.limit > 0 && (item.spent > item.limit || item.usedPercent >= 80))
            .sort((a, b) => b.usedPercent - a.usedPercent)
            .slice(0, 5);
        const baseDate = filters.periodType === "custom"
            ? new Date(`${filters.endDate || filters.startDate}T12:00:00`)
            : new Date(`${filters.month}-01T12:00:00`);
        const lastSixMonthKeys = getLastSixMonthKeys(baseDate);
        const transactionsByMonth = lastSixMonthKeys.reduce((map, key) => {
            map[key] = buildPeriodExpenseTransactions(transactions, {
                periodType: "monthly",
                monthKey: key,
            });
            return map;
        }, {});
        const historyRows = buildBudgetHistoryRows(lastSixMonthKeys, allBudgets, transactionsByMonth);

        return res.render("panels/budget", {
            filters,
            pageStyles: ["assets2/css/budget.css"],
            pageScripts: ["assets2/js/budget.js"],
            summary: {
                periodType: filters.periodType,
                periodLabel: getBudgetPeriodLabel({
                    periodType: filters.periodType,
                    monthKey: filters.month,
                    startDate: filters.startDate,
                    endDate: filters.endDate,
                }),
                overallLimit,
                totalSpent,
                remaining: statusMeta.remaining,
                usedPercent: statusMeta.usedPercent,
                totalCategories: categoryRows.filter((item) => item.limit > 0).length,
                overBudgetCategories: categoryRows.filter((item) => item.limit > 0 && item.spent > item.limit).length,
                overBudgetAmount: statusMeta.remaining < 0 ? Math.abs(statusMeta.remaining) : 0,
                hasOverallBudget: overallLimit > 0,
            },
            budget: budgetDoc || {
                ...buildBudgetIdentity({
                    periodType: filters.periodType,
                    monthKey: filters.month,
                    startDate: filters.startDate,
                    endDate: filters.endDate,
                }),
                overallLimit,
                notes: "",
                categoryBudgets: [],
            },
            expenseCategories,
            categoryRows,
            alertRows,
            historyRows,
            monthlyBudgetFallback: settings.preferences.monthlyBudgetLimit || 0,
            chartData: {
                labels: historyRows.map((item) => item.label),
                budgetValues: historyRows.map((item) => Number(item.overallLimit || 0)),
                spentValues: historyRows.map((item) => Number(item.spent || 0)),
            },
        });
    } catch (error) {
        console.error(error);
        req.flash("error_msg", "Failed to load budget page");
        return res.redirect("/dashboard");
    }
}

async function saveBudgetOverview(req, res) {
    try {
        const payload = normalizeBudgetPayload(req.body);
        const validationError = validateBudgetPayload(payload);

        if (validationError) {
            req.flash("error_msg", validationError);
            return res.redirect("/budget");
        }

        const currentBudget = payload.periodType === "custom"
            ? await getUserBudgetForPeriod(req.session.userId, payload)
            : await getUserBudgetByMonth(req.session.userId, payload.monthKey);

        await upsertUserBudget(req.session.userId, {
            periodType: payload.periodType,
            monthKey: payload.monthKey,
            startDate: payload.startDate,
            endDate: payload.endDate,
            overallLimit: payload.overallLimit,
            notes: payload.notes,
            categoryBudgets: currentBudget?.categoryBudgets || [],
        });

        req.flash("success_msg", "Budget saved successfully");
        return res.redirect(`/budget?${buildRedirectQuery(payload)}`);
    } catch (error) {
        console.error(error);
        req.flash("error_msg", "Failed to save budget");
        return res.redirect("/budget");
    }
}

async function saveCategoryBudget(req, res) {
    try {
        const payload = normalizeCategoryBudgetPayload(req.body);
        const categories = await getUserCategories(req.session.userId);
        const expenseCategoryNames = categories
            .filter((category) => category.type === "expense")
            .map((category) => category.name);
        const validationError = validateCategoryBudgetPayload(payload, expenseCategoryNames);

        if (validationError) {
            req.flash("error_msg", validationError);
            return res.redirect(`/budget?${buildRedirectQuery(payload)}`);
        }

        const currentBudget = payload.periodType === "custom"
            ? await getUserBudgetForPeriod(req.session.userId, payload)
            : await getUserBudgetByMonth(req.session.userId, payload.monthKey);
        const categoryBudgets = [...(currentBudget?.categoryBudgets || [])];
        const existingIndex = categoryBudgets.findIndex((item) => item.category === payload.originalCategory);

        if (existingIndex >= 0) {
            categoryBudgets[existingIndex] = {
                category: payload.category,
                limit: payload.limit,
            };
        } else {
            categoryBudgets.push({
                category: payload.category,
                limit: payload.limit,
            });
        }

        await upsertUserBudget(req.session.userId, {
            periodType: payload.periodType,
            monthKey: payload.monthKey,
            startDate: payload.startDate,
            endDate: payload.endDate,
            overallLimit: Number(currentBudget?.overallLimit || 0),
            notes: String(currentBudget?.notes || ""),
            categoryBudgets,
        });

        req.flash("success_msg", "Category budget saved successfully");
        return res.redirect(`/budget?${buildRedirectQuery(payload)}`);
    } catch (error) {
        console.error(error);
        req.flash("error_msg", "Failed to save category budget");
        return res.redirect("/budget");
    }
}

async function deleteCategoryBudget(req, res) {
    try {
        const payload = normalizeCategoryBudgetPayload(req.body);

        if (!payload.category || validatePeriodFields(payload)) {
            req.flash("error_msg", "Invalid category budget request");
            return res.redirect("/budget");
        }

        const currentBudget = payload.periodType === "custom"
            ? await getUserBudgetForPeriod(req.session.userId, payload)
            : await getUserBudgetByMonth(req.session.userId, payload.monthKey);
        if (!currentBudget) {
            req.flash("error_msg", "Budget record not found");
            return res.redirect(`/budget?${buildRedirectQuery(payload)}`);
        }

        await upsertUserBudget(req.session.userId, {
            periodType: payload.periodType,
            monthKey: payload.monthKey,
            startDate: payload.startDate,
            endDate: payload.endDate,
            overallLimit: Number(currentBudget.overallLimit || 0),
            notes: String(currentBudget.notes || ""),
            categoryBudgets: (currentBudget.categoryBudgets || []).filter((item) => item.category !== payload.category),
        });

        req.flash("success_msg", "Category budget removed successfully");
        return res.redirect(`/budget?${buildRedirectQuery(payload)}`);
    } catch (error) {
        console.error(error);
        req.flash("error_msg", "Failed to delete category budget");
        return res.redirect("/budget");
    }
}

module.exports = {
    showBudgetPage,
    saveBudgetOverview,
    saveCategoryBudget,
    deleteCategoryBudget,
};
