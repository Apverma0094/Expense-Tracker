const {
    createReminder,
    getUserReminders,
    findUserReminderById,
    updateUserReminder,
    deleteUserReminder,
    normalizeReminderCategory,
    normalizeRepeatType,
    normalizePriority,
} = require("../collections/reminders");
const {
    createTransaction,
} = require("../collections/transactions");
const {
    getUserWallets,
    findUserWalletByName,
} = require("../collections/wallets");
const {
    findUserCategoryByName,
    createCategory,
} = require("../collections/categories");
const {
    findUserById,
    buildDefaultUserSettings,
} = require("../collections/users");

function parseDateInput(value) {
    const raw = String(value || "").trim();
    if (!raw) {
        return null;
    }

    const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) {
        return null;
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(year, month - 1, day, 12, 0, 0, 0);

    if (
        Number.isNaN(date.getTime()) ||
        date.getFullYear() !== year ||
        date.getMonth() !== month - 1 ||
        date.getDate() !== day
    ) {
        return null;
    }

    return date;
}

function formatInputDate(dateValue) {
    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
        return "";
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function getDateKey(dateValue) {
    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
        return "";
    }

    return formatInputDate(date);
}

function addMonths(dateValue, monthsToAdd) {
    const source = new Date(dateValue);
    const nextDate = new Date(source);
    nextDate.setMonth(nextDate.getMonth() + monthsToAdd);
    return nextDate;
}

function nextRecurringDueDate(dateValue, repeatType) {
    switch (repeatType) {
        case "monthly":
            return addMonths(dateValue, 1);
        case "quarterly":
            return addMonths(dateValue, 3);
        case "yearly":
            return addMonths(dateValue, 12);
        default:
            return null;
    }
}

function compareDates(dateValue, todayKey) {
    const dateKey = getDateKey(dateValue);

    if (!dateKey) {
        return "";
    }

    if (dateKey === todayKey) {
        return "due-today";
    }

    return dateKey < todayKey
        ? "overdue"
        : "upcoming";
}

function isCompletionStatus(reminder) {
    return ["paid", "returned", "received", "completed"].includes(String(reminder.status || "").toLowerCase());
}

function getReminderDisplayState(reminder, todayKey) {
    const category = reminder.category;
    const completionStatus = String(reminder.status || "").toLowerCase();

    if (completionStatus === "paid") {
        return {
            displayStatus: "Paid",
            lifecycleStatus: "completed",
            isCompleted: true,
        };
    }

    if (completionStatus === "returned") {
        return {
            displayStatus: "Returned",
            lifecycleStatus: "completed",
            isCompleted: true,
        };
    }

    if (completionStatus === "received") {
        return {
            displayStatus: "Received",
            lifecycleStatus: "completed",
            isCompleted: true,
        };
    }

    if (completionStatus === "completed") {
        return {
            displayStatus: "Completed",
            lifecycleStatus: "completed",
            isCompleted: true,
        };
    }

    const dueState = compareDates(reminder.dueDate, todayKey);

    if (category === "emi" || category === "bill") {
        return {
            displayStatus: dueState === "due-today"
                ? "Due Today"
                : dueState === "overdue"
                    ? "Overdue"
                    : "Upcoming",
            lifecycleStatus: dueState || "upcoming",
            isCompleted: false,
        };
    }

    if (category === "task") {
        return {
            displayStatus: "Upcoming",
            lifecycleStatus: dueState || "upcoming",
            isCompleted: false,
        };
    }

    return {
        displayStatus: "Pending",
        lifecycleStatus: dueState || "upcoming",
        isCompleted: false,
    };
}

function statusBadgeClass(displayStatus, lifecycleStatus) {
    if (["Paid", "Returned", "Received", "Completed"].includes(displayStatus)) {
        return "bg-success-subtle text-success";
    }

    if (lifecycleStatus === "overdue") {
        return "bg-danger-subtle text-danger";
    }

    if (lifecycleStatus === "due-today") {
        return "bg-warning-subtle text-warning";
    }

    return "bg-primary-subtle text-primary";
}

