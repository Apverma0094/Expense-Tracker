const connectDB = require("../config/db");
const { ObjectId } = require("mongodb");

function normalizeUserId(userId) {
    return String(userId || "");
}

function normalizeReminderCategory(category) {
    const normalized = String(category || "").trim().toLowerCase();
    return ["emi", "bill", "borrowed", "lent", "task"].includes(normalized)
        ? normalized
        : "";
}

function normalizeRepeatType(repeatType) {
    const normalized = String(repeatType || "").trim().toLowerCase();
    return ["none", "monthly", "quarterly", "yearly"].includes(normalized)
        ? normalized
        : "none";
}

function normalizePriority(priority) {
    const normalized = String(priority || "").trim().toLowerCase();
    return ["high", "medium", "low"].includes(normalized)
        ? normalized
        : "medium";
}

function normalizeManualStatus(status) {
    return String(status || "").trim().toLowerCase();
}

function buildReminderFilters(userId, filters = {}) {
    const query = {
        userId: normalizeUserId(userId),
    };

    const category = normalizeReminderCategory(filters.category);
    if (category) {
        query.category = category;
    }

    const search = String(filters.search || "").trim();
    if (search) {
        query.$or = [
            { title: { $regex: search, $options: "i" } },
            { personName: { $regex: search, $options: "i" } },
            { notes: { $regex: search, $options: "i" } },
        ];
    }

    return query;
}

async function createReminder(reminderData) {
    const db = await connectDB();

    return db.collection("reminders").insertOne({
        ...reminderData,
        userId: normalizeUserId(reminderData.userId),
        category: normalizeReminderCategory(reminderData.category),
        repeatType: normalizeRepeatType(reminderData.repeatType),
        priority: normalizePriority(reminderData.priority),
        status: normalizeManualStatus(reminderData.status),
        createdAt: new Date(),
        updatedAt: new Date(),
    });
}

async function getUserReminders(userId, filters = {}) {
    const db = await connectDB();

    return db
        .collection("reminders")
        .find(buildReminderFilters(userId, filters))
        .sort({ dueDate: 1, createdAt: -1 })
        .toArray();
}

async function findUserReminderById(userId, reminderId) {
    const db = await connectDB();

    return db.collection("reminders").findOne({
        _id: new ObjectId(reminderId),
        userId: normalizeUserId(userId),
    });
}

async function updateUserReminder(userId, reminderId, reminderData) {
    const db = await connectDB();
    const {
        _id,
        userId: ignoredUserId,
        createdAt,
        ...updatableFields
    } = reminderData;

    return db.collection("reminders").updateOne(
        {
            _id: new ObjectId(reminderId),
            userId: normalizeUserId(userId),
        },
        {
            $set: {
                ...updatableFields,
                category: normalizeReminderCategory(updatableFields.category),
                repeatType: normalizeRepeatType(updatableFields.repeatType),
                priority: normalizePriority(updatableFields.priority),
                status: normalizeManualStatus(updatableFields.status),
                updatedAt: new Date(),
            },
        }
    );
}

async function deleteUserReminder(userId, reminderId) {
    const db = await connectDB();

    return db.collection("reminders").deleteOne({
        _id: new ObjectId(reminderId),
        userId: normalizeUserId(userId),
    });
}

module.exports = {
    normalizeReminderCategory,
    normalizeRepeatType,
    normalizePriority,
    normalizeManualStatus,
    createReminder,
    getUserReminders,
    findUserReminderById,
    updateUserReminder,
    deleteUserReminder,
};
