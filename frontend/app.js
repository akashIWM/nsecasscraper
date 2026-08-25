// ============================================================
// CONFIGURATION
// ============================================================

const API_URL = "/api/cas";

const NIFTY_API_URL = "/api/nifty50";

let selectedMarket = "nifty50";

let marketRequestId = 0;

const REFRESH_INTERVAL = 2000;

const MAX_SUGGESTIONS = 10;


// ============================================================
// DOM ELEMENTS
// ============================================================

const statusDot =
    document.getElementById("statusDot");

const statusText =
    document.getElementById("statusText");

const errorBox =
    document.getElementById("errorBox");

const errorMessage =
    document.getElementById("errorMessage");


// ------------------------------------------------------------
// Summary
// ------------------------------------------------------------

const stockCount =
    document.getElementById("stockCount");

const positiveCount =
    document.getElementById("positiveCount");

const negativeCount =
    document.getElementById("negativeCount");

const lastUpdate =
    document.getElementById("lastUpdate");


// ------------------------------------------------------------
// NIFTY summary
// ------------------------------------------------------------

const niftyChange =
    document.getElementById("niftyChange");

const niftyCoverage =
    document.getElementById("niftyCoverage");

const niftyProgressBar =
    document.getElementById("niftyProgressBar");

const availableWeight =
    document.getElementById("availableWeight");

const niftyUpdated =
    document.getElementById("niftyUpdated");

const positiveContribution =
    document.getElementById("positiveContribution");

const negativeContribution =
    document.getElementById("negativeContribution");

const availableStocks =
    document.getElementById("availableStocks");

const totalStocks =
    document.getElementById("totalStocks");


// ------------------------------------------------------------
// NEW:
// Actual NIFTY 50 index value (spot price) elements.
// Populated from payload.nifty50_index, separate from the
// weighted contribution (niftyChange) computed from CAS rows.
// ------------------------------------------------------------

const niftyIndexValue =
    document.getElementById("niftyIndexValue");

const niftyIndexDelta =
    document.getElementById("niftyIndexDelta");

// ============================================================
// NEW: Reference price logic added here
// Reference for the NIFTY 50 previous close element
// ============================================================
const niftyReferencePrice =
    document.getElementById("niftyReferencePrice");
// ============================================================


// ------------------------------------------------------------
// Search / filters
// ------------------------------------------------------------

const searchInput =
    document.getElementById("searchInput");

const clearSearch =
    document.getElementById("clearSearch");

const searchSuggestions =
    document.getElementById(
        "searchSuggestions"
    );

const changeFilter =
    document.getElementById("changeFilter");

const sortSelect =
    document.getElementById("sortSelect");

const marketSelect =
    document.getElementById("marketSelect");

const marketName =
    document.getElementById("marketName");

const auctionDescription =
    document.getElementById("auctionDescription");

const brandIcon =
    document.getElementById("brandIcon");

const headerTagline =
    document.getElementById("headerTagline");

const footerTagline =
    document.getElementById("footerTagline");

const contributionTitle =
    document.getElementById("contributionTitle");


// ------------------------------------------------------------
// Tables
// ------------------------------------------------------------

const tableBody =
    document.getElementById("tableBody");

const tableInfo =
    document.getElementById("tableInfo");

const niftyTableBody =
    document.getElementById("niftyTableBody");

const niftyTableInfo =
    document.getElementById("niftyTableInfo");


// ============================================================
// STATE
// ============================================================

let allRecords = [];

let allSymbols = [];

let selectedSuggestionIndex = -1;

let currentSearchValue = "";


// ============================================================
// NUMBER FORMATTERS
// ============================================================

function formatNumber(
    value,
    decimals = 2
) {

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {
        return "—";
    }

    const number =
        Number(value);

    if (!Number.isFinite(number)) {
        return "—";
    }

    return number.toLocaleString(
        "en-IN",
        {
            minimumFractionDigits:
                decimals,

            maximumFractionDigits:
                decimals
        }
    );
}


// ============================================================
// PERCENTAGE
// ============================================================

function formatPercentage(value) {

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {
        return "—";
    }

    const number =
        Number(value);

    if (!Number.isFinite(number)) {
        return "—";
    }

    const sign =
        number > 0
            ? "+"
            : "";

    return (
        sign +
        number.toFixed(2) +
        "%"
    );
}


// ============================================================
// SIGNED NUMBER
// ============================================================

