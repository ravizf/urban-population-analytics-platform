const chartState = {
    topChart: null,
    compareChart: null,
    cityDetailChart: null,
    countryChart: null,
    worldPopulationChart: null,
    forecastChart: null,
    projectionCompareChart: null,
};

const chartSelectionState = {
    topChart: null,
    compareChart: null,
    cityDetailChart: null,
    countryChart: null,
    worldPopulationChart: null,
    forecastChart: null,
    projectionCompareChart: null,
};

let cachedCities = [];
let latestSnapshotRows = [];
let latestCitySummary = "";
let searchAbortController;

const numberFormatter = new Intl.NumberFormat();
const DARK_MODE_KEY = "urban-platform-dark-mode";

Chart.defaults.font.family = "\"Inter\", sans-serif";
Chart.defaults.color = "#5d6a75";
Chart.defaults.plugins.legend.labels.boxWidth = 14;
Chart.defaults.plugins.legend.labels.usePointStyle = true;
Chart.defaults.animation.duration = 950;
Chart.defaults.animation.easing = "easeOutQuart";
Chart.defaults.plugins.tooltip.backgroundColor = "rgba(31, 42, 53, 0.92)";
Chart.defaults.plugins.tooltip.titleColor = "#ffffff";
Chart.defaults.plugins.tooltip.bodyColor = "#edf2f7";
Chart.defaults.plugins.tooltip.padding = 12;
Chart.defaults.plugins.tooltip.cornerRadius = 12;
Chart.defaults.plugins.tooltip.displayColors = false;

function formatNumber(value) {
    return numberFormatter.format(value);
}

function getThemeColors() {
    if (document.body.classList.contains("dark-mode")) {
        return {
            text: "#edf2f7",
            muted: "#9daaba",
            grid: "rgba(237, 242, 247, 0.12)",
            primary: "#cf6254",
            primaryDeep: "#a64639",
            secondary: "#78b395",
            secondaryDeep: "#4e8167",
            fillPrimary: "rgba(207, 98, 84, 0.18)",
            fillSecondary: "rgba(120, 179, 149, 0.18)",
        };
    }

    return {
        text: "#25313f",
        muted: "#5f6b78",
        grid: "rgba(37, 49, 63, 0.08)",
        primary: "#b85042",
        primaryDeep: "#7f2f23",
        secondary: "#2f6f62",
        secondaryDeep: "#244f47",
        fillPrimary: "rgba(184, 80, 66, 0.16)",
        fillSecondary: "rgba(47, 111, 98, 0.16)",
    };
}

function createGradient(ctx, colorA, colorB) {
    const gradient = ctx.createLinearGradient(0, 0, 0, 320);
    gradient.addColorStop(0, colorA);
    gradient.addColorStop(1, colorB);
    return gradient;
}

function buildBarColors(length, baseColor, activeColor, activeIndex) {
    return Array.from({ length }, (_, index) =>
        index === activeIndex ? activeColor : baseColor
    );
}

function getPanelNode(elementId) {
    const element = document.getElementById(elementId);
    return element ? element.closest(".panel") : null;
}

function setPanelBusy(elementId, isBusy) {
    const panel = getPanelNode(elementId);
    if (!panel) {
        return;
    }

    panel.querySelectorAll("button, select, input").forEach((node) => {
        node.disabled = isBusy;
    });
}

function setLoadingState(id, message) {
    const node = document.getElementById(id);
    if (!node) {
        return;
    }

    node.innerHTML = `<span class="spinner"></span><span>${message}</span>`;
    node.classList.add("is-visible");
    node.classList.remove("is-error");
}

function clearLoadingState(id) {
    const node = document.getElementById(id);
    if (!node) {
        return;
    }

    node.innerHTML = "";
    node.classList.remove("is-visible", "is-error");
}

function showStatusState(id, message, isError = false) {
    const node = document.getElementById(id);
    if (!node) {
        return;
    }

    node.textContent = message;
    node.classList.add("is-visible");
    node.classList.toggle("is-error", isError);
}

function setValidationMessage(id, message = "") {
    const node = document.getElementById(id);
    if (!node) {
        return;
    }

    node.textContent = message;
    node.classList.toggle("is-hidden", !message);
}

function setResultCard(id, message, variant = "") {
    const node = document.getElementById(id);
    if (!node) {
        return;
    }

    const compact = node.classList.contains("compact-card") ? " compact-card" : "";
    node.className = `result-card${compact}`;
    if (variant) {
        node.classList.add(variant);
    }
    node.innerHTML = message;
}

function setListState(id, message, variant = "empty") {
    const node = document.getElementById(id);
    if (!node) {
        return;
    }

    node.innerHTML = `<li class="list-state ${variant === "error" ? "is-error" : ""}">${message}</li>`;
}