function categoryLabel(category) {
    return {
        emi: "EMI",
        bill: "Bill",
        borrowed: "Borrowed",
        lent: "Lent",
        task: "Task",
    }[category] || "Reminder";
}

function tabKeyForCategory(category) {
    return {
        emi: "emi-bills",
        bill: "emi-bills",
        borrowed: "borrowed",
        lent: "lent",
        task: "tasks",
    }[category] || "emi-bills";
}

function reminderColorKey(reminder) {
    if (isCompletionStatus(reminder)) {
        return "completed";
    }

    if (reminder.category === "emi" || reminder.category === "bill") {
        return "emi";
    }

    if (reminder.category === "borrowed" || reminder.category === "lent") {
        return "money";
    }

    return "task";
}

function buildReminderView(reminder, todayKey) {
    const state = getReminderDisplayState(reminder, todayKey);
    const dueDateText = reminder.dueDate
        ? new Date(reminder.dueDate).toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
        })
        : "-";
    const borrowDateText = reminder.borrowDate
        ? new Date(reminder.borrowDate).toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
        })
        : "-";
    const givenDateText = reminder.givenDate
        ? new Date(reminder.givenDate).toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
        })
        : "-";

    return {
        ...reminder,
        titleText: reminder.title || reminder.personName || "Untitled",
        categoryLabel: categoryLabel(reminder.category),
        tabKey: tabKeyForCategory(reminder.category),
        dueDateKey: getDateKey(reminder.dueDate),
        dueDateText,
        borrowDateText,
        givenDateText,
        borrowDateInput: formatInputDate(reminder.borrowDate),
        givenDateInput: formatInputDate(reminder.givenDate),
        dueDateInput: formatInputDate(reminder.dueDate),
        createdAtText: reminder.createdAt
            ? new Date(reminder.createdAt).toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "short",
                year: "numeric",
            })
            : "-",
        displayStatus: state.displayStatus,
        lifecycleStatus: state.lifecycleStatus,
        isCompleted: state.isCompleted,
        badgeClass: statusBadgeClass(state.displayStatus, state.lifecycleStatus),
        colorKey: reminderColorKey(reminder),
        priorityLabel: reminder.priority
            ? `${String(reminder.priority).charAt(0).toUpperCase()}${String(reminder.priority).slice(1)}`
            : "Medium",
        reminderBeforeLabel: {
            0: "Same Day",
            1: "1 Day",
            3: "3 Days",
            7: "7 Days",
        }[Number(reminder.reminderBefore)] || "1 Day",
        repeatTypeLabel: {
            none: "None",
            monthly: "Monthly",
            quarterly: "Quarterly",
            yearly: "Yearly",
        }[reminder.repeatType] || "None",
    };
}

function normalizeReminderPayload(body, defaults = {}) {
    const category = normalizeReminderCategory(body.category);
    const amount = body.amount === "" || body.amount === undefined
        ? 0
        : Number(body.amount);
    const reminderBefore = Number(body.reminderBefore ?? defaults.reminderBefore ?? 1);
    const notificationEnabled = body.notificationEnabled === "on"
        || body.notificationEnabled === true
        || body.notificationEnabled === "true";

    return {
        category,
        title: String(body.title || "").trim(),
        personName: String(body.personName || "").trim(),
        amount,
        wallet: String(body.wallet || defaults.wallet || "").trim(),
        dueDate: parseDateInput(body.dueDate || body.returnDate || body.expectedReturnDate),
        borrowDate: parseDateInput(body.borrowDate),
        givenDate: parseDateInput(body.givenDate),
        repeatType: normalizeRepeatType(body.repeatType),
        priority: normalizePriority(body.priority),
        reminderBefore: [0, 1, 3, 7].includes(reminderBefore) ? reminderBefore : 1,
        notificationEnabled,
        lastNotificationSent: body.lastNotificationSent ? new Date(body.lastNotificationSent) : null,
        notes: String(body.notes || body.description || "").trim(),
        status: String(body.status || "").trim().toLowerCase(),
    };
}

