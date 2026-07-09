window.addEventListener("load", function () {
    const hasJQuery = typeof window.jQuery !== "undefined";
    const hasSelect2 = hasJQuery && typeof window.jQuery.fn.select2 === "function";

    if (hasSelect2) {
        document.querySelectorAll("[data-budget-category-select]").forEach((select) => {
            const $select = window.jQuery(select);
            const dropdownParent = select.closest(".modal, .offcanvas, .card, .content") || document.body;
            $select.select2({
                width: "100%",
                minimumResultsForSearch: Infinity,
                dropdownParent: window.jQuery(dropdownParent),
                dropdownCssClass: "budget-category-select2-dropdown",
                containerCssClass: "budget-category-select2"
            });
        });
    }

    if (typeof ApexCharts === "undefined") {
        return;
    }

    const chartDataEl = document.querySelector("#budget-chart-data");
    const chartEl = document.querySelector("#budget-history-chart");
    if (!chartDataEl || !chartEl) {
        return;
    }

    const chartData = JSON.parse(chartDataEl.textContent || "{}");

    new ApexCharts(chartEl, {
        chart: {
            type: "bar",
            height: 320,
            toolbar: { show: false }
        },
        series: [
            { name: "Budget", data: chartData.labels ? chartData.budgetValues || [] : [] },
            { name: "Spent", data: chartData.labels ? chartData.spentValues || [] : [] }
        ],
        colors: ["#0d6efd", "#dc3545"],
        plotOptions: {
            bar: {
                horizontal: false,
                borderRadius: 6,
                columnWidth: "48%"
            }
        },
        dataLabels: { enabled: false },
        stroke: { show: false },
        xaxis: {
            categories: chartData.labels || [],
        },
        yaxis: {
            labels: {
                formatter: (value) => "Rs. " + Number(value || 0).toLocaleString("en-IN")
            }
        },
        grid: {
            borderColor: "#e9ecef"
        },
        legend: {
            position: "top"
        }
    }).render();
});