function setTableState(id, colspan, message, variant = "empty") {
    const node = document.getElementById(id);
    if (!node) {
        return;
    }

    node.innerHTML = `<tr><td class="table-state ${variant === "error" ? "is-error" : ""}" colspan="${colspan}">${message}</td></tr>`;
}

function downloadChartPng(chartKey, filename) {
    const chart = chartState[chartKey];
    if (!chart) {
        return;
    }

    const anchor = document.createElement("a");
    anchor.href = chart.toBase64Image("image/png", 1);
    anchor.download = filename;
    anchor.click();
}

function downloadTextFile(filename, content, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
}

function animateCounters() {
    document.querySelectorAll(".counter").forEach((counter) => {
        const target = Number(counter.dataset.target || 0);
        const duration = 1400;
        const startedAt = performance.now();

        function render(now) {
            const progress = Math.min((now - startedAt) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            counter.textContent = formatNumber(Math.round(target * eased));
            if (progress < 1) {
                requestAnimationFrame(render);
            }
        }

        requestAnimationFrame(render);
    });
}

function initRevealAnimations() {
    const panels = document.querySelectorAll(".reveal-panel");
    if (!("IntersectionObserver" in window)) {
        panels.forEach((panel) => panel.classList.add("is-visible"));
        return;
    }

    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                entry.target.classList.add("is-visible");
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.16 });

    panels.forEach((panel, index) => {
        panel.style.setProperty("--reveal-delay", `${Math.min(index * 60, 320)}ms`);
        observer.observe(panel);
    });
}

function updateClock() {
    const now = new Date();
    const clockNode = document.getElementById("liveClock");
    const dateNode = document.getElementById("liveDate");

    if (clockNode) {
        clockNode.textContent = now.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
        });
    }

    if (dateNode) {
        dateNode.textContent = now.toLocaleDateString([], {
            weekday: "short",
            month: "short",
            day: "numeric",
            year: "numeric",
        });
    }
}

function applySavedTheme() {
    if (localStorage.getItem(DARK_MODE_KEY) === "true") {
        document.body.classList.add("dark-mode");
    }
}

function populateSelectOptions(selectId, values) {
    const select = document.getElementById(selectId);
    if (!select) {
        return;
    }

    const currentValue = select.value;
    select.innerHTML = values
        .map((value) => `<option value="${value}">${value}</option>`)
        .join("");

    if (values.includes(currentValue)) {
        select.value = currentValue;
    } else if (values.length) {
        select.value = values[0];
    }
}

async function postJson(url, payload) {
    const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || "Request failed");
    }

    return data;
}

function buildChart(target, config, chartKey) {
    if (chartState[chartKey]) {
        chartState[chartKey].destroy();
    }

    const ctx = document.getElementById(target).getContext("2d");
    chartState[chartKey] = new Chart(ctx, config);
}

function createBaseChartOptions(chartKey, mode = "index", showLegend = true) {
    const colors = getThemeColors();
    return {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode, intersect: false },
        animation: {
            duration: 950,
            easing: "easeOutQuart",
        },
        plugins: {
            legend: {
                display: showLegend,
                labels: {
                    usePointStyle: true,
                    padding: 18,
                    color: colors.muted,
                },
            },
            tooltip: {
                callbacks: {
                    label(context) {
                        const label = context.dataset.label || "";
                        const value = context.parsed.y ?? context.parsed;
                        return `${label}: ${formatNumber(value)}`;
                    },
                },
            },
        },
        onClick(event, elements, chart) {
            chartSelectionState[chartKey] = elements.length ? elements[0].index : null;
            chart.update();
        },
        onHover(event, elements, chart) {
            chart.canvas.style.cursor = elements.length ? "pointer" : "default";
        },
        scales: {
            x: {
                grid: { display: false },
                ticks: { color: colors.muted },
            },
            y: {
                beginAtZero: true,
                ticks: {
                    color: colors.muted,
                    callback(value) {
                        return formatNumber(value);
                    },
                },
                grid: {
                    color: colors.grid,
                },
            },
        },
    };
}

function createLineDataset({
    label,
    data,
    borderColor,
    pointColor,
    backgroundColor = null,
    fill = false,
    chartKey,
    borderDash = [],
    tension = 0.25,
}) {
    const activeIndex = chartSelectionState[chartKey];
    return {
        label,
        data,
        borderColor,
        backgroundColor,
        fill,
        borderDash,
        tension,
        pointRadius: data.map((_, index) => index === activeIndex ? 6 : 2.5),
        pointHoverRadius: 7,
        pointBackgroundColor: pointColor,
        spanGaps: true,
    };
}

function rerenderDashboardCharts() {
    getTop10();
    compareCities();
    loadCityDetails();
    loadCountryInsights();
    loadRealPopulationTrend();
    loadPopulationForecast();
    loadProjectedComparison();
}