function validateReminderPayload(payload, walletNames) {
    if (!payload.category) {
        return "Please select a valid reminder type";
    }

    if (payload.category === "emi" || payload.category === "bill") {
        if (!payload.title) {
            return "Title is required";
        }

        if (!Number.isFinite(payload.amount) || payload.amount <= 0) {
            return "Amount must be greater than 0";
        }

        if (!payload.dueDate) {
            return "Please select a valid due date";
        }

        if (!payload.wallet || !walletNames.includes(payload.wallet)) {
            return "Please select a valid wallet for EMI/Bill reminders";
        }
    }

    if (payload.category === "borrowed") {
        if (!payload.personName) {
            return "Person name is required";
        }

        if (!Number.isFinite(payload.amount) || payload.amount <= 0) {
            return "Amount must be greater than 0";
        }

        if (!payload.borrowDate || !payload.dueDate) {
            return "Please select valid borrow and return dates";
        }

        if (payload.dueDate < payload.borrowDate) {
            return "Return date cannot be before borrow date";
        }
    }

    if (payload.category === "lent") {
        if (!payload.personName) {
            return "Person name is required";
        }

        if (!Number.isFinite(payload.amount) || payload.amount <= 0) {
            return "Amount must be greater than 0";
        }

        if (!payload.givenDate || !payload.dueDate) {
            return "Please select valid given and expected return dates";
        }

        if (payload.dueDate < payload.givenDate) {
            return "Expected return date cannot be before given date";
        }
    }

    if (payload.category === "task") {
        if (!payload.title) {
            return "Task title is required";
        }

        if (!payload.dueDate) {
            return "Please select a valid due date";
        }
    }

    if (Number.isFinite(payload.amount) && payload.amount < 0) {
        return "Amount cannot be negative";
    }

    return null;
}

function buildFilters(query) {
    return {
        search: String(query.search || "").trim(),
        category: normalizeReminderCategory(query.category),
        status: String(query.status || "").trim().toLowerCase(),
        fromDate: String(query.fromDate || "").trim(),
        toDate: String(query.toDate || "").trim(),
        month: String(query.month || "").trim(),
        tab: String(query.tab || "emi-bills").trim() || "emi-bills",
    };
}

function filterReminderViews(reminders, filters) {
    const fromDate = parseDateInput(filters.fromDate);
    const toDate = parseDateInput(filters.toDate);

    return reminders.filter((reminder) => {
        if (filters.category && reminder.category !== filters.category) {
            return false;
        }

        if (filters.status) {
            const normalizedDisplay = reminder.displayStatus.toLowerCase().replace(/\s+/g, "-");
            if (filters.status !== normalizedDisplay && filters.status !== reminder.lifecycleStatus) {
                return false;
            }
        }

        if (fromDate && (!reminder.dueDate || new Date(reminder.dueDate) < fromDate)) {
            return false;
        }

        if (toDate && (!reminder.dueDate || new Date(reminder.dueDate) > toDate)) {
            return false;
        }

        return true;
    });
}

function buildSummary(reminders) {
    return reminders.reduce((summary, reminder) => {
        if (!reminder.isCompleted) {
            summary.totalActive += 1;
        }

        if (reminder.lifecycleStatus === "due-today") {
            summary.dueToday += 1;
        }

        if (reminder.lifecycleStatus === "overdue") {
            summary.overdue += 1;
        }

        if (!reminder.isCompleted && ["emi", "bill", "borrowed"].includes(reminder.category)) {
            summary.moneyToPay += Number(reminder.amount || 0);
        }

        if (!reminder.isCompleted && reminder.category === "lent") {
            summary.moneyToReceive += Number(reminder.amount || 0);
        }

        return summary;
    }, {
        totalActive: 0,
        dueToday: 0,
        overdue: 0,
        moneyToPay: 0,
        moneyToReceive: 0,
    });
}

