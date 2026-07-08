const generateOTP = require("../utils/generateOTP");
const sendOTPEmail = require("../utils/emailService");

const {
    saveOTP,
    findOTP,
    findActiveOTP,
    markOTPAsVerified,
    incrementAttemptCount,
    blockOTP,
    findLatestOTP,
} = require("../collections/otps");

const {
    findOrCreateUserByEmail,
    findUserById,
    buildDefaultUserSettings,
} = require("../collections/users");

const {
    saveSession,
    logoutSession,
} = require("../collections/session");

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
    saveEmailLead,
    findEmailLead,
    updateLastAttempt,
    markEmailAsVerified,
} = require("../collections/emailLeads");
const {
    OTP_EXPIRY_SECONDS,
} = require("../utils/otpConfig");

function getRemainingCooldownSeconds(otpSentAt, activeOTP) {
    const now = Date.now();
    const sessionRemaining = otpSentAt
        ? Math.ceil(((Number(otpSentAt) + (OTP_EXPIRY_SECONDS * 1000)) - now) / 1000)
        : 0;
    const activeOtpRemaining = activeOTP?.expiresAt
        ? Math.ceil((new Date(activeOTP.expiresAt).getTime() - now) / 1000)
        : 0;

    return Math.max(sessionRemaining, activeOtpRemaining, 0);
}

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


// AUTH PAGE
async function showAuthPage(req, res) {
    try {
        // Change Email Request
        if (req.query.action === "changeEmail") {
            delete req.session.email;
            delete req.session.otpSentAt;

            return res.redirect("/");
        }

        // Already Logged In
        if (req.session.userId) {
            return res.redirect("/dashboard");
        }

        return res.render("auth/login", {
            otpSent: !!req.session.email,
            email: req.session.email || "",
            otpSentAt: req.session.otpSentAt || null,
            otpExpirySeconds: OTP_EXPIRY_SECONDS,
        });

    } catch (error) {
        console.error(error);

        req.flash("error_msg", "Server Error");

        return res.redirect("/");
    }
}


// AUTH HANDLER
async function authHandler(req, res) {
    try {
        if (req.session.userId) {
            return res.redirect("/dashboard");
        }

        const { action } = req.body;

        switch (action) {
            case "sendOtp":
                return await sendOTP(req, res);

            case "resendOtp":
                return await sendOTP(req, res, { isResend: true });

            case "verifyOtp":
                return await verifyOTP(req, res);

            default:
                return res.redirect("/");
        }

    } catch (error) {
        console.error(error);

        req.flash("error_msg", "Server Error");

        return res.redirect("/");
    }
}


// SEND OTP
async function sendOTP(req, res, options = {}) {
    try {
        const isResend = options.isResend === true;
        let email = isResend
            ? req.session.email
            : req.body.email;

        email = email?.trim().toLowerCase();

        if (!email) {
            req.flash(
                "error_msg",
                isResend
                    ? "Please request an OTP first"
                    : "Email is required"
            );

            return res.redirect("/");
        }

        // Validate Email Format
        const emailRegex =
            /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!emailRegex.test(email)) {
            req.flash(
                "error_msg",
                "Please enter a valid email address"
            );

            return res.redirect("/");
        }

        // Save Or Update Email Lead
        const emailLead =
            await findEmailLead(email);

        if (!emailLead) {

            await saveEmailLead(email);

        } else {

            await updateLastAttempt(email);

        }

        // Check active OTP
        const activeOTP = await findActiveOTP(email);

        const remainingSeconds = getRemainingCooldownSeconds(
            req.session.otpSentAt,
            activeOTP
        );

        if (remainingSeconds > 0) {
            req.flash(
                "error_msg",
                `OTP already sent. Please wait ${remainingSeconds}s before requesting a new one.`
            );

            return res.redirect("/");
        }

        const { otp, expiresAt } = generateOTP();

        await saveOTP(
            email,
            otp,
            expiresAt
        );

        await sendOTPEmail(
            email,
            otp
        );

        // Temporary OTP Session
        req.session.email = email;
        req.session.otpSentAt = Date.now();

        req.flash(
            "success_msg",
            isResend
                ? "OTP resent successfully"
                : "OTP sent successfully"
        );

        return res.redirect("/");

    } catch (error) {
        console.error(
            "Send OTP Error:",
            error
        );

        req.flash(
            "error_msg",
            "Failed to send OTP"
        );

        return res.redirect("/");
    }
}


