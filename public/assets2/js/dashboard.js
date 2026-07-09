window.addEventListener("load", function () {
    if (typeof ApexCharts === "undefined") {
        return;
    }

    const chartDataEl = document.querySelector("#dashboard-chart-data");
    if (!chartDataEl) {
        return;
    }

    const chartData = JSON.parse(chartDataEl.textContent);
    const borderColor = "#e9ecef";
    const textMuted = "#6c757d";

    const budgetLeftChartEl = document.querySelector("#retained-chart");
    if (budgetLeftChartEl) {
        new ApexCharts(budgetLeftChartEl, {
            chart: { type: "line", height: 72, sparkline: { enabled: true }, toolbar: { show: false } },
            series: [{ data: chartData.monthBudgetLeftTrend }],
            colors: ["#22c55e"],
            stroke: { width: 3, curve: "smooth" },
            markers: { size: 0 },
            tooltip: { enabled: false }
        }).render();
    }

    const budgetUsedChartEl = document.querySelector("#churned-chart");
    if (budgetUsedChartEl) {
        new ApexCharts(budgetUsedChartEl, {
            chart: { type: "line", height: 72, sparkline: { enabled: true }, toolbar: { show: false } },
            series: [{ data: chartData.monthBudgetUseTrend }],
            colors: ["#ef4444"],
            stroke: { width: 3, curve: "smooth" },
            markers: { size: 0 },
            tooltip: { enabled: false }
        }).render();
    }

    const miniCharts = [
        { selector: "#income-mini-chart", data: chartData.monthIncome, color: "#198754" },
        { selector: "#expense-mini-chart", data: chartData.monthExpense, color: "#dc3545" },
        { selector: "#balance-mini-chart", data: chartData.monthBalance, color: "#0d6efd" },
        { selector: "#savings-mini-chart", data: chartData.monthSavingsRate, color: "#ffc107" }
    ];

    miniCharts.forEach((item) => {
        const element = document.querySelector(item.selector);
        if (!element) {
            return;
        }

        new ApexCharts(element, {
            chart: {
                type: "area",
                height: 60,
                sparkline: { enabled: true }
            },
            series: [{ data: item.data }],
            colors: [item.color],
            stroke: { curve: "smooth", width: 2.5 },
            fill: {
                type: "gradient",
                gradient: {
                    shadeIntensity: 0.25,
                    opacityFrom: 0.35,
                    opacityTo: 0.05
                }
            },
            tooltip: { enabled: false }
        }).render();
    });

    const cashFlowEl = document.querySelector("#revenue-chart2");
    if (cashFlowEl) {
        new ApexCharts(cashFlowEl, {
            chart: { type: "bar", height: 300, stacked: true, toolbar: { show: false } },
            series: [
                { name: "Spent", data: chartData.monthExpense },
                { name: "Capacity", data: chartData.monthCapacityRemainder }
            ],
            colors: ["#f43f5e", "#e5e7eb"],
            dataLabels: { enabled: false },
            plotOptions: {
                bar: {
                    columnWidth: "70%",
                    borderRadius: 8,
                    borderRadiusApplication: "end"
                }
            },
            stroke: { width: 0 },
            xaxis: {
                categories: chartData.monthLabels,
                labels: { style: { colors: textMuted } },
                axisBorder: { color: borderColor },
                axisTicks: { color: borderColor }
            },
            yaxis: {
                labels: {
                    style: { colors: textMuted },
                    formatter: (value) => "Rs. " + Number(value || 0).toLocaleString("en-IN")
                }
            },
            grid: { borderColor },
            legend: { show: false }
        }).render();
    }

    const categoryEl = document.querySelector("#region-wise-growth");
    if (categoryEl) {
        new ApexCharts(categoryEl, {
            chart: { type: "donut", height: 300 },
            labels: chartData.categoryLabels,
            series: chartData.categoryValues,
            colors: ["#5b6ee1", "#61c28b", "#fbad42", "#31b0c8", "#8a6fd9", "#f43f5e", "#22c55e"],
            dataLabels: { enabled: false },
            legend: { position: "bottom" },
            plotOptions: {
                pie: {
                    donut: {
                        size: "64%",
                        labels: {
                            show: true,
                            total: {
                                show: true,
                                label: "Total",
                                formatter: () => chartData.categoryTotalLabel
                            }
                        }
                    }
                }
            }
        }).render();
    }

    const trendEl = document.querySelector("#growth-trend");
    if (trendEl) {
        new ApexCharts(trendEl, {
            chart: { height: 320, type: "line", toolbar: { show: false } },
            series: [
                { name: "Income", data: chartData.monthIncome },
                { name: "Expense", data: chartData.monthExpense },
                { name: "Balance", data: chartData.monthBalance }
            ],
            colors: ["#22c55e", "#f43f5e", "#6366f1"],
            stroke: { width: 3, curve: "smooth" },
            dataLabels: { enabled: false },
            fill: {
                type: "gradient",
                gradient: {
                    shadeIntensity: 0.2,
                    opacityFrom: 0.25,
                    opacityTo: 0.02
                }
            },
            xaxis: {
                categories: chartData.monthLabels,
                labels: { style: { colors: textMuted } },
                axisBorder: { color: borderColor },
                axisTicks: { color: borderColor }
            },
            yaxis: {
                labels: {
                    style: { colors: textMuted },
                    formatter: (value) => "Rs. " + Number(value || 0).toLocaleString("en-IN")
                }
            },
            grid: { borderColor },
            legend: { position: "top" }
        }).render();
    }

    const walletOverviewEl = document.querySelector("#wallet-balance-overview");
    if (walletOverviewEl) {
        new ApexCharts(walletOverviewEl, {
            chart: { type: "bar", height: 320, toolbar: { show: false } },
            series: [
                { name: "Balance", data: chartData.walletValues }
            ],
            colors: ["#6366f1"],
            plotOptions: {
                bar: {
                    horizontal: true,
                    borderRadius: 6,
                    barHeight: "52%"
                }
            },
            dataLabels: { enabled: false },
            xaxis: {
                categories: chartData.walletLabels,
                labels: {
                    style: { colors: textMuted },
                    formatter: (value) => "Rs. " + Number(value || 0).toLocaleString("en-IN")
                },
                axisBorder: { color: borderColor },
                axisTicks: { color: borderColor }
            },
            yaxis: {
                labels: { style: { colors: textMuted } }
            },
            tooltip: {
                y: {
                    formatter: (value) => "Rs. " + Number(value || 0).toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                    })
                }
            },
            grid: { borderColor },
            legend: { show: false }
        }).render();
    }
});
