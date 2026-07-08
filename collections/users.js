const connectDB = require("../config/db");
const { ObjectId } = require("mongodb");

function normalizeEmail(email) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

async function findUserByEmail(email) {
  try {
    const db = await connectDB();

    return await db
      .collection("users")
      .findOne({ email: normalizeEmail(email) });

  } catch (error) {
    console.error(
      "Error finding user:",
      error
    );

    throw error;
  }
}

async function createUser(email) {
  try {
    const db = await connectDB();
    const normalizedEmail = normalizeEmail(email);

    const result = await db
      .collection("users")
      .insertOne({
        email: normalizedEmail,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

    return result;

  } catch (error) {
    console.error(
      "Error creating user:",
      error
    );

    throw error;
  }
}

async function findOrCreateUserByEmail(email) {
  const normalizedEmail = normalizeEmail(email);
  let user = await findUserByEmail(normalizedEmail);

  if (user) {
    return user;
  }

  const result = await createUser(normalizedEmail);

  return {
    _id: result.insertedId,
    email: normalizedEmail,
  };
}

async function findUserById(userId) {
  try {
    const db = await connectDB();

    return await db
      .collection("users")
      .findOne({
        _id: new ObjectId(userId)
      });

  } catch (error) {
    console.error(
      "Error finding user by id:",
      error
    );

    throw error;
  }
}

function buildDefaultUserSettings(user = {}) {
  const profile = user.profile || {};
  const preferences = user.preferences || {};
  const notifications = user.notifications || {};

  return {
    profile: {
      fullName: String(profile.fullName || ""),
      phone: String(profile.phone || ""),
      timezone: String(profile.timezone || "Asia/Kolkata"),
      profileImage: String(profile.profileImage || ""),
    },
    preferences: {
      defaultCurrency: String(preferences.defaultCurrency || "INR"),
      dateFormat: String(preferences.dateFormat || "DD/MM/YYYY"),
      monthStart: String(preferences.monthStart || "1"),
      defaultWallet: String(preferences.defaultWallet || ""),
      monthlyBudgetLimit: Number(preferences.monthlyBudgetLimit || 0),
    },
    notifications: {
      budgetAlert: Boolean(notifications.budgetAlert ?? true),
      billReminder: Boolean(notifications.billReminder ?? true),
      weeklySummary: Boolean(notifications.weeklySummary ?? false),
    },
  };
}

async function updateUserSettings(userId, settings) {
  try {
    const db = await connectDB();

    return await db
      .collection("users")
      .updateOne(
        { _id: new ObjectId(userId) },
        {
          $set: {
            profile: {
              fullName: String(settings.profile.fullName || "").trim(),
              phone: String(settings.profile.phone || "").trim(),
              timezone: String(settings.profile.timezone || "Asia/Kolkata").trim(),
              profileImage: String(settings.profile.profileImage || "").trim(),
            },
            preferences: {
              defaultCurrency: String(settings.preferences.defaultCurrency || "INR").trim().toUpperCase(),
              dateFormat: String(settings.preferences.dateFormat || "DD/MM/YYYY").trim(),
              monthStart: String(settings.preferences.monthStart || "1").trim(),
              defaultWallet: String(settings.preferences.defaultWallet || "").trim(),
              monthlyBudgetLimit: Number(settings.preferences.monthlyBudgetLimit || 0),
            },
            notifications: {
              budgetAlert: Boolean(settings.notifications.budgetAlert),
              billReminder: Boolean(settings.notifications.billReminder),
              weeklySummary: Boolean(settings.notifications.weeklySummary),
            },
            updatedAt: new Date(),
          },
        }
      );

  } catch (error) {
    console.error(
      "Error updating user settings:",
      error
    );

    throw error;
  }
}

function buildUserProfileView(user = {}) {
  const profile = user.profile || {};
  const email = String(user.email || "").trim();
  const fullName = String(profile.fullName || "").trim();
  const displayName = fullName || (email ? email.split("@")[0] : "Expense Tracker User");
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "ET";

  return {
    email,
    displayName,
    initials,
    profileImage: String(profile.profileImage || "").trim(),
  };
}

module.exports = {
  findUserByEmail,
  createUser,
  findOrCreateUserByEmail,
  findUserById,
  buildDefaultUserSettings,
  buildUserProfileView,
  updateUserSettings,
};