function buildCalendar(reminders, monthValue) {
    const today = new Date();
    const selectedMonth = parseDateInput(`${monthValue || formatInputDate(new Date(today.getFullYear(), today.getMonth(), 1))}`.slice(0, 7) + "-01")
        || new Date(today.getFullYear(), today.getMonth(), 1, 12, 0, 0, 0);
    const year = selectedMonth.getFullYear();
    const month = selectedMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const startOffset = firstDay.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const calendarDays = [];
    const eventMap = reminders.reduce((map, reminder) => {
        if (!reminder.dueDateKey) {
            return map;
        }

        if (!map[reminder.dueDateKey]) {
            map[reminder.dueDateKey] = [];
        }

        map[reminder.dueDateKey].push({
            id: String(reminder._id),
            title: reminder.titleText,
            amount: Number(reminder.amount || 0),
            categoryLabel: reminder.categoryLabel,
            displayStatus: reminder.displayStatus,
            dueDateText: reminder.dueDateText,
            colorKey: reminder.colorKey,
            notes: reminder.notes || "",
        });

        return map;
    }, {});

    for (let index = 0; index < startOffset; index += 1) {
        calendarDays.push({ empty: true });
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
        const date = new Date(year, month, day, 12, 0, 0, 0);
        const key = formatInputDate(date);
        const events = eventMap[key] || [];

        calendarDays.push({
            empty: false,
            day,
            key,
            isToday: key === formatInputDate(today),
            events,
        });
    }

    while (calendarDays.length % 7 !== 0) {
        calendarDays.push({ empty: true });
    }

    return {
        monthValue: `${year}-${String(month + 1).padStart(2, "0")}`,
        monthLabel: firstDay.toLocaleDateString("en-GB", {
            month: "long",
            year: "numeric",
        }),
        prevMonth: formatInputDate(new Date(year, month - 1, 1)).slice(0, 7),
        nextMonth: formatInputDate(new Date(year, month + 1, 1)).slice(0, 7),
        days: calendarDays,
        eventsByDate: eventMap,
    };
}

function splitByTabs(reminders) {
    return {
        emiBills: reminders.filter((reminder) => reminder.tabKey === "emi-bills"),
        borrowed: reminders.filter((reminder) => reminder.tabKey === "borrowed"),
        lent: reminders.filter((reminder) => reminder.tabKey === "lent"),
        tasks: reminders.filter((reminder) => reminder.tabKey === "tasks"),
    };
}

async function ensureExpenseCategory(userId, reminderCategory) {
    const categoryName = reminderCategory === "emi"
        ? "EMI"
        : "Bills";
    const existingCategory = await findUserCategoryByName(userId, categoryName, "expense");

    if (existingCategory) {
        return existingCategory.name;
    }

    await createCategory({
        userId,
        name: categoryName,
        type: "expense",
        icon: "bills",
        description: "Auto-created for reminder payment tracking",
    });

    return categoryName;
}

async function createExpenseFromReminder(userId, reminder) {
    const wallet = await findUserWalletByName(userId, reminder.wallet);
    if (!wallet) {
        throw new Error("Selected reminder wallet no longer exists");
    }

    const category = await ensureExpenseCategory(userId, reminder.category);

    await createTransaction({
        userId,
        title: `${reminder.title} Paid`,
        category,
        wallet: reminder.wallet,
        type: "expense",
        amount: Number(reminder.amount || 0),
        description: `Auto-created from reminder payment on ${new Date().toLocaleDateString("en-GB")}`,
        transactionDate: new Date(),
        billImageData: "",
        billImageName: "",
        billImageMime: "",
    });
}