function toggleDarkMode() {
    document.body.classList.toggle("dark-mode");
    localStorage.setItem(DARK_MODE_KEY, document.body.classList.contains("dark-mode"));
    rerenderDashboardCharts();
}

function replaceSelectOptions(selectId, cities) {
    const select = document.getElementById(selectId);
    const currentValue = select.value;
    select.innerHTML = "";

    cities.forEach((city) => {
        const option = document.createElement("option");
        option.value = city;
        option.textContent = city;
        select.appendChild(option);
    });

    if (cities.includes(currentValue)) {
        select.value = currentValue;
    } else if (cities.length) {
        select.value = cities[0];
    }
}

function validateCompareInputs() {
    const city1 = document.getElementById("city1").value;
    const city2 = document.getElementById("city2").value;

    if (!city1 || !city2) {
        return "Select two cities to compare.";
    }
    if (city1 === city2) {
        return "Choose two different cities for comparison.";
    }
    return "";
}

function validateGrowthInputs() {
    const city = document.getElementById("growthCity").value;
    const startYear = Number(document.getElementById("startYear").value);
    const endYear = Number(document.getElementById("endYear").value);

    if (!city) {
        return "Select a city to calculate growth.";
    }
    if (!startYear || !endYear) {
        return "Select both years to calculate growth.";
    }
    if (endYear <= startYear) {
        return "End year must be later than start year.";
    }
    return "";
}

function validateForecastInputs() {
    const name = document.getElementById("forecastName").value;
    const yearsAhead = Number(document.getElementById("forecastYearsAhead").value);

    if (!name) {
        return "Select a city or country before building a forecast.";
    }
    if (yearsAhead < 2) {
        return "Choose at least 2 future years for a useful forecast.";
    }
    return "";
}

function validateProjectionInputs() {
    const firstName = document.getElementById("projectionFirst").value;
    const secondName = document.getElementById("projectionSecond").value;

    if (!firstName || !secondName) {
        return "Select two items to compare.";
    }
    if (firstName === secondName) {
        return "Choose two different items for projection comparison.";
    }
    return "";
}

async function getTop10() {
    setPanelBusy("yearSelect", true);
    setLoadingState("top10Loading", "Building ranking chart...");

    try {
        const year = document.getElementById("yearSelect").value;
        const chartType = document.getElementById("top10ChartType").value;
        const data = await postJson("/get_top10", { year });
        const colors = getThemeColors();
        const ctx = document.getElementById("top10Chart").getContext("2d");
        const activeIndex = chartSelectionState.topChart;
        const barGradient = createGradient(ctx, colors.primary, colors.primaryDeep);
        const lineGradient = createGradient(ctx, colors.fillPrimary, "rgba(255,255,255,0.02)");

        buildChart(
            "top10Chart",
            {
                type: chartType,
                data: {
                    labels: data.labels,
                    datasets: [{
                        label: `Population in ${data.year}`,
                        data: data.populations,
                        backgroundColor: chartType === "line"
                            ? lineGradient
                            : buildBarColors(data.populations.length, barGradient, colors.secondary, activeIndex),
                        borderColor: colors.primaryDeep,
                        borderWidth: 2,
                        borderRadius: 10,
                        tension: 0.28,
                        fill: chartType === "line",
                        pointRadius: chartType === "line"
                            ? data.populations.map((_, index) => index === activeIndex ? 6 : 3)
                            : 0,
                        pointHoverRadius: chartType === "line" ? 7 : 0,
                    }],
                },
                options: createBaseChartOptions("topChart", "nearest", false),
            },
            "topChart"
        );
        clearLoadingState("top10Loading");
    } catch (error) {
        showStatusState("top10Loading", error.message || "Unable to load the ranking chart right now.", true);
    } finally {
        setPanelBusy("yearSelect", false);
    }
}

