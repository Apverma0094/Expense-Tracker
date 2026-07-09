const {
    findUserById,
    buildDefaultUserSettings,
    updateUserSettings,
} = require("../collections/users");
const {
    getUserWallets,
} = require("../collections/wallets");

function normalizeBoolean(value) {
    return value === "on" || value === true || value === "true";
}

function normalizeSettingsPayload(body) {
    return {
        profile: {
            fullName: String(body.fullName || "").trim(),
            phone: String(body.phone || "").trim(),
            timezone: String(body.timezone || "Asia/Kolkata").trim(),
            profileImage: String(body.profileImage || "").trim(),
        },
        preferences: {
            defaultCurrency: String(body.defaultCurrency || "INR").trim().toUpperCase(),
            dateFormat: String(body.dateFormat || "DD/MM/YYYY").trim(),
            monthStart: String(body.monthStart || "1").trim(),
            defaultWallet: String(body.defaultWallet || "").trim(),
            monthlyBudgetLimit: Number(body.monthlyBudgetLimit || 0),
        },
        notifications: {
            budgetAlert: normalizeBoolean(body.budgetAlert),
            billReminder: normalizeBoolean(body.billReminder),
            weeklySummary: normalizeBoolean(body.weeklySummary),
        },
    };
}

function validateSettingsPayload(payload, walletNames) {
    if (!payload.profile.timezone) {
        return "Timezone is required";
    }

    if (!payload.preferences.defaultCurrency) {
        return "Default currency is required";
    }

    if (!Number.isFinite(payload.preferences.monthlyBudgetLimit) || payload.preferences.monthlyBudgetLimit < 0) {
        return "Monthly budget must be 0 or greater";
    }

    if (payload.preferences.defaultWallet && !walletNames.includes(payload.preferences.defaultWallet)) {
        return "Please select a valid default wallet";
    }

    return null;
}

async function showSettingsPage(req, res) {
    try {
        const [user, wallets] = await Promise.all([
            findUserById(req.session.userId),
            getUserWallets(req.session.userId),
        ]);
        const settings = buildDefaultUserSettings(user || {});
        const profileDisplayName = settings.profile.fullName || user?.email || "Expense Tracker Profile";
        const profileView = {
            profileImage: settings.profile.profileImage || "",
            profileDisplayName,
            profileInitials: profileDisplayName
                .split(/\s+/)
                .filter(Boolean)
                .slice(0, 2)
                .map((part) => part[0]?.toUpperCase() || "")
                .join("") || "ET",
            budgetStatus: settings.notifications.budgetAlert ? "On" : "Off",
            walletStatus: settings.preferences.defaultWallet || "Not selected",
            budgetLimitValue: Number(settings.preferences.monthlyBudgetLimit || 0),
        };

        res.render("panels/settings", {
            user: user || {},
            settings,
            wallets,
            profileView,
            pageStyles: ["assets2/css/settings.css"],
        });
    } catch (error) {
        console.error(error);
        req.flash("error_msg", "Failed to load settings");
        return res.redirect("/dashboard");
    }
}

async function updateSettings(req, res) {
    try {
        const wallets = await getUserWallets(req.session.userId);
        const payload = normalizeSettingsPayload(req.body);
        const validationError = validateSettingsPayload(
            payload,
            wallets.map((wallet) => wallet.name)
        );

        if (validationError) {
            req.flash("error_msg", validationError);
            return res.redirect("/settings");
        }

        const result = await updateUserSettings(req.session.userId, payload);

        if (!result.matchedCount) {
            req.flash("error_msg", "User profile not found");
            return res.redirect("/settings");
        }

        req.flash("success_msg", "Settings updated successfully");
        return res.redirect("/settings");
    } catch (error) {
        console.error(error);
        req.flash("error_msg", "Failed to update settings");
        return res.redirect("/settings");
    }
}

module.exports = {
    showSettingsPage,
    updateSettings,
};
