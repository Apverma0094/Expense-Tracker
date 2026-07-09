function formatAmount(amount, currency = "INR") {
    const normalizedCurrency = String(currency || "INR").trim().toUpperCase();
    const symbol = normalizedCurrency === "INR" ? "Rs. " : `${normalizedCurrency} `;

    return symbol + Number(amount || 0).toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

function formatDate(dateValue) {
    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
        return "-";
    }

    return date.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
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

function formatDownloadName(transaction) {
    const title = String(transaction.title || "bill")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "bill";
    const extensionMap = {
        "image/jpeg": "jpg",
        "image/jpg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
        "image/gif": "gif",
    };
    const extension = extensionMap[String(transaction.billImageMime || "").toLowerCase()] || "jpg";

    return `${title}-bill.${extension}`;
}

function typeBadgeClass(type) {
    return type === "income"
        ? "bg-success-subtle text-success"
        : "bg-danger-subtle text-danger";
}

function typeLabel(type) {
    return type === "income"
        ? "Income"
        : "Expense";
}

function budgetStatusBadgeClass(status) {
    if (status === "Over Budget" || status === "Over") {
        return "bg-danger-subtle text-danger";
    }

    if (status === "At Risk" || status === "Near Limit") {
        return "bg-warning-subtle text-warning";
    }

    if (status === "On Track") {
        return "bg-success-subtle text-success";
    }

    return "bg-light text-dark";
}

module.exports = {
    formatAmount,
    formatDate,
    formatInputDate,
    formatDownloadName,
    typeBadgeClass,
    typeLabel,
    budgetStatusBadgeClass,
};
