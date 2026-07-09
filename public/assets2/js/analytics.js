(function () {
    const hasApex = typeof ApexCharts !== "undefined";
    if (!hasApex) {
        return;
    }

    const chartDataEl = document.querySelector("#analytics-chart-data");
    if (!chartDataEl) {
        return;
    }

    const chartData = JSON.parse(chartDataEl.textContent || "{}");
    const textMuted = "#6c757d";
    const borderColor = "#e9ecef";

    const monthlyChartEl = document.querySelector("#monthly-overview-chart");
    if (monthlyChartEl) {
        new ApexCharts(monthlyChartEl, {
            chart: {
                type: "line",
                height: 320,
                toolbar: { show: false }
            },
            series: [
                { name: "Income", type: "column", data: chartData.monthIncome || [] },
                { name: "Expense", type: "column", data: chartData.monthExpense || [] },
                { name: "Balance", type: "line", data: chartData.monthBalance || [] }
            ],
            colors: ["#198754", "#dc3545", "#0d6efd"],
            plotOptions: {
                bar: {
                    columnWidth: "42%",
                    borderRadius: 4
                }
            },
            stroke: {
                width: [0, 0, 3],
                curve: "smooth"
            },
            dataLabels: { enabled: false },
            xaxis: {
                categories: chartData.monthLabels || [],
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

    const categoryChartEl = document.querySelector("#category-spend-chart");
    if (categoryChartEl) {
        new ApexCharts(categoryChartEl, {
            chart: {
                type: "bar",
                height: 320
            },
            series: [
                { name: "Spent", data: chartData.categoryValues || [0] }
            ],
            colors: ["#dc3545", "#fd7e14", "#ffc107", "#20c997", "#0dcaf0", "#6f42c1", "#198754"],
            plotOptions: {
                bar: {
                    horizontal: true,
                    borderRadius: 6,
                    barHeight: "55%",
                    distributed: true
                }
            },
            dataLabels: { enabled: false },
            xaxis: {
                categories: chartData.categoryLabels || ["No Data"],
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
            legend: { show: false },
            grid: { borderColor },
            tooltip: {
                y: {
                    formatter: (value) => "Rs. " + Number(value || 0).toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                    })
                }
            }
        }).render();
    }

    const incomeExpenseSplitChartEl = document.querySelector("#income-expense-split-chart");
    if (incomeExpenseSplitChartEl) {
        new ApexCharts(incomeExpenseSplitChartEl, {
            chart: {
                type: "pie",
                height: 320
            },
            labels: chartData.incomeExpenseSplitLabels || [],
            series: chartData.incomeExpenseSplit || [1, 1],
            colors: ["#198754", "#dc3545"],
            dataLabels: { enabled: true },
            legend: { position: "bottom" },
            tooltip: {
                y: {
                    formatter: (value) => "Rs. " + Number(value || 0).toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                    })
                }
            }
        }).render();
    }

    const transactionVolumeChartEl = document.querySelector("#transaction-volume-chart");
    if (transactionVolumeChartEl) {
        new ApexCharts(transactionVolumeChartEl, {
            chart: {
                type: "area",
                height: 320,
                toolbar: { show: false }
            },
            series: [
                { name: "Transactions", data: chartData.monthlyTransactionSeries || [] }
            ],
            colors: ["#0d6efd"],
            dataLabels: { enabled: false },
            stroke: { curve: "smooth", width: 3 },
            fill: {
                type: "gradient",
                gradient: {
                    shadeIntensity: 0.4,
                    opacityFrom: 0.35,
                    opacityTo: 0.05
                }
            },
            xaxis: {
                categories: chartData.monthLabels || [],
                labels: { style: { colors: textMuted } },
                axisBorder: { color: borderColor },
                axisTicks: { color: borderColor }
            },
            yaxis: {
                min: 0,
                forceNiceScale: true,
                labels: {
                    style: { colors: textMuted },
                    formatter: (value) => Math.round(Number(value || 0))
                }
            },
            grid: { borderColor },
            legend: { position: "top" }
        }).render();
    }

    const topExpenseMonthsChartEl = document.querySelector("#top-expense-months-chart");
    if (topExpenseMonthsChartEl) {
        new ApexCharts(topExpenseMonthsChartEl, {
            chart: {
                type: "bar",
                height: 320,
                toolbar: { show: false }
            },
            series: [
                { name: "Expense", data: chartData.topExpenseMonthValues || [0] }
            ],
            colors: ["#f97316"],
            plotOptions: {
                bar: {
                    borderRadius: 6,
                    columnWidth: "55%"
                }
            },
            dataLabels: { enabled: false },
            xaxis: {
                categories: chartData.topExpenseMonthLabels || ["No Data"],
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

    const walletChartEl = document.querySelector("#wallet-balance-chart");
    if (walletChartEl) {
        new ApexCharts(walletChartEl, {
            chart: {
                type: "donut",
                height: 320
            },
            labels: chartData.walletLabels || ["No Wallets"],
            series: chartData.walletValues || [1],
            colors: ["#0d6efd", "#198754", "#fd7e14", "#6f42c1", "#0dcaf0"],
            dataLabels: { enabled: false },
            legend: { position: "bottom" },
            tooltip: {
                y: {
                    formatter: (value) => "Rs. " + Number(value || 0).toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                    })
                }
            }
        }).render();
    }
}());