async function compareCities() {
    const validationMessage = validateCompareInputs();
    setValidationMessage("compareValidation", validationMessage);

    if (validationMessage) {
        setResultCard("compareSummary", validationMessage, "is-empty");
        return;
    }

    setPanelBusy("city1", true);
    setLoadingState("compareLoading", "Comparing city timelines...");

    try {
        const city1 = document.getElementById("city1").value;
        const city2 = document.getElementById("city2").value;
        const data = await postJson("/compare", { city1, city2 });
        const latestIndex = data.years.length - 1;
        const latestYear = data.years[latestIndex];
        const diff = data.city1_pop[latestIndex] - data.city2_pop[latestIndex];
        const leader = diff >= 0 ? city1 : city2;
        const gap = Math.abs(diff);
        const colors = getThemeColors();
        const ctx = document.getElementById("compareChart").getContext("2d");
        const firstGradient = createGradient(ctx, colors.fillPrimary, "rgba(255,255,255,0.02)");
        const secondGradient = createGradient(ctx, colors.fillSecondary, "rgba(255,255,255,0.02)");

        setResultCard(
            "compareSummary",
            `In <strong>${latestYear}</strong>, <strong>${leader}</strong> leads by <strong>${formatNumber(gap)}</strong> people across the latest overlapping historical year.`
        );

        buildChart(
            "compareChart",
            {
                type: "line",
                data: {
                    labels: data.years,
                    datasets: [
                        createLineDataset({
                            label: city1,
                            data: data.city1_pop,
                            borderColor: colors.primary,
                            pointColor: colors.primary,
                            backgroundColor: firstGradient,
                            fill: true,
                            chartKey: "compareChart",
                            tension: 0.3,
                        }),
                        createLineDataset({
                            label: city2,
                            data: data.city2_pop,
                            borderColor: colors.secondary,
                            pointColor: colors.secondary,
                            backgroundColor: secondGradient,
                            fill: true,
                            chartKey: "compareChart",
                            tension: 0.3,
                        }),
                    ],
                },
                options: createBaseChartOptions("compareChart", "index", true),
            },
            "compareChart"
        );
        clearLoadingState("compareLoading");
    } catch (error) {
        showStatusState("compareLoading", error.message || "Unable to compare those cities right now.", true);
        setResultCard("compareSummary", error.message, "is-error");
    } finally {
        setPanelBusy("city1", false);
    }
}

function swapComparedCities() {
    const city1 = document.getElementById("city1");
    const city2 = document.getElementById("city2");
    const previous = city1.value;
    city1.value = city2.value;
    city2.value = previous;
    compareCities();
}

async function calculateGrowth() {
    const validationMessage = validateGrowthInputs();
    setValidationMessage("growthValidation", validationMessage);

    if (validationMessage) {
        setResultCard("growthResult", validationMessage, "is-empty");
        return;
    }

    setPanelBusy("growthCity", true);

    try {
        const city = document.getElementById("growthCity").value;
        const start = document.getElementById("startYear").value;
        const end = document.getElementById("endYear").value;
        const data = await postJson("/growth", { city, start, end });

        setResultCard(
            "growthResult",
            `<strong>${city}</strong> changed from ${formatNumber(data.start_pop)} in ${start}
            to ${formatNumber(data.end_pop)} in ${end}. Growth rate: <strong>${data.growth_rate}%</strong>.
            Absolute increase: <strong>${formatNumber(data.population_change)}</strong>.`
        );
    } catch (error) {
        setResultCard("growthResult", error.message, "is-error");
    } finally {
        setPanelBusy("growthCity", false);
    }
}

async function filterByCountry() {
    setValidationMessage("compareValidation", "");

    try {
        const country = document.getElementById("countrySelect").value;
        const cities = await postJson("/get_cities_by_country", { country });
        cachedCities = cities;
        replaceSelectOptions("city1", cities);
        replaceSelectOptions("city2", cities);
        replaceSelectOptions("growthCity", cities);
        replaceSelectOptions("detailCity", cities);
        filterCityOptions();
    } catch (error) {
        setValidationMessage("compareValidation", error.message || "Unable to filter cities for that country.");
    }
}

function filterCityOptions() {
    const term = document.getElementById("citySearch").value.trim().toLowerCase();
    const source = cachedCities.length
        ? cachedCities
        : Array.from(document.getElementById("city1").options).map((option) => option.value);
    const filtered = source.filter((city) => city.toLowerCase().includes(term));

    if (!filtered.length) {
        setValidationMessage("compareValidation", "No cities matched that filter. Try a different name fragment.");
        return;
    }

    setValidationMessage("compareValidation", "");
    replaceSelectOptions("city1", filtered);
    replaceSelectOptions("city2", filtered);
}

async function searchCities() {
    const query = document.getElementById("cityAutocomplete").value.trim();
    const resultsNode = document.getElementById("searchResults");

    if (query.length < 2) {
        resultsNode.innerHTML = "";
        return;
    }

    if (searchAbortController) {
        searchAbortController.abort();
    }

    searchAbortController = new AbortController();

    try {
        const response = await fetch(`/search_cities?q=${encodeURIComponent(query)}`, {
            signal: searchAbortController.signal,
        });
        const data = await response.json();

        resultsNode.innerHTML = data.length
            ? data.map((item) => `
                <button type="button" class="search-item" onclick='applySearchCity(${JSON.stringify(item.city)})'>
                    <strong>${item.city}</strong>
                    <span>${item.country}</span>
                </button>
            `).join("")
            : `<div class="search-empty">No matching cities found.</div>`;
    } catch (error) {
        if (error.name !== "AbortError") {
            resultsNode.innerHTML = `<div class="search-empty">Search failed.</div>`;
        }
    }
}