function formatSignedNumber(value) {

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {
        return "—";
    }

    const number =
        Number(value);

    if (!Number.isFinite(number)) {
        return "—";
    }

    const sign =
        number > 0
            ? "+"
            : "";

    return (
        sign +
        number.toFixed(2)
    );
}


// ============================================================
// WEIGHT
// ============================================================

function formatWeight(value) {

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {
        return "—";
    }

    const number =
        Number(value);

    if (!Number.isFinite(number)) {
        return "—";
    }

    return (
        number.toFixed(2) +
        "%"
    );
}


// ============================================================
// CONTRIBUTION
// ============================================================

function formatContribution(value) {

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {
        return "—";
    }

    const number =
        Number(value);

    if (!Number.isFinite(number)) {
        return "—";
    }

    const sign =
        number > 0
            ? "+"
            : "";

    return (
        sign +
        number.toFixed(4)
    );
}


// ============================================================
// TIMESTAMP
// ============================================================

function formatTimestamp(timestamp) {

    if (!timestamp) {
        return "—";
    }

    try {

        const date =
            new Date(timestamp);

        if (
            Number.isNaN(
                date.getTime()
            )
        ) {
            return timestamp;
        }

        return date.toLocaleString(
            "en-IN",
            {
                day: "2-digit",

                month: "short",

                year: "numeric",

                hour: "2-digit",

                minute: "2-digit",

                second: "2-digit",

                hour12: false,

                timeZone:
                    "Asia/Kolkata"
            }
        );

    } catch {

        return timestamp;
    }
}


// ============================================================
// VALUE CLASS
// ============================================================

function valueClass(value) {

    const number =
        Number(value);

    if (!Number.isFinite(number)) {
        return "neutral";
    }

    if (number > 0) {
        return "positive";
    }

    if (number < 0) {
        return "negative";
    }

    return "neutral";
}


// ============================================================
// HTML ESCAPE
// ============================================================

function escapeHtml(value) {

    return String(value)
        .replaceAll(
            "&",
            "&amp;"
        )
        .replaceAll(
            "<",
            "&lt;"
        )
        .replaceAll(
            ">",
            "&gt;"
        )
        .replaceAll(
            '"',
            "&quot;"
        )
        .replaceAll(
            "'",
            "&#039;"
        );
}


// ============================================================
// CONNECTION STATUS
// ============================================================

function setConnectionStatus(
    status,
    text
) {

    if (statusDot) {

        statusDot.className =
            "status-dot " +
            status;
    }

    if (statusText) {

        statusText.textContent =
            text;
    }
}


// ============================================================
// ERROR
// ============================================================

function showError(message) {

    if (!errorBox) {
        return;
    }

    errorMessage.textContent =
        message;

    errorBox.classList.remove(
        "hidden"
    );
}


function hideError() {

    if (!errorBox) {
        return;
    }

    errorBox.classList.add(
        "hidden"
    );
}


// ============================================================
// UPDATE CLEAR BUTTON
// ============================================================

function updateClearButton() {

    if (!clearSearch) {
        return;
    }

    const hasValue =
        searchInput.value.trim().length > 0;

    clearSearch.classList.toggle(
        "hidden",
        !hasValue
    );
}


// ============================================================
// UPDATE ARIA STATE
// ============================================================

function updateSearchAria(
    expanded
) {

    if (!searchInput) {
        return;
    }

    searchInput.setAttribute(
        "aria-expanded",
        String(expanded)
    );
}


// ============================================================
// UPDATE SUMMARY
// ============================================================

