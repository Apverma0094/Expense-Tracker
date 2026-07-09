(function () {
    const eventsEl = document.querySelector("#calendar-events-data");
    if (!eventsEl) {
        return;
    }

    const eventsByDate = JSON.parse(eventsEl.textContent || "{}");
    const selectedDateLabel = document.querySelector("#selected-date-label");
    const selectedDateCount = document.querySelector("#selected-date-count");
    const selectedDayEvents = document.querySelector("#selected-day-events");
    const dateButtons = document.querySelectorAll("[data-calendar-date]");

    function formatAmount(amount) {
        return "Rs. " + Number(amount || 0).toLocaleString("en-IN", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }

    function formatDateLabel(dateKey) {
        const date = new Date(dateKey + "T12:00:00");
        if (Number.isNaN(date.getTime())) {
            return "No scheduled reminders";
        }

        return date.toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "long",
            year: "numeric"
        });
    }

    function renderEvents(dateKey) {
        const events = eventsByDate[dateKey] || [];

        dateButtons.forEach((button) => {
            button.classList.toggle("active-date", button.getAttribute("data-calendar-date") === dateKey);
        });

        if (selectedDateLabel) {
            selectedDateLabel.textContent = dateKey ? formatDateLabel(dateKey) : "No scheduled reminders";
        }

        if (selectedDateCount) {
            selectedDateCount.textContent = `${events.length} items`;
        }

        if (!selectedDayEvents) {
            return;
        }

        if (!events.length) {
            selectedDayEvents.innerHTML = '<div class="event-item text-center text-muted">No reminders on this date yet.</div>';
            return;
        }

        selectedDayEvents.innerHTML = events.map((event) => `
            <div class="event-item">
                <div class="d-flex align-items-start justify-content-between gap-2 mb-2">
                    <div>
                        <h6 class="mb-1">${event.title}</h6>
                        <div class="text-muted fs-13">${event.categoryLabel}</div>
                    </div>
                    <span class="calendar-dot dot-${event.colorKey} mt-1"></span>
                </div>
                <div class="d-flex align-items-center justify-content-between gap-2 flex-wrap">
                    <span class="badge bg-light text-dark">${event.displayStatus}</span>
                    ${Number(event.amount || 0) > 0 ? `<strong>${formatAmount(event.amount)}</strong>` : ""}
                </div>
            </div>
        `).join("");
    }

    dateButtons.forEach((button) => {
        button.addEventListener("click", () => {
            renderEvents(button.getAttribute("data-calendar-date"));
        });
    });
}());