function applySearchCity(city) {
    document.getElementById("cityAutocomplete").value = city;
    document.getElementById("searchResults").innerHTML = "";
    document.getElementById("detailCity").value = city;
    document.getElementById("growthCity").value = city;
    loadCityDetails();
}

async function loadCityDetails() {
    setPanelBusy("detailCity", true);
    setLoadingState("cityLoading", "Loading city spotlight...");

    try {
        const city = document.getElementById("detailCity").value;
        const data = await postJson("/city_details", { city });
        const colors = getThemeColors();
        const ctx = document.getElementById("cityDetailChart").getContext("2d");
        const cityGradient = createGradient(ctx, colors.fillPrimary, "rgba(255,255,255,0.02)");

        document.getElementById("detailCountry").textContent = data.country;
        document.getElementById("detailLatest").textContent = `${formatNumber(data.latest_population)} (${data.latest_year})`;
        document.getElementById("detailPeak").textContent = `${formatNumber(data.peak_population)} (${data.peak_year})`;
        document.getElementById("detailLowest").textContent = `${formatNumber(data.lowest_population)} (${data.lowest_year})`;

        latestCitySummary = `${data.city}, ${data.country}: latest population ${formatNumber(data.latest_population)} in ${data.latest_year}; peak ${formatNumber(data.peak_population)} in ${data.peak_year}; lowest ${formatNumber(data.lowest_population)} in ${data.lowest_year}.`;
        setResultCard("citySummary", latestCitySummary);

        buildChart(
            "cityDetailChart",
            {
                type: "line",
                data: {
                    labels: data.years,
                    datasets: [
                        createLineDataset({
                            label: `${data.city} population`,
                            data: data.populations,
                            borderColor: colors.primaryDeep,
                            pointColor: colors.primaryDeep,
                            backgroundColor: cityGradient,
                            fill: true,
                            chartKey: "cityDetailChart",
                        }),
                    ],
                },
                options: createBaseChartOptions("cityDetailChart", "nearest", false),
            },
            "cityDetailChart"
        );
        clearLoadingState("cityLoading");
    } catch (error) {
        showStatusState("cityLoading", error.message || "Unable to load city spotlight right now.", true);
        setResultCard("citySummary", error.message, "is-error");
    } finally {
        setPanelBusy("detailCity", false);
    }
}

async function copyCitySummary() {
    if (!latestCitySummary) {
        return;
    }

    try {
        await navigator.clipboard.writeText(latestCitySummary);
        setResultCard("citySummary", "City summary copied to clipboard.");
        setTimeout(() => setResultCard("citySummary", latestCitySummary), 1400);
    } catch (error) {
        setResultCard("citySummary", latestCitySummary);
    }
}

async function loadLeaderboard() {
    setPanelBusy("leaderboardYear", true);
    setListState("leaderboardList", "Loading leaderboard...");

    try {
        const year = document.getElementById("leaderboardYear").value;
        const group_by = document.getElementById("leaderboardMode").value;
        const limit = document.getElementById("leaderboardLimit").value;
        const data = await postJson("/leaderboard", { year, group_by, limit });

        if (!data.labels.length) {
            setListState("leaderboardList", "No ranking data found for the selected filters.");
            return;
        }

        document.getElementById("leaderboardList").innerHTML = data.labels
            .map((label, index) => {
                const suffix = data.meta[index] ? ` <span>${data.meta[index]}</span>` : "";
                return `<li><strong>${index + 1}. ${label}</strong>${suffix}<em>${formatNumber(data.populations[index])}</em></li>`;
            })
            .join("");
    } catch (error) {
        setListState("leaderboardList", error.message, "error");
    } finally {
        setPanelBusy("leaderboardYear", false);
    }
}

async function loadCountryGrowthByYear() {
    const tableBody = document.getElementById("countryGrowthTableBody");
    const message = document.getElementById("countryGrowthMessage");
    setPanelBusy("countryGrowthYear", true);
    message.className = "result-card compact-card";
    message.textContent = "Loading country growth...";

    try {
        const year = document.getElementById("countryGrowthYear").value;
        const data = await postJson("/country_growth_by_year", { year });

        message.className = "result-card compact-card";
        message.textContent = `Showing growth from ${data.previous_year} to ${data.year}.`;

        if (!data.rows.length) {
            setTableState("countryGrowthTableBody", 4, "No country growth data found for that year.");
            return;
        }

        tableBody.innerHTML = data.rows
            .map((row) => {
                const growthClass = row.growth_percentage >= 0 ? "growth-positive" : "growth-negative";
                const growthLabel = row.growth_percentage >= 0
                    ? `+${row.growth_percentage.toFixed(2)}%`
                    : `${row.growth_percentage.toFixed(2)}%`;
                return `
                    <tr>
                        <td>${row.country}</td>
                        <td>${formatNumber(row.previous_population)}</td>
                        <td>${formatNumber(row.current_population)}</td>
                        <td><span class="${growthClass}">${growthLabel}</span></td>
                    </tr>
                `;
            })
            .join("");
    } catch (error) {
        message.className = "result-card compact-card is-error";
        message.textContent = error.message;
        setTableState("countryGrowthTableBody", 4, error.message, "error");
    } finally {
        setPanelBusy("countryGrowthYear", false);
    }
}