function updateSummary(payload) {

    const displayName =
        payload.market_name ||
        (selectedMarket === "sensex" ? "SENSEX" : "NIFTY 50");

    if (marketName) {
        marketName.textContent = displayName;
    }

    if (auctionDescription) {
        auctionDescription.textContent =
            `Live ${displayName} closing auction records`;
    }

    if (contributionTitle) {
        contributionTitle.textContent =
            `${displayName} Contribution`;
    }

    const exchangeName =
        selectedMarket === "sensex"
            ? "BSE"
            : "NSE";

    if (brandIcon) {
        brandIcon.textContent = exchangeName;
    }

    if (headerTagline) {
        headerTagline.textContent =
            `${exchangeName} Closing Auction Session`;
    }

    if (footerTagline) {
        footerTagline.textContent =
            `${exchangeName} Closing Auction Session`;
    }

    document.title =
        `${exchangeName} Closing Auction Dashboard`;

    const records =
        Array.isArray(payload.data)
            ? payload.data
            : [];


    // --------------------------------------------------------
    // CAS counts
    // --------------------------------------------------------

    if (stockCount) {

        stockCount.textContent =
            payload.record_count ??
            records.length;
    }


    const positive =
        records.filter(
            record =>
                Number(
                    record.percentage_change
                ) > 0
        ).length;


    const negative =
        records.filter(
            record =>
                Number(
                    record.percentage_change
                ) < 0
        ).length;


    if (positiveCount) {

        positiveCount.textContent =
            positive;
    }


    if (negativeCount) {

        negativeCount.textContent =
            negative;
    }


    if (lastUpdate) {

        lastUpdate.textContent =
            formatTimestamp(
                payload.timestamp ||
                payload.timestamp_ist
            );
    }


    // --------------------------------------------------------
    // NOTE:
    // The actual NIFTY 50 index value (last/change/reference
    // price) is owned exclusively by fetchNiftyData() /
    // updateLiveNifty(), which polls /api/nifty50. That endpoint
    // has no CAS-window time restriction, unlike /api/cas, so it
    // stays live all day. Updating those same elements here from
    // the CAS payload caused them to flicker/blank whenever
    // /api/cas had no data (i.e. outside 15:15-15:30 IST).
    // --------------------------------------------------------


    // --------------------------------------------------------
    // NIFTY
    // --------------------------------------------------------

    const niftyRecords =
        records.filter(
            record =>
                record.is_nifty50
        );


    const niftyAvailable =
        niftyRecords.length;


    const niftyTotal =
        Number(
            payload.nifty50_count
        ) ||
        50;


    if (niftyCoverage) {

        niftyCoverage.textContent =
            `${niftyAvailable}/${niftyTotal}`;
    }


    // --------------------------------------------------------
    // WEIGHT
    // --------------------------------------------------------

    const weightSum =
        niftyRecords.reduce(
            (
                total,
                record
            ) => {

                const weight =
                    Number(
                        record.weight ??
                        record.weight_pct / 100
                    );

                if (
                    Number.isFinite(
                        weight
                    )
                ) {

                    return (
                        total +
                        weight
                    );
                }

                return total;
            },
            0
        );


    if (availableWeight) {

        availableWeight.textContent =
            (
                weightSum * 100
            ).toFixed(2) +
            "%";
    }


    if (niftyProgressBar) {

        const coverage =
            Math.min(
                100,

                (
                    niftyAvailable /
                    niftyTotal
                ) * 100
            );

        niftyProgressBar.style.width =
            coverage + "%";
    }


    // --------------------------------------------------------
    // Available stocks
    // --------------------------------------------------------

    if (availableStocks) {

        availableStocks.textContent =
            niftyAvailable;
    }


    if (totalStocks) {

        totalStocks.textContent =
            niftyTotal;
    }


    // --------------------------------------------------------
    // NIFTY weighted movement
    // --------------------------------------------------------

    let totalContribution = 0;

    let positiveContrib = 0;

    let negativeContrib = 0;


    niftyRecords.forEach(
        record => {

            const contribution =
                Number(
                    record.contribution
                );

            if (
                !Number.isFinite(
                    contribution
                )
            ) {
                return;
            }

            totalContribution +=
                contribution;


            if (contribution > 0) {

                positiveContrib +=
                    contribution;

            } else if (
                contribution < 0
            ) {

                negativeContrib +=
                    contribution;
            }
        }
    );


    if (niftyChange) {

        niftyChange.textContent =
            formatPercentage(
                totalContribution
            );

        niftyChange.className =
            "nifty-value " +
            valueClass(
                totalContribution
            );
    }


    if (positiveContribution) {

        positiveContribution.textContent =
            formatContribution(
                positiveContrib
            );
    }


    if (negativeContribution) {

        negativeContribution.textContent =
            formatContribution(
                negativeContrib
            );
    }


    // niftyUpdated is owned by updateLiveNifty() (via
    // fetchNiftyData -> /api/nifty50), not this function.
}


// ============================================================
// BUILD SYMBOL LIST
// ============================================================

function rebuildSymbolList() {

    const symbols =
        allRecords
            .map(
                record =>
                    String(
                        record.symbol ||
                        ""
                    )
                        .trim()
                        .toUpperCase()
            )
            .filter(Boolean);


    allSymbols =
        [
            ...new Set(
                symbols
            )
        ]
            .sort(
                (
                    a,
                    b
                ) =>
                    a.localeCompare(b)
            );
}


