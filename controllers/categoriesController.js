const {
    createCategory,
    getUserCategories,
    findUserCategoryByName,
    updateUserCategory,
    deleteUserCategory,
    getUserCategoryUsage,
    normalizeType,
    normalizeCategoryName,
} = require("../collections/categories");
const {
    renameUserCategoryReferences,
} = require("../collections/transactions");
const {
    CATEGORY_ICON_OPTIONS,
    getCategoryVisual,
} = require("../utils/categoryPresentation");

const SAMPLE_CATEGORIES = [
    { name: "Salary", type: "income", icon: "salary", description: "Monthly salary and fixed income" },
    { name: "Freelance", type: "income", icon: "freelance", description: "Client work and side projects" },
    { name: "Bonus", type: "income", icon: "bonus", description: "Performance bonus and incentives" },
    { name: "Investment Returns", type: "income", icon: "investment", description: "Dividends, interest, or gains" },
    { name: "Gift Received", type: "income", icon: "gift", description: "Cash gifts and personal support" },
    { name: "Food & Dining", type: "expense", icon: "food", description: "Meals, snacks, and restaurants" },
    { name: "Travel", type: "expense", icon: "travel", description: "Trips, tickets, and stays" },
    { name: "Shopping", type: "expense", icon: "shopping", description: "Clothes, gadgets, and essentials" },
    { name: "Bills", type: "expense", icon: "bills", description: "Recurring monthly bills" },
    { name: "Rent", type: "expense", icon: "rent", description: "House rent and accommodation" },
    { name: "Health", type: "expense", icon: "health", description: "Medicine, doctor, and wellness" },
    { name: "Entertainment", type: "expense", icon: "entertainment", description: "Movies, OTT, and fun spends" },
    { name: "Education", type: "expense", icon: "education", description: "Courses, books, and fees" },
    { name: "Transport", type: "expense", icon: "transport", description: "Fuel, cab, and commute" },
    { name: "Utilities", type: "expense", icon: "utilities", description: "Electricity, internet, and services" },
];

function normalizeCategoryPayload(body) {
    return {
        name: normalizeCategoryName(body.name || body.categoryName),
        type: normalizeType(body.type),
        icon: String(body.icon || "").trim(),
        description: String(body.description || body.note || "").trim(),
    };
}

function validateCategoryPayload(payload) {
    if (!payload.name) {
        return "Category name is required";
    }

    if (!payload.type) {
        return "Category type must be income or expense";
    }

    return null;
}

function buildCategoryFilters(query) {
    return {
        type: normalizeType(query.type),
        search: String(query.search || "").trim(),
    };
}

async function ensureStarterCategories(userId) {
    const existingCategories = await getUserCategories(userId);
    const existingKeys = new Set(
        existingCategories.map((category) => `${category.type}:${category.name.toLowerCase()}`)
    );
    const missingCategories = SAMPLE_CATEGORIES.filter((category) => (
        !existingKeys.has(`${category.type}:${category.name.toLowerCase()}`)
    ));

    if (!missingCategories.length) {
        return existingCategories;
    }

    await Promise.all(missingCategories.map((category) => createCategory({
        userId,
        ...category,
    })));

    return getUserCategories(userId);
}

async function showCategoriesPage(req, res) {
    try {
        const filters = buildCategoryFilters(req.query);
        const seededCategories = await ensureStarterCategories(req.session.userId);
        const categories = filters.type || filters.search
            ? await getUserCategories(req.session.userId, filters)
            : seededCategories;
        const usage = await getUserCategoryUsage(req.session.userId);

        return res.render("categories/categories", {
            categories: categories.map((category) => ({
                ...category,
                usageCount: usage[category.name] || 0,
                visual: getCategoryVisual(category.icon, category.type),
            })),
            filters,
            iconOptions: CATEGORY_ICON_OPTIONS,
        });

    } catch (error) {
        console.error(error);
        req.flash("error_msg", "Failed to load categories");
        return res.redirect("/dashboard");
    }
}

async function addCategory(req, res) {
    try {
        const payload = normalizeCategoryPayload(req.body);
        const validationError = validateCategoryPayload(payload);

        if (validationError) {
            req.flash("error_msg", validationError);
            return res.redirect("/categories");
        }

        const existingCategory = await findUserCategoryByName(
            req.session.userId,
            payload.name,
            payload.type
        );

        if (existingCategory) {
            req.flash("error_msg", "Category already exists");
            return res.redirect("/categories");
        }

        await createCategory({
            userId: req.session.userId,
            ...payload,
        });

        req.flash("success_msg", "Category added successfully");
        return res.redirect("/categories");

    } catch (error) {
        console.error(error);
        req.flash("error_msg", "Failed to add category");
        return res.redirect("/categories");
    }
}

async function updateCategory(req, res) {
    try {
        const payload = normalizeCategoryPayload(req.body);
        const validationError = validateCategoryPayload(payload);

        if (validationError) {
            req.flash("error_msg", validationError);
            return res.redirect("/categories");
        }

        const duplicateCategory = await findUserCategoryByName(
            req.session.userId,
            payload.name,
            payload.type,
            req.params.id
        );

        if (duplicateCategory) {
            req.flash("error_msg", "Category already exists");
            return res.redirect("/categories");
        }

        const categories = await getUserCategories(req.session.userId);
        const currentCategory = categories.find((item) => String(item._id) === req.params.id);

        if (!currentCategory) {
            req.flash("error_msg", "Category not found");
            return res.redirect("/categories");
        }

        const result = await updateUserCategory(
            req.session.userId,
            req.params.id,
            payload
        );

        if (!result.matchedCount) {
            req.flash("error_msg", "Category not found");
            return res.redirect("/categories");
        }

        if (currentCategory.name !== payload.name) {
            await renameUserCategoryReferences(
                req.session.userId,
                currentCategory.name,
                payload.name
            );
        }

        req.flash("success_msg", "Category updated successfully");
        return res.redirect("/categories");

    } catch (error) {
        console.error(error);
        req.flash("error_msg", "Failed to update category");
        return res.redirect("/categories");
    }
}

async function removeCategory(req, res) {
    try {
        const usage = await getUserCategoryUsage(req.session.userId);
        const categories = await getUserCategories(req.session.userId);
        const category = categories.find((item) => String(item._id) === req.params.id);

        if (!category) {
            req.flash("error_msg", "Category not found");
            return res.redirect("/categories");
        }

        if ((usage[category.name] || 0) > 0) {
            req.flash("error_msg", "Category is in use by transactions and cannot be deleted");
            return res.redirect("/categories");
        }

        await deleteUserCategory(req.session.userId, req.params.id);
        req.flash("success_msg", "Category deleted successfully");
        return res.redirect("/categories");

    } catch (error) {
        console.error(error);
        req.flash("error_msg", "Failed to delete category");
        return res.redirect("/categories");
    }
}

module.exports = {
    showCategoriesPage,
    addCategory,
    updateCategory,
    removeCategory,
};