async function loadYearSnapshot() {
    setPanelBusy("snapshotYear", true);
    setTableState("snapshotTableBody", 3, "Loading snapshot...");

    try {
        const year = document.getElementById("snapshotYear").value;
        const data = await postJson("/year_snapshot", { year });

        document.getElementById("snapshotTotal").textContent = formatNumber(data.total_population);
        document.getElementById("snapshotCities").textContent = data.city_count;
        document.getElementById("snapshotAverage").textContent = formatNumber(data.average_population);
        document.getElementById("snapshotTopCity").textContent = `${data.top_city} (${formatNumber(data.top_city_population)})`;
        latestSnapshotRows = data.rows;

        if (!data.rows.length) {
            setTableState("snapshotTableBody", 3, "No city snapshot rows are available for this year.");
            return;
        }

        document.getElementById("snapshotTableBody").innerHTML = data.rows
            .map((row) => `
                <tr>
                    <td>${row.city}</td>
                    <td>${row.country}</td>
                    <td>${formatNumber(row.population)}</td>
                </tr>
            `)
            .join("");
    } catch (error) {
        setTableState("snapshotTableBody", 3, error.message, "error");
    } finally {
        setPanelBusy("snapshotYear", false);
    }
}

function exportSnapshotCsv() {
    if (!latestSnapshotRows.length) {
        return;
    }

    const rows = [
        ["City", "Country", "Population"],
        ...latestSnapshotRows.map((row) => [row.city, row.country, row.population]),
    ];
    const csv = rows.map((row) => row.join(",")).join("\n");
    downloadTextFile("year-snapshot.csv", csv, "text/csv;charset=utf-8");
}

async function loadCountryInsights() {
    setPanelBusy("insightCountry", true);
    setLoadingState("countryLoading", "Exploring country data...");

    try {
        const country = document.getElementById("insightCountry").value;
        const data = await postJson("/country_insights", { country });
        const colors = getThemeColors();
        const ctx = document.getElementById("countryChart").getContext("2d");
        const gradient = createGradient(ctx, colors.secondary, colors.primaryDeep);

        document.getElementById("countryInsightTitle").textContent = `Top cities in ${data.country} (${data.latest_year})`;
        document.getElementById("countryTopCities").innerHTML = data.top_cities
            .map((city, index) => `<li>${index + 1}. ${city} - ${formatNumber(data.top_city_populations[index])}</li>`)
            .join("");
        document.getElementById("countrySummary").textContent = `${data.country} tracks ${data.city_count} cities with the latest total recorded in ${data.latest_year}.`;

        buildChart(
            "countryChart",
            {
                type: "bar",
                data: {
                    labels: data.years,
                    datasets: [{
                        label: `${data.country} total population`,
                        data: data.populations,
                        backgroundColor: buildBarColors(
                            data.populations.length,
                            gradient,
                            colors.primary,
                            chartSelectionState.countryChart
                        ),
                        borderRadius: 10,
                    }],
                },
                options: createBaseChartOptions("countryChart", "nearest", false),
            },
            "countryChart"
        );
        clearLoadingState("countryLoading");
    } catch (error) {
        showStatusState("countryLoading", error.message || "Unable to explore country data right now.", true);
        setResultCard("countrySummary", error.message, "is-error");
    } finally {
        setPanelBusy("insightCountry", false);
    }
}