// ============================================================
// FIND MATCHES FOR AUTOCOMPLETE
// ============================================================
//
// Ranking:
// 1. Exact match
// 2. Starts with query
// 3. Contains query
//
// Within the same group, symbols are alphabetical.
// ============================================================

function getSuggestionMatches(
    query
) {

    const normalizedQuery =
        query
            .trim()
            .toUpperCase();


    if (!normalizedQuery) {
        return [];
    }


    const exactMatches = [];

    const startsWithMatches = [];

    const containsMatches = [];


    allSymbols.forEach(
        symbol => {

            const normalizedSymbol =
                symbol.toUpperCase();


            if (
                normalizedSymbol ===
                normalizedQuery
            ) {

                exactMatches.push(
                    symbol
                );

                return;
            }


            if (
                normalizedSymbol.startsWith(
                    normalizedQuery
                )
            ) {

                startsWithMatches.push(
                    symbol
                );

                return;
            }


            if (
                normalizedSymbol.includes(
                    normalizedQuery
                )
            ) {

                containsMatches.push(
                    symbol
                );
            }
        }
    );


    return [
        ...exactMatches,
        ...startsWithMatches,
        ...containsMatches
    ]
        .slice(
            0,
            MAX_SUGGESTIONS
        );
}


// ============================================================
// HIGHLIGHT SEARCH MATCH
// ============================================================

function highlightMatch(
    text,
    query
) {

    const normalizedText =
        text.toUpperCase();

    const normalizedQuery =
        query.toUpperCase();


    const index =
        normalizedText.indexOf(
            normalizedQuery
        );


    if (index === -1) {

        return escapeHtml(text);
    }


    const before =
        text.substring(
            0,
            index
        );


    const match =
        text.substring(
            index,
            index +
                query.length
        );


    const after =
        text.substring(
            index +
                query.length
        );


    return (
        escapeHtml(before) +
        `<strong>${escapeHtml(match)}</strong>` +
        escapeHtml(after)
    );
}


// ============================================================
// SHOW SUGGESTIONS
// ============================================================

function showSuggestions(
    matches,
    query
) {

    if (!searchSuggestions) {
        return;
    }


    if (!matches.length) {

        hideSuggestions();

        return;
    }


    searchSuggestions.innerHTML =
        matches
            .map(
                (
                    symbol,
                    index
                ) => {

                    return `
                        <div
                            class="search-suggestion"
                            role="option"
                            aria-selected="false"
                            data-symbol="${escapeHtml(symbol)}"
                            data-index="${index}"
                        >

                            <span class="suggestion-symbol">
                                ${highlightMatch(
                                    symbol,
                                    query
                                )}
                            </span>

                            <span class="suggestion-meta">
                                ${selectedMarket === "sensex" ? "BSE" : "NSE"}
                            </span>

                        </div>
                    `;
                }
            )
            .join("");


    searchSuggestions
        .querySelectorAll(
            ".search-suggestion"
        )
        .forEach(
            element => {

                /*
                 * mousedown is intentional.
                 *
                 * A normal click fires after the input
                 * loses focus, which can hide the
                 * suggestion list before selection.
                 */

                element.addEventListener(
                    "mousedown",
                    event => {

                        event.preventDefault();

                        const symbol =
                            element.dataset.symbol;

                        selectSymbol(
                            symbol
                        );
                    }
                );
            }
        );


    searchSuggestions.classList.remove(
        "hidden"
    );


    updateSearchAria(true);


    selectedSuggestionIndex =
        -1;
}


// ============================================================
// HIDE SUGGESTIONS
// ============================================================

function hideSuggestions() {

    if (!searchSuggestions) {
        return;
    }

    searchSuggestions.classList.add(
        "hidden"
    );


    updateSearchAria(false);


    selectedSuggestionIndex =
        -1;
}


// ============================================================
// UPDATE SEARCH SUGGESTIONS
// ============================================================

function updateSearchSuggestions() {

    const query =
        searchInput.value
            .trim()
            .toUpperCase();


    currentSearchValue =
        query;


    selectedSuggestionIndex =
        -1;


    updateClearButton();


    if (!query) {

        hideSuggestions();

        renderTable();

        return;
    }


    const matches =
        getSuggestionMatches(
            query
        );


    if (!matches.length) {

        hideSuggestions();

        renderTable();

        return;
    }


    showSuggestions(
        matches,
        query
    );


    renderTable();
}


