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

function compareDates(dateValue, todayKey) {
    const dateKey = formatInputDate(dateValue);

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

function isCompletedStatus(status) {
    return ["paid", "returned", "received", "completed"].includes(String(status || "").toLowerCase());
}

function categoryLabel(category) {
    return {
        emi: "EMI",
        bill: "Bill",
        borrowed: "Borrowed",
        lent: "Lent",
        task: "Task",
    }[String(category || "").toLowerCase()] || "Reminder";
}

function getReminderStatusMeta(reminder, todayKey = formatInputDate(new Date())) {
    const status = String(reminder.status || "").toLowerCase();
    const isCompleted = isCompletedStatus(status);
    const dueState = compareDates(reminder.dueDate, todayKey);

    if (status === "paid") {
        return { displayStatus: "Paid", lifecycleStatus: "completed", isCompleted: true };
    }

    if (status === "returned") {
        return { displayStatus: "Returned", lifecycleStatus: "completed", isCompleted: true };
    }

    if (status === "received") {
        return { displayStatus: "Received", lifecycleStatus: "completed", isCompleted: true };
    }

    if (status === "completed") {
        return { displayStatus: "Completed", lifecycleStatus: "completed", isCompleted: true };
    }

    if (reminder.category === "borrowed" || reminder.category === "lent") {
        return {
            displayStatus: "Pending",
            lifecycleStatus: dueState || "upcoming",
            isCompleted,
        };
    }

    if (reminder.category === "task") {
        return {
            displayStatus: "Upcoming",
            lifecycleStatus: dueState || "upcoming",
            isCompleted,
        };
    }

    return {
        displayStatus: dueState === "due-today"
            ? "Due Today"
            : dueState === "overdue"
                ? "Overdue"
                : "Upcoming",
        lifecycleStatus: dueState || "upcoming",
        isCompleted,
    };
}

function buildReminderSummary(reminders, todayKey = formatInputDate(new Date())) {
    return reminders.reduce((summary, reminder) => {
        const meta = getReminderStatusMeta(reminder, todayKey);

        if (!meta.isCompleted) {
            summary.totalActive += 1;
        }

        if (meta.lifecycleStatus === "due-today") {
            summary.dueToday += 1;
        }

        if (meta.lifecycleStatus === "overdue") {
            summary.overdue += 1;
        }

        if (!meta.isCompleted && ["emi", "bill", "borrowed"].includes(reminder.category)) {
            summary.moneyToPay += Number(reminder.amount || 0);
        }

        if (!meta.isCompleted && reminder.category === "lent") {
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

function buildReminderAlertItems(reminders, limit = 5, todayKey = formatInputDate(new Date())) {
    return reminders
        .map((reminder) => {
            const meta = getReminderStatusMeta(reminder, todayKey);
            const title = reminder.title || reminder.personName || "Untitled Reminder";
            const dueDate = reminder.dueDate
                ? new Date(reminder.dueDate).toLocaleDateString("en-GB", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                })
                : "No due date";

            return {
                id: String(reminder._id || ""),
                title,
                subtitle: `${categoryLabel(reminder.category)} • ${dueDate}`,
                amount: Number(reminder.amount || 0),
                dueDate,
                category: reminder.category,
                categoryLabel: categoryLabel(reminder.category),
                displayStatus: meta.displayStatus,
                lifecycleStatus: meta.lifecycleStatus,
                isCompleted: meta.isCompleted,
                accentClass: meta.lifecycleStatus === "overdue"
                    ? "danger"
                    : meta.lifecycleStatus === "due-today"
                        ? "warning"
                        : meta.isCompleted
                            ? "success"
                            : "primary",
                actionText: reminder.category === "task"
                    ? "Review task"
                    : reminder.category === "lent"
                        ? "Collect payment"
                        : reminder.category === "borrowed"
                            ? "Plan repayment"
                            : "Open reminder",
            };
        })
        .sort((a, b) => {
            const rank = { "overdue": 0, "due-today": 1, "upcoming": 2, "completed": 3 };
            return (rank[a.lifecycleStatus] ?? 4) - (rank[b.lifecycleStatus] ?? 4);
        })
        .slice(0, limit);
}

module.exports = {
    formatInputDate,
    categoryLabel,
    getReminderStatusMeta,
    buildReminderSummary,
    buildReminderAlertItems,
};