// VERIFY OTP
async function verifyOTP(req, res) {
    try {
        const { otp } = req.body;

        // Validate OTP Format
        if (!/^\d{6}$/.test(otp)) {
            req.flash("error_msg", "Invalid OTP");
            return res.redirect("/");
        }

        const email = req.session.email;

        // OTP Session Exists?
        if (!email) {
            req.flash("error_msg", "Please request an OTP first");
            return res.redirect("/");
        }

        // Find Latest OTP
        const latestOTP = await findLatestOTP(email);

        // OTP Blocked
        if (latestOTP && latestOTP.status === "blocked") {
            req.flash(
                "error_msg",
                "Too many failed attempts. Please request a new OTP."
            );
            return res.redirect("/");
        }

        const otpRecord = await findOTP(email, otp);
        const activeOTP = await findActiveOTP(email);

        // Invalid OTP
        if (!otpRecord) {
            if (
                latestOTP &&
                latestOTP.otp === otp &&
                latestOTP.status === "sent" &&
                latestOTP.expiresAt < new Date()
            ) {
                delete req.session.email;
                delete req.session.otpSentAt;

                req.flash("error_msg", "OTP Expired");
                return res.redirect("/");
            }

            if (activeOTP) {
                await incrementAttemptCount(activeOTP._id);

                if (activeOTP.attemptCount + 1 >= 5) {
                    await blockOTP(activeOTP._id);

                    req.flash(
                        "error_msg",
                        "Too many failed attempts. Please request a new OTP."
                    );

                    return res.redirect("/");
                }
            }

            req.flash("error_msg", "Invalid OTP");
            return res.redirect("/");
        }

        // OTP Expired
        if (otpRecord.expiresAt < new Date()) {
            delete req.session.email;
            delete req.session.otpSentAt;

            req.flash("error_msg", "OTP Expired");
            return res.redirect("/");
        }

        const user = await findOrCreateUserByEmail(email);

        // Mark OTP As Verified
        await markOTPAsVerified(otpRecord._id);

        // Mark Email Lead As Verified
        await markEmailAsVerified(
            email
        );

        // Create Fresh Session
        await new Promise((resolve, reject) => {
            req.session.regenerate((err) => {
                if (err) return reject(err);
                resolve();
            });
        });

        // Login User
        req.session.userId = user._id;
        req.session.userEmail = user.email;

        // Save Session
        await new Promise((resolve, reject) => {
            req.session.save((err) => {
                if (err) return reject(err);
                resolve();
            });
        });

        // Save Login History
        await saveSession({
            sessionId: req.sessionID,
            userId: user._id,
            email: user.email,
            ipAddress: req.ip,
            userAgent: req.headers["user-agent"],
        });

        req.flash("success_msg", "Logged in successfully");
        return res.redirect("/dashboard");

    } catch (error) {
        console.error("Verify OTP Error:", error);

        req.flash("error_msg", "Server Error");
        return res.redirect("/");
    }
}


// DASHBOARD
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
        const currentMonthKey = getMonthKey(now);
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
            walletBalances: walletBalances
                .filter((wallet) => Number(wallet.balance || 0) !== 0)
                .sort((a, b) => Number(b.balance || 0) - Number(a.balance || 0)),
            walletCount: wallets.length,
            categoryCount: categories.length,
            reminderSummary,
            reminderAlerts,
            upcomingTasks,
            dashboardBudgetAlerts,
        });

    } catch (error) {
        console.error("Dashboard Error:", error);
        req.flash("error_msg", "Server Error");
        res.redirect("/");
    }
}

// LOGOUT
async function logout(req, res) {
    try {
        const sessionId = req.sessionID;

        if (sessionId) {
            await logoutSession(sessionId);
        }

        req.session.destroy((error) => {
            if (error) {
                console.error("Session destroy error:", error);

                req.flash("error_msg", "Logout Error");

                return res.redirect("/dashboard");
            }

            res.clearCookie("connect.sid");

            return res.redirect("/");
        });

    } catch (error) {
        console.error("Logout Error:", error);

        req.flash("error_msg", "Server Error");

        return res.redirect("/dashboard");
    }
}


module.exports = {
    showAuthPage,
    authHandler,
    showDashboard,
    logout,
};
