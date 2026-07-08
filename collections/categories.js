const connectDB = require("../config/db");
const { ObjectId } = require("mongodb");

function normalizeUserId(userId) {
    return String(userId || "");
}

function normalizeType(type) {
    const normalized = String(type || "").trim().toLowerCase();
    return ["income", "expense"].includes(normalized)
        ? normalized
        : "";
}

function normalizeCategoryName(name) {
    return String(name || "").trim();
}

function buildCategoryFilters(userId, filters = {}) {
    const query = {
        userId: normalizeUserId(userId),
    };

    const type = normalizeType(filters.type);
    if (type) {
        query.type = type;
    }

    const search = String(filters.search || "").trim();
    if (search) {
        query.name = { $regex: search, $options: "i" };
    }

    return query;
}

async function createCategory(categoryData) {
    const db = await connectDB();

    return db.collection("categories").insertOne({
        ...categoryData,
        userId: normalizeUserId(categoryData.userId),
        type: normalizeType(categoryData.type),
        name: normalizeCategoryName(categoryData.name),
        icon: String(categoryData.icon || "").trim(),
        description: String(categoryData.description || "").trim(),
        createdAt: new Date(),
        updatedAt: new Date(),
    });
}

async function getUserCategories(userId, filters = {}) {
    const db = await connectDB();

    return db
        .collection("categories")
        .find(buildCategoryFilters(userId, filters))
        .sort({ name: 1, createdAt: -1 })
        .toArray();
}

async function findUserCategoryByName(userId, name, type, excludeId = null) {
    const db = await connectDB();

    const query = {
        userId: normalizeUserId(userId),
        name: normalizeCategoryName(name),
    };

    if (excludeId) {
        query._id = { $ne: new ObjectId(excludeId) };
    }

    return db.collection("categories").findOne(query);
}

async function updateUserCategory(userId, categoryId, categoryData) {
    const db = await connectDB();

    return db.collection("categories").updateOne(
        {
            _id: new ObjectId(categoryId),
            userId: normalizeUserId(userId),
        },
        {
            $set: {
                name: normalizeCategoryName(categoryData.name),
                type: normalizeType(categoryData.type),
                icon: String(categoryData.icon || "").trim(),
                description: String(categoryData.description || "").trim(),
                updatedAt: new Date(),
            },
        }
    );
}

async function deleteUserCategory(userId, categoryId) {
    const db = await connectDB();

    return db.collection("categories").deleteOne({
        _id: new ObjectId(categoryId),
        userId: normalizeUserId(userId),
    });
}

async function getUserCategoryUsage(userId) {
    const db = await connectDB();

    const usage = await db.collection("transactions").aggregate([
        {
            $match: {
                userId: normalizeUserId(userId),
                category: { $type: "string", $ne: "" },
            },
        },
        {
            $group: {
                _id: "$category",
                count: { $sum: 1 },
            },
        },
    ]).toArray();

    return usage.reduce((map, item) => {
        map[item._id] = item.count;
        return map;
    }, {});
}

module.exports = {
    normalizeType,
    normalizeCategoryName,
    createCategory,
    getUserCategories,
    findUserCategoryByName,
    updateUserCategory,
    deleteUserCategory,
    getUserCategoryUsage,
};