async function showRemindersPage(req, res) {
    try {
        const filters = buildFilters(req.query);
        const todayKey = formatInputDate(new Date());
        const [user, reminders, wallets] = await Promise.all([
            findUserById(req.session.userId),
            getUserReminders(req.session.userId, {
                search: filters.search,
                category: filters.category,
            }),
            getUserWallets(req.session.userId),
        ]);
        const settings = buildDefaultUserSettings(user || {});
        const reminderViews = reminders.map((reminder) => buildReminderView(reminder, todayKey));
        const filteredReminders = filterReminderViews(reminderViews, filters);
        const tabs = splitByTabs(filteredReminders);
        const summary = buildSummary(reminderViews);
        const calendar = buildCalendar(reminderViews, filters.month);
        const selectedDateKey = calendar.eventsByDate[todayKey]
            ? todayKey
            : Object.keys(calendar.eventsByDate)[0] || "";

        return res.render("reminders/reminders", {
            reminders: filteredReminders,
            tabs,
            summary,
            filters,
            calendar,
            selectedDateKey,
            walletOptions: wallets,
            defaultWallet: settings.preferences.defaultWallet || (wallets[0]?.name || ""),
            hasWallets: wallets.length > 0,
        });
    } catch (error) {
        console.error(error);
        req.flash("error_msg", "Failed to load reminders");
        return res.redirect("/dashboard");
    }
}

async function addReminder(req, res) {
    try {
        const [user, wallets] = await Promise.all([
            findUserById(req.session.userId),
            getUserWallets(req.session.userId),
        ]);
        const settings = buildDefaultUserSettings(user || {});
        const payload = normalizeReminderPayload(req.body, {
            wallet: settings.preferences.defaultWallet,
            reminderBefore: 1,
        });
        const validationError = validateReminderPayload(
            payload,
            wallets.map((wallet) => wallet.name)
        );

        if (validationError) {
            req.flash("error_msg", validationError);
            return res.redirect("/reminders");
        }

        const defaultStatus = payload.category === "task"
            ? "upcoming"
            : payload.category === "borrowed" || payload.category === "lent"
                ? "pending"
                : "upcoming";

        await createReminder({
            userId: req.session.userId,
            ...payload,
            status: defaultStatus,
        });

        req.flash("success_msg", "Reminder added successfully");
        return res.redirect("/reminders");
    } catch (error) {
        console.error(error);
        req.flash("error_msg", "Failed to add reminder");
        return res.redirect("/reminders");
    }
}

async function updateReminder(req, res) {
    try {
        const [currentReminder, user, wallets] = await Promise.all([
            findUserReminderById(req.session.userId, req.params.id),
            findUserById(req.session.userId),
            getUserWallets(req.session.userId),
        ]);

        if (!currentReminder) {
            req.flash("error_msg", "Reminder not found");
            return res.redirect("/reminders");
        }

        const settings = buildDefaultUserSettings(user || {});
        const payload = normalizeReminderPayload(req.body, {
            wallet: settings.preferences.defaultWallet || currentReminder.wallet,
            reminderBefore: currentReminder.reminderBefore,
        });
        const validationError = validateReminderPayload(
            payload,
            wallets.map((wallet) => wallet.name)
        );

        if (validationError) {
            req.flash("error_msg", validationError);
            return res.redirect("/reminders");
        }

        const preservedStatus = isCompletionStatus(currentReminder)
            ? currentReminder.status
            : payload.category === "borrowed" || payload.category === "lent"
                ? "pending"
                : payload.category === "task"
                    ? "upcoming"
                    : "upcoming";

        await updateUserReminder(req.session.userId, req.params.id, {
            ...payload,
            status: preservedStatus,
        });

        req.flash("success_msg", "Reminder updated successfully");
        return res.redirect("/reminders");
    } catch (error) {
        console.error(error);
        req.flash("error_msg", "Failed to update reminder");
        return res.redirect("/reminders");
    }
}