// ============================================================
// SELECT SYMBOL
// ============================================================

function selectSymbol(
    symbol
) {

    if (!symbol) {
        return;
    }


    searchInput.value =
        symbol;


    currentSearchValue =
        symbol.toUpperCase();


    updateClearButton();


    hideSuggestions();


    renderTable();


    searchInput.focus();


    searchInput.setSelectionRange(
        searchInput.value.length,
        searchInput.value.length
    );
}


// ============================================================
// CLEAR SEARCH
// ============================================================

function clearSearchValue() {

    searchInput.value = "";

    currentSearchValue = "";

    selectedSuggestionIndex = -1;

    updateClearButton();

    hideSuggestions();

    renderTable();

    searchInput.focus();
}


// ============================================================
// UPDATE HIGHLIGHTED SUGGESTION
// ============================================================

function updateHighlightedSuggestion(
    suggestions
) {

    suggestions.forEach(
        (
            element,
            index
        ) => {

            const active =
                index ===
                selectedSuggestionIndex;


            element.classList.toggle(
                "active",
                active
            );


            element.setAttribute(
                "aria-selected",
                String(active)
            );
        }
    );


    const active =
        suggestions[
            selectedSuggestionIndex
        ];


    if (active) {

        active.scrollIntoView({
            block: "nearest"
        });
    }
}


// ============================================================
// KEYBOARD NAVIGATION
// ============================================================

function handleSearchKeyboard(
    event
) {

    const suggestions =
        [
            ...searchSuggestions
                .querySelectorAll(
                    ".search-suggestion"
                )
        ];


    // --------------------------------------------------------
    // Arrow Down
    // --------------------------------------------------------

    if (
        event.key === "ArrowDown"
    ) {

        if (!suggestions.length) {
            return;
        }


        event.preventDefault();


        selectedSuggestionIndex =
            Math.min(
                selectedSuggestionIndex + 1,
                suggestions.length - 1
            );


        updateHighlightedSuggestion(
            suggestions
        );


        return;
    }


    // --------------------------------------------------------
    // Arrow Up
    // --------------------------------------------------------

    if (
        event.key === "ArrowUp"
    ) {

        if (!suggestions.length) {
            return;
        }


        event.preventDefault();


        if (
            selectedSuggestionIndex === -1
        ) {

            selectedSuggestionIndex =
                suggestions.length - 1;

        } else {

            selectedSuggestionIndex =
                Math.max(
                    selectedSuggestionIndex - 1,
                    0
                );
        }


        updateHighlightedSuggestion(
            suggestions
        );


        return;
    }


    // --------------------------------------------------------
    // Enter
    // --------------------------------------------------------

    if (
        event.key === "Enter"
    ) {

        if (
            selectedSuggestionIndex >= 0 &&
            suggestions[
                selectedSuggestionIndex
            ]
        ) {

            event.preventDefault();


            selectSymbol(
                suggestions[
                    selectedSuggestionIndex
                ].dataset.symbol
            );


            return;
        }


        hideSuggestions();

        renderTable();


        return;
    }


    // --------------------------------------------------------
    // Escape
    // --------------------------------------------------------

    if (
        event.key === "Escape"
    ) {

        hideSuggestions();

        return;
    }
}


// ============================================================
// FILTER + SORT
// ============================================================

function getFilteredRecords() {

    const search =
        searchInput.value
            .trim()
            .toUpperCase();


    const filter =
        changeFilter.value;


    let records =
        allRecords.filter(
            record => {

                const symbol =
                    String(
                        record.symbol ||
                        ""
                    )
                        .toUpperCase();


                // ------------------------------------------------
                // Search
                // ------------------------------------------------

                if (
                    search &&
                    !symbol.includes(
                        search
                    )
                ) {

                    return false;
                }


                // ------------------------------------------------
                // Change filter
                // ------------------------------------------------

                const change =
                    Number(
                        record.percentage_change
                    );


                if (
                    filter === "positive" &&
                    !(change > 0)
                ) {

                    return false;
                }


                if (
                    filter === "negative" &&
                    !(change < 0)
                ) {

                    return false;
                }


                if (
                    filter === "zero" &&
                    change !== 0
                ) {

                    return false;
                }


                return true;
            }
        );


    // ========================================================
    // SORT
    // ========================================================

    const sortBy =
        sortSelect.value;


    records.sort(
        (
            a,
            b
        ) => {

            if (
                sortBy === "symbol"
            ) {

                return String(
                    a.symbol || ""
                ).localeCompare(
                    String(
                        b.symbol || ""
                    )
                );
            }


            const av =
                Number(
                    a[sortBy]
                );


            const bv =
                Number(
                    b[sortBy]
                );


            const aValid =
                Number.isFinite(
                    av
                );


            const bValid =
                Number.isFinite(
                    bv
                );


            if (
                !aValid &&
                !bValid
            ) {

                return 0;
            }


            if (!aValid) {
                return 1;
            }


            if (!bValid) {
                return -1;
            }


            return bv - av;
        }
    );


    return records;
}