async function loadRealPopulationTrend() {
    setPanelBusy("realDataCountry", true);
    setLoadingState("realDataLoading", "Loading official World Bank data...");

    try {
        const country = document.getElementById("realDataCountry").value;
        const data = await postJson("/real_population_trend", { country });
        const colors = getThemeColors();
        const ctx = document.getElementById("worldPopulationChart").getContext("2d");
        const gradient = createGradient(ctx, colors.fillPrimary, "rgba(255,255,255,0.02)");

        setResultCard(
            "realDataSummary",
            `<strong>${data.country}</strong> grew from ${formatNumber(data.start_population)} in ${data.start_year}
            to ${formatNumber(data.latest_population)} in ${data.latest_year}. Total growth:
            <strong>${data.growth_percentage}%</strong>.`
        );

        buildChart(
            "worldPopulationChart",
            {
                type: "line",
                data: {
                    labels: data.years,
                    datasets: [
                        createLineDataset({
                            label: `${data.country} total population`,
                            data: data.populations,
                            borderColor: colors.primary,
                            pointColor: colors.primaryDeep,
                            backgroundColor: gradient,
                            fill: true,
                            chartKey: "worldPopulationChart",
                            tension: 0.28,
                        }),
                    ],
                },
                options: createBaseChartOptions("worldPopulationChart", "nearest", false),
            },
            "worldPopulationChart"
        );
        clearLoadingState("realDataLoading");
    } catch (error) {
        showStatusState("realDataLoading", error.message || "Unable to load World Bank data right now.", true);
        setResultCard("realDataSummary", error.message, "is-error");
    } finally {
        setPanelBusy("realDataCountry", false);
    }
}

function updateForecastOptions() {
    const mode = document.getElementById("forecastMode").value;
    const options = mode === "country"
        ? window.initialData.countries
        : window.initialData.cities;
    populateSelectOptions("forecastName", options);
}

function updateProjectionOptions() {
    const mode = document.getElementById("projectionMode").value;
    const options = mode === "country"
        ? window.initialData.countries
        : window.initialData.cities;
    populateSelectOptions("projectionFirst", options);
    populateSelectOptions("projectionSecond", options);

    if (options.length > 1 && document.getElementById("projectionFirst").value === document.getElementById("projectionSecond").value) {
        document.getElementById("projectionSecond").value = options[1];
    }
}

async function loadPopulationForecast() {
    const validationMessage = validateForecastInputs();
    setValidationMessage("forecastValidation", validationMessage);

    if (validationMessage) {
        setResultCard("forecastSummary", validationMessage, "is-empty");
        return;
    }

    setPanelBusy("forecastMode", true);
    setLoadingState("forecastLoading", "Calculating forecast...");

    try {
        const mode = document.getElementById("forecastMode").value;
        const name = document.getElementById("forecastName").value;
        const yearsAhead = document.getElementById("forecastYearsAhead").value;
        const data = await postJson("/population_forecast", {
            mode,
            name,
            years_ahead: yearsAhead,
        });
        const colors = getThemeColors();
        const ctx = document.getElementById("forecastChart").getContext("2d");
        const historicalGradient = createGradient(ctx, colors.fillPrimary, "rgba(255,255,255,0.02)");
        const labels = [...data.historical_years, ...data.forecast_years];
        const historicalSeries = [...data.historical_populations, ...Array(data.forecast_years.length).fill(null)];
        const forecastSeries = [
            ...Array(Math.max(data.historical_years.length - 1, 0)).fill(null),
            data.historical_populations[data.historical_populations.length - 1],
            ...data.forecast_populations,
        ];

        setResultCard(
            "forecastSummary",
            `<strong>${data.name}</strong> is forecast to reach ${formatNumber(data.forecast_populations[data.forecast_populations.length - 1])}
            by ${data.forecast_years[data.forecast_years.length - 1]}. Estimated annual change:
            <strong>${formatNumber(data.annual_change)}</strong>. Method: ${data.method}.`
        );

        buildChart(
            "forecastChart",
            {
                type: "line",
                data: {
                    labels,
                    datasets: [
                        createLineDataset({
                            label: `${data.name} historical`,
                            data: historicalSeries,
                            borderColor: colors.primary,
                            pointColor: colors.primaryDeep,
                            backgroundColor: historicalGradient,
                            fill: true,
                            chartKey: "forecastChart",
                        }),
                        createLineDataset({
                            label: `${data.name} forecast`,
                            data: forecastSeries,
                            borderColor: colors.secondary,
                            pointColor: colors.secondary,
                            borderDash: [8, 6],
                            chartKey: "forecastChart",
                        }),
                    ],
                },
                options: createBaseChartOptions("forecastChart", "index", true),
            },
            "forecastChart"
        );
        clearLoadingState("forecastLoading");
    } catch (error) {
        showStatusState("forecastLoading", error.message || "Unable to build a forecast right now.", true);
        setResultCard("forecastSummary", error.message, "is-error");
    } finally {
        setPanelBusy("forecastMode", false);
    }
}

