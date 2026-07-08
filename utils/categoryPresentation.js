const CATEGORY_ICON_OPTIONS = [
    { value: "food", label: "Food", emoji: "🍔", bgColor: "#fff3cd", textColor: "#d97706" },
    { value: "travel", label: "Travel", emoji: "✈️", bgColor: "#dbeafe", textColor: "#2563eb" },
    { value: "shopping", label: "Shopping", emoji: "🛍️", bgColor: "#fce7f3", textColor: "#db2777" },
    { value: "salary", label: "Salary", emoji: "💰", bgColor: "#dcfce7", textColor: "#16a34a" },
    { value: "freelance", label: "Freelance", emoji: "💻", bgColor: "#e0e7ff", textColor: "#4f46e5" },
    { value: "bills", label: "Bills", emoji: "🧾", bgColor: "#fee2e2", textColor: "#dc2626" },
    { value: "rent", label: "Rent", emoji: "🏠", bgColor: "#ede9fe", textColor: "#7c3aed" },
    { value: "health", label: "Health", emoji: "🏥", bgColor: "#ffe4e6", textColor: "#e11d48" },
    { value: "entertainment", label: "Entertainment", emoji: "🎬", bgColor: "#f3e8ff", textColor: "#9333ea" },
    { value: "education", label: "Education", emoji: "📚", bgColor: "#cffafe", textColor: "#0891b2" },
    { value: "investment", label: "Investment", emoji: "📈", bgColor: "#dcfce7", textColor: "#15803d" },
    { value: "gift", label: "Gift", emoji: "🎁", bgColor: "#fae8ff", textColor: "#c026d3" },
    { value: "transport", label: "Transport", emoji: "🚕", bgColor: "#fef3c7", textColor: "#ca8a04" },
    { value: "utilities", label: "Utilities", emoji: "💡", bgColor: "#fef9c3", textColor: "#a16207" },
    { value: "bonus", label: "Bonus", emoji: "🏆", bgColor: "#d1fae5", textColor: "#059669" },
];

function getCategoryVisual(icon, type) {
    const matched = CATEGORY_ICON_OPTIONS.find((item) => item.value === icon);
    if (matched) {
        return matched;
    }

    return {
        value: icon || "default",
        label: "General",
        emoji: type === "income" ? "💸" : "📦",
        bgColor: type === "income" ? "#dcfce7" : "#fee2e2",
        textColor: type === "income" ? "#16a34a" : "#dc2626",
    };
}

function buildCategoryOptionLabel(category) {
    const visual = getCategoryVisual(category.icon, category.type);
    return `${visual.emoji} ${category.name}`;
}

module.exports = {
    CATEGORY_ICON_OPTIONS,
    getCategoryVisual,
    buildCategoryOptionLabel,
};