// ============================================================
// RENDER MAIN CAS TABLE
// ============================================================
//
// Serial number is generated from the currently visible
// records after search/filter/sort.
// Therefore:
//
// No filter -> 1, 2, 3, ... total records
// Search    -> 1, 2, 3, ... matching records
// Filter    -> 1, 2, 3, ... filtered records
//
// This makes it easy to see exactly how many stocks are
// currently displayed.
// ============================================================

function updateLiveNifty(
    niftyIndex,
    timestamp
) {

    if (niftyIndexValue) {

        const displayValue =
            niftyIndex &&
            niftyIndex.display_value != null
                ? niftyIndex.display_value
                : niftyIndex?.last;

        niftyIndexValue.textContent =
            displayValue != null
                ? formatNumber(displayValue)
                : "—";

        // NSE's public index API is CDN-cached and can freeze
        // "last" for minutes. When that happens the backend
        // swaps in "indicativeClose" (closer to the real spot
        // price) and flags is_stale so we can mark it here.
        if (niftyIndex && niftyIndex.is_stale) {

            niftyIndexValue.title =
                "NSE's live feed hasn't updated recently — " +
                "showing indicative close instead of last traded value.";

            niftyIndexValue.classList.add("nifty-index-stale");

        } else {

            niftyIndexValue.removeAttribute("title");
            niftyIndexValue.classList.remove("nifty-index-stale");
        }
    }

    if (niftyIndexDelta) {

        if (
            niftyIndex &&
            niftyIndex.change != null
        ) {

            niftyIndexDelta.textContent =
                `${formatSignedNumber(niftyIndex.change)} ` +
                `(${formatPercentage(niftyIndex.percent_change)})`;

            niftyIndexDelta.className =
                "nifty-index-delta " +
                valueClass(niftyIndex.change);

        } else {

            niftyIndexDelta.textContent = "—";
            niftyIndexDelta.className =
                "nifty-index-delta neutral";
        }
    }

    if (niftyReferencePrice) {

        niftyReferencePrice.textContent =
            niftyIndex &&
            niftyIndex.reference_price != null
                ? formatNumber(niftyIndex.reference_price)
                : "—";
    }

    if (niftyUpdated) {

        niftyUpdated.textContent =
            formatTimestamp(
                timestamp ||
                niftyIndex?.last_update_time
            );
    }
}

function renderTable() {

    const records =
        getFilteredRecords();


    if (tableInfo) {

        tableInfo.textContent =
            `${records.length} of ${allRecords.length} records`;
    }


    if (!records.length) {

        tableBody.innerHTML = `
            <tr>

                <td
                    colspan="7"
                    class="loading"
                >
                    No matching records.
                </td>

            </tr>
        `;

        return;
    }


    tableBody.innerHTML =
        records
            .map(
                (record, index) => {

                    const changeClass =
                        valueClass(
                            record.change
                        );


                    const percentageClass =
                        valueClass(
                            record.percentage_change
                        );


                    const rowClass =
                        record.is_nifty50
                            ? "nifty-row"
                            : "";


                    /*
                     * index starts from 0.
                     *
                     * Display starts from 1.
                     */

                    const serialNumber =
                        index + 1;


                    return `
                        <tr
                            class="${rowClass}"
                        >

                            <!-- SERIAL NUMBER -->

                            <td class="serial-number">
                                ${serialNumber}
                            </td>


                            <!-- SYMBOL -->

                            <td class="symbol">

                                ${escapeHtml(
                                    record.symbol ||
                                    "—"
                                )}

                                ${
                                    record.is_nifty50
                                        ? `
                                            <span class="nifty-badge">
                                                ${selectedMarket === "sensex" ? "SENSEX" : "NIFTY 50"}
                                            </span>
                                        `
                                        : ""
                                }

                            </td>


                            <!-- IEP -->

                            <td class="number">
                                ${formatNumber(
                                    record.iep
                                )}
                            </td>


                            <!-- CHANGE -->

                            <td
                                class="
                                    number
                                    ${changeClass}
                                "
                            >
                                ${formatSignedNumber(
                                    record.change
                                )}
                            </td>


                            <!-- PERCENTAGE CHANGE -->

                            <td
                                class="
                                    number
                                    ${percentageClass}
                                "
                            >
                                ${formatPercentage(
                                    record.percentage_change
                                )}
                            </td>


                            <!-- FINAL PRICE -->

                            <td class="number">
                                ${formatNumber(
                                    record.final_price
                                )}
                            </td>


                            <!-- NSE TIME -->

                            <td class="nse-time">
                                ${escapeHtml(
                                    record.last_update_time ||
                                    "—"
                                )}
                            </td>

                        </tr>
                    `;
                }
            )
            .join("");
}