async function loadProjectedComparison() {
    const validationMessage = validateProjectionInputs();
    setValidationMessage("projectionValidation", validationMessage);

    if (validationMessage) {
        setResultCard("projectionSummary", validationMessage, "is-empty");
        return;
    }

    const targetYear = window.initialData.projectedTargetYear;
    setPanelBusy("projectionMode", true);
    setLoadingState("projectionLoading", `Building comparison through ${targetYear}...`);

    try {
        const mode = document.getElementById("projectionMode").value;
        const firstName = document.getElementById("projectionFirst").value;
        const secondName = document.getElementById("projectionSecond").value;
        const data = await postJson("/compare_projection", {
            mode,
            first_name: firstName,
            second_name: secondName,
            target_year: targetYear,
        });
        const colors = getThemeColors();
        const ctx = document.getElementById("projectionCompareChart").getContext("2d");
        const firstGradient = createGradient(ctx, colors.fillPrimary, "rgba(255,255,255,0.02)");
        const secondGradient = createGradient(ctx, colors.fillSecondary, "rgba(255,255,255,0.02)");
        const labels = Array.from(
            new Set([
                ...data.first.historical_years,
                ...data.first.forecast_years,
                ...data.second.historical_years,
                ...data.second.forecast_years,
            ])
        ).sort((a, b) => a - b);

        const firstHistoricalMap = new Map(data.first.historical_years.map((year, index) => [year, data.first.historical_populations[index]]));
        const firstForecastMap = new Map(data.first.forecast_years.map((year, index) => [year, data.first.forecast_populations[index]]));
        const secondHistoricalMap = new Map(data.second.historical_years.map((year, index) => [year, data.second.historical_populations[index]]));
        const secondForecastMap = new Map(data.second.forecast_years.map((year, index) => [year, data.second.forecast_populations[index]]));

        const firstHistoricalSeries = labels.map((year) => firstHistoricalMap.has(year) ? firstHistoricalMap.get(year) : null);
        const firstForecastSeries = labels.map((year) => firstForecastMap.has(year) ? firstForecastMap.get(year) : null);
        const secondHistoricalSeries = labels.map((year) => secondHistoricalMap.has(year) ? secondHistoricalMap.get(year) : null);
        const secondForecastSeries = labels.map((year) => secondForecastMap.has(year) ? secondForecastMap.get(year) : null);

        setResultCard(
            "projectionSummary",
            `By <strong>${data.target_year}</strong>, <strong>${data.projected_leader}</strong> is projected to lead by
            <strong>${formatNumber(data.projected_gap)}</strong> people. Solid lines show history; dashed lines show estimates.`
        );

        buildChart(
            "projectionCompareChart",
            {
                type: "line",
                data: {
                    labels,
                    datasets: [
                        createLineDataset({
                            label: `${data.first_name} historical`,
                            data: firstHistoricalSeries,
                            borderColor: colors.primary,
                            pointColor: colors.primaryDeep,
                            backgroundColor: firstGradient,
                            fill: true,
                            chartKey: "projectionCompareChart",
                        }),
                        createLineDataset({
                            label: `${data.first_name} forecast`,
                            data: firstForecastSeries,
                            borderColor: colors.primaryDeep,
                            pointColor: colors.primaryDeep,
                            borderDash: [8, 6],
                            chartKey: "projectionCompareChart",
                        }),
                        createLineDataset({
                            label: `${data.second_name} historical`,
                            data: secondHistoricalSeries,
                            borderColor: colors.secondary,
                            pointColor: colors.secondary,
                            backgroundColor: secondGradient,
                            fill: true,
                            chartKey: "projectionCompareChart",
                        }),
                        createLineDataset({
                            label: `${data.second_name} forecast`,
                            data: secondForecastSeries,
                            borderColor: colors.secondaryDeep,
                            pointColor: colors.secondary,
                            borderDash: [8, 6],
                            chartKey: "projectionCompareChart",
                        }),
                    ],
                },
                options: createBaseChartOptions("projectionCompareChart", "index", true),
            },
            "projectionCompareChart"
        );
        clearLoadingState("projectionLoading");
    } catch (error) {
        showStatusState("projectionLoading", error.message || "Unable to build the projection comparison right now.", true);
        setResultCard("projectionSummary", error.message, "is-error");
    } finally {
        setPanelBusy("projectionMode", false);
    }
}

document.addEventListener("DOMContentLoaded", () => {
    applySavedTheme();
    initRevealAnimations();
    animateCounters();

    setResultCard("compareSummary", "Select two cities to compare population trends and insights &#128202;", "is-empty");
    setResultCard("growthResult", "Select a city and years to see growth insights &#128200;", "is-empty");
    setResultCard("citySummary", "Select a city to generate a quick plain-language summary &#10024;", "is-empty");

    cachedCities = Array.from(document.getElementById("city1").options).map((option) => option.value);
    updateForecastOptions();
    updateProjectionOptions();
    updateClock();
    setInterval(updateClock, 60000);

    getTop10();
    loadLeaderboard();
    loadCountryGrowthByYear();
    loadCityDetails();
    loadYearSnapshot();
    loadCountryInsights();
    loadRealPopulationTrend();
    loadPopulationForecast();
    loadProjectedComparison();
});