async function removeReminder(req, res) {
    try {
        const result = await deleteUserReminder(req.session.userId, req.params.id);

        if (!result.deletedCount) {
            req.flash("error_msg", "Reminder not found");
            return res.redirect("/reminders");
        }

        req.flash("success_msg", "Reminder deleted successfully");
        return res.redirect("/reminders");
    } catch (error) {
        console.error(error);
        req.flash("error_msg", "Failed to delete reminder");
        return res.redirect("/reminders");
    }
}

async function markReminderPaid(req, res) {
    try {
        const reminder = await findUserReminderById(req.session.userId, req.params.id);

        if (!reminder || !["emi", "bill"].includes(reminder.category)) {
            req.flash("error_msg", "Reminder not found");
            return res.redirect("/reminders");
        }

        if (!reminder.wallet) {
            req.flash("error_msg", "This reminder needs a wallet before it can be marked paid");
            return res.redirect("/reminders");
        }

        await createExpenseFromReminder(req.session.userId, reminder);

        if (reminder.repeatType && reminder.repeatType !== "none") {
            const nextDueDate = nextRecurringDueDate(reminder.dueDate, reminder.repeatType);
            await updateUserReminder(req.session.userId, req.params.id, {
                ...reminder,
                dueDate: nextDueDate || reminder.dueDate,
                status: "upcoming",
            });
            req.flash("success_msg", "Reminder marked paid, expense added, and next due date scheduled");
            return res.redirect("/reminders");
        }

        await updateUserReminder(req.session.userId, req.params.id, {
            ...reminder,
            status: "paid",
        });

        req.flash("success_msg", "Reminder marked paid and added to expenses");
        return res.redirect("/reminders");
    } catch (error) {
        console.error(error);
        req.flash("error_msg", error.message || "Failed to mark reminder as paid");
        return res.redirect("/reminders");
    }
}

async function markReminderReturned(req, res) {
    try {
        const reminder = await findUserReminderById(req.session.userId, req.params.id);

        if (!reminder || reminder.category !== "borrowed") {
            req.flash("error_msg", "Reminder not found");
            return res.redirect("/reminders");
        }

        await updateUserReminder(req.session.userId, req.params.id, {
            ...reminder,
            status: "returned",
        });

        req.flash("success_msg", "Borrowed money marked as returned");
        return res.redirect("/reminders");
    } catch (error) {
        console.error(error);
        req.flash("error_msg", "Failed to update reminder");
        return res.redirect("/reminders");
    }
}

async function markReminderReceived(req, res) {
    try {
        const reminder = await findUserReminderById(req.session.userId, req.params.id);

        if (!reminder || reminder.category !== "lent") {
            req.flash("error_msg", "Reminder not found");
            return res.redirect("/reminders");
        }

        await updateUserReminder(req.session.userId, req.params.id, {
            ...reminder,
            status: "received",
        });

        req.flash("success_msg", "Lent money marked as received");
        return res.redirect("/reminders");
    } catch (error) {
        console.error(error);
        req.flash("error_msg", "Failed to update reminder");
        return res.redirect("/reminders");
    }
}

async function markReminderComplete(req, res) {
    try {
        const reminder = await findUserReminderById(req.session.userId, req.params.id);

        if (!reminder || reminder.category !== "task") {
            req.flash("error_msg", "Reminder not found");
            return res.redirect("/reminders");
        }

        await updateUserReminder(req.session.userId, req.params.id, {
            ...reminder,
            status: "completed",
        });

        req.flash("success_msg", "Task marked as completed");
        return res.redirect("/reminders");
    } catch (error) {
        console.error(error);
        req.flash("error_msg", "Failed to update reminder");
        return res.redirect("/reminders");
    }
}

module.exports = {
    showRemindersPage,
    addReminder,
    updateReminder,
    removeReminder,
    markReminderPaid,
    markReminderReturned,
    markReminderReceived,
    markReminderComplete,
};