// ============================================================
// RENDER NIFTY CONTRIBUTION TABLE
// ============================================================

function renderNiftyTable() {

    const niftyRecords =
        allRecords.filter(
            record =>
                record.is_nifty50
        );


    const sorted =
        [
            ...niftyRecords
        ].sort(
            (
                a,
                b
            ) => {

                const av =
                    Number(
                        a.contribution
                    );


                const bv =
                    Number(
                        b.contribution
                    );


                return bv - av;
            }
        );


    if (niftyTableInfo) {

        niftyTableInfo.textContent =
            `${sorted.length} ${selectedMarket === "sensex" ? "SENSEX" : "NIFTY 50"} constituents`;
    }


    if (!sorted.length) {

        niftyTableBody.innerHTML = `
            <tr>

                <td
                    colspan="6"
                    class="loading"
                >
                    Waiting for ${selectedMarket === "sensex" ? "SENSEX" : "NIFTY 50"} data...
                </td>

            </tr>
        `;

        return;
    }


    niftyTableBody.innerHTML =
        sorted
            .map(
                record => {

                    const percentageClass =
                        valueClass(
                            record.percentage_change
                        );


                    const contributionClass =
                        valueClass(
                            record.contribution
                        );


                    return `
                        <tr>

                            <td class="symbol">

                                ${escapeHtml(
                                    record.symbol ||
                                    "—"
                                )}

                            </td>


                            <td class="number">
                                ${formatWeight(
                                    record.weight_pct
                                )}
                            </td>


                            <td
                                class="
                                    number
                                    ${percentageClass}
                                "
                            >
                                ${formatPercentage(
                                    record.percentage_change
                                )}
                            </td>


                            <td
                                class="
                                    number
                                    ${contributionClass}
                                "
                            >
                                ${formatContribution(
                                    record.contribution
                                )}
                            </td>


                            <td class="number">
                                ${formatNumber(
                                    record.iep
                                )}
                            </td>


                            <td
                                class="
                                    number
                                    ${valueClass(
                                        record.change
                                    )}
                                "
                            >
                                ${formatSignedNumber(
                                    record.change
                                )}
                            </td>

                        </tr>
                    `;
                }
            )
            .join("");
}


// ============================================================
// FETCH DATA
// ============================================================

async function fetchData() {

    const requestId = marketRequestId;
    const requestMarket = selectedMarket;

    try {

        const response =
            await fetch(
                API_URL +
                "?market=" +
                encodeURIComponent(selectedMarket) +
                "&t=" +
                Date.now(),
                {
                    cache:
                        "no-store"
                }
            );


        if (!response.ok) {

            throw new Error(
                `HTTP ${response.status}`
            );
        }


        const payload =
            await response.json();

        if (
            requestId !== marketRequestId
            || requestMarket !== selectedMarket
        ) {
            return;
        }


        if (!payload.success) {

            throw new Error(
                payload.error ||
                "Dashboard API returned an error."
            );
        }


        allRecords =
            Array.isArray(
                payload.data
            )
                ? payload.data
                : [];


        // ----------------------------------------------------
        // Rebuild autocomplete symbols from actual API data
        // ----------------------------------------------------

        rebuildSymbolList();


        // ----------------------------------------------------
        // Update dashboard
        // ----------------------------------------------------

        updateSummary(
            payload
        );


        renderTable();

        renderNiftyTable();


        // ----------------------------------------------------
        // If user is currently typing, refresh suggestions
        // using the newest symbol list.
        // ----------------------------------------------------

        const currentQuery =
            searchInput.value
                .trim();


        if (currentQuery) {

            const matches =
                getSuggestionMatches(
                    currentQuery
                );


            if (matches.length) {

                showSuggestions(
                    matches,
                    currentQuery
                );

            } else {

                hideSuggestions();
            }
        }


        setConnectionStatus(
            "live",
            "Live"
        );


        hideError();

    } catch (error) {

        console.error(
            "Dashboard error:",
            error
        );

        if (requestId !== marketRequestId) {
            return;
        }

        updateSummary({
            market_name:
                selectedMarket === "sensex"
                    ? "SENSEX"
                    : "NIFTY 50",
            nifty50_count:
                selectedMarket === "sensex"
                    ? 30
                    : 50,
            data: [],
        });

        renderTable();
        renderNiftyTable();


        setConnectionStatus(
            "offline",
            "Disconnected"
        );


        showError(
            error.message
        );
    }
}


