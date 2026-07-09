const express = require("express");
const session = require("express-session");
const MongoStore = require("connect-mongo").default;
const flash = require("connect-flash");
require("dotenv").config();

const connectDB = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const transactionRoutes = require(
    "./routes/transactionRoutes"
);
const analyticsRoutes = require("./routes/analyticsRoutes");
const walletRoutes = require("./routes/walletRoutes");
const categoriesRoutes = require("./routes/categoriesRoutes");
const settingsRoutes = require("./routes/settingsRoutes");
const remindersRoutes = require("./routes/remindersRoutes");
const budgetRoutes = require("./routes/budgetRoutes");
const cacheControl = require("./middleware/cacheControl");
const {
    findUserById,
    buildUserProfileView,
    buildDefaultUserSettings,
} = require("./collections/users");
const {
    getUserReminders,
} = require("./collections/reminders");
const {
    buildReminderSummary,
    buildReminderAlertItems,
} = require("./utils/reminderPresentation");
const {
    formatAmount,
    formatDate,
    formatInputDate,
    formatDownloadName,
    typeBadgeClass,
    typeLabel,
    budgetStatusBadgeClass,
} = require("./utils/viewHelpers");

const app = express();

// View Engine
app.set("view engine", "ejs");

// Middlewares
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(express.static("public"));

// Session Middleware
app.use(
    session({
        secret: process.env.SESSION_SECRET,

        resave: false,
        saveUninitialized: false,

        store: MongoStore.create({
            mongoUrl: process.env.MONGO_URI,
            collectionName: "sessions",
            ttl: 30 * 24 * 60 * 60,
        }),

        cookie: {
            maxAge: 30 * 24 * 60 * 60 * 1000,
            httpOnly: true,
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
        },
    })
);

// Flash Messages
app.use(flash());

app.use((req, res, next) => {
    const successMessages = req.flash("success_msg");
    const errorMessages = req.flash("error_msg");
    const currentPath = (req.originalUrl || req.path || "/").split("?")[0];

    res.locals.success_msg = successMessages;
    res.locals.error_msg = errorMessages;
    res.locals.currentPath = currentPath;
    res.locals.pageStyles = [];
    res.locals.pageScripts = [];
    res.locals.formatAmount = formatAmount;
    res.locals.formatDate = formatDate;
    res.locals.formatInputDate = formatInputDate;
    res.locals.formatDownloadName = formatDownloadName;
    res.locals.typeBadgeClass = typeBadgeClass;
    res.locals.typeLabel = typeLabel;
    res.locals.budgetStatusBadgeClass = budgetStatusBadgeClass;
    res.locals.isActiveRoute = (route) => currentPath === route || currentPath.startsWith(`${route}/`);
    res.locals.toastMessages = [
        ...successMessages.map((message) => ({
            type: "success",
            title: "Success",
            message,
        })),
        ...errorMessages.map((message) => ({
            type: "error",
            title: "Error",
            message,
        })),
    ];

    next();
});

app.use(async (req, res, next) => {
    try {
        res.locals.headerNotifications = {
            enabled: true,
            count: 0,
            items: [],
        };

        if (!req.session?.userId) {
            res.locals.currentUser = buildUserProfileView({});
            return next();
        }

        const user = await findUserById(req.session.userId);
        const settings = buildDefaultUserSettings(user || {});
        const reminders = await getUserReminders(req.session.userId);
        const reminderSummary = buildReminderSummary(reminders);
        res.locals.currentUser = buildUserProfileView(user || {});
        res.locals.headerNotifications = {
            enabled: settings.notifications.billReminder,
            count: reminderSummary.dueToday + reminderSummary.overdue,
            items: buildReminderAlertItems(reminders, 6),
        };
        return next();
    } catch (error) {
        console.error("Failed to load current user:", error);
        res.locals.currentUser = buildUserProfileView({});
        res.locals.headerNotifications = {
            enabled: true,
            count: 0,
            items: [],
        };
        return next();
    }
});

// Cache Control
app.use(cacheControl);

// Routes
app.use("/", authRoutes);
app.use("/transactions",transactionRoutes);
app.use("/analytics", analyticsRoutes);
app.use("/wallet", walletRoutes);
app.use("/categories", categoriesRoutes);
app.use("/settings", settingsRoutes);
app.use("/reminders", remindersRoutes);
app.use("/budget", budgetRoutes);

// Server Startup
const PORT = process.env.PORT || 3000;

async function startServer() {
    try {
        await connectDB();

        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });

    } catch (error) {
        console.error("Failed to connect database:", error);

        process.exit(1);
    }
}

startServer();