// ============================================================
// EVENTS
// ============================================================

marketSelect.addEventListener(
    "change",
    () => {
        selectedMarket = marketSelect.value;
        marketRequestId += 1;
        allRecords = [];

        updateSummary({
            market_name:
                selectedMarket === "sensex"
                    ? "SENSEX"
                    : "NIFTY 50",
            nifty50_count:
                selectedMarket === "sensex"
                    ? 30
                    : 50,
            data: [],
        });

        renderTable();
        renderNiftyTable();
        fetchData();
        fetchNiftyData();
    }
);

async function fetchNiftyData() {

    const requestId = marketRequestId;
    const requestMarket = selectedMarket;

    try {

        const response =
            await fetch(
                NIFTY_API_URL +
                "?market=" +
                encodeURIComponent(selectedMarket) +
                "&t=" +
                Date.now(),
                {
                    cache: "no-store"
                }
            );

        if (!response.ok) {

            throw new Error(
                `HTTP ${response.status}`
            );
        }

        const payload = await response.json();

        if (
            requestId !== marketRequestId
            || requestMarket !== selectedMarket
        ) {
            return;
        }

        if (!payload.success) {

            throw new Error(
                payload.error ||
                "NIFTY 50 API returned an error."
            );
        }

        updateLiveNifty(
            payload.data,
            payload.timestamp
        );

        setConnectionStatus(
            "live",
            "Live"
        );

    } catch (error) {

        console.error(
            "NIFTY 50 update error:",
            error
        );

        if (requestId !== marketRequestId) {
            return;
        }

        updateLiveNifty(
            null,
            null
        );

        setConnectionStatus(
            "offline",
            "Disconnected"
        );
    }
}


// ------------------------------------------------------------
// Search input
// ------------------------------------------------------------

searchInput.addEventListener(
    "input",
    updateSearchSuggestions
);


// ------------------------------------------------------------
// Search keyboard
// ------------------------------------------------------------

searchInput.addEventListener(
    "keydown",
    handleSearchKeyboard
);


// ------------------------------------------------------------
// Search focus
// ------------------------------------------------------------

searchInput.addEventListener(
    "focus",
    () => {

        const query =
            searchInput.value
                .trim()
                .toUpperCase();


        updateClearButton();


        if (!query) {
            return;
        }


        const matches =
            getSuggestionMatches(
                query
            );


        if (matches.length) {

            showSuggestions(
                matches,
                query
            );
        }
    }
);


// ------------------------------------------------------------
// Clear button
// ------------------------------------------------------------

clearSearch.addEventListener(
    "click",
    clearSearchValue
);


// ------------------------------------------------------------
// Change filter
// ------------------------------------------------------------

changeFilter.addEventListener(
    "change",
    renderTable
);


// ------------------------------------------------------------
// Sort
// ------------------------------------------------------------

sortSelect.addEventListener(
    "change",
    renderTable
);


// ------------------------------------------------------------
// Close autocomplete when clicking outside
// ------------------------------------------------------------

document.addEventListener(
    "click",
    event => {

        if (
            !event.target.closest(
                ".search-container"
            )
        ) {

            hideSuggestions();
        }
    }
);


// ============================================================
// INITIAL LOAD
// ============================================================

updateClearButton();

fetchData();

fetchNiftyData();


// ============================================================
// LIVE REFRESH
// ============================================================

setInterval(
    fetchData,
    REFRESH_INTERVAL
);

setInterval(
    fetchNiftyData,
    REFRESH_INTERVAL
);