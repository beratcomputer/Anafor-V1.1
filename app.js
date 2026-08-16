/* ============================================================
   ANAFOR V1.1 – Çoklu Anafor Takip Sistemi
   Application Logic
   ============================================================ */

(function () {
    'use strict';

    // ---- Constants ----
    const STORAGE_KEY = 'anafor_v1_1_data';
    const MONTHS_TR = [
        'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
        'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
    ];

    // ---- DOM References ----
    const $ = (id) => document.getElementById(id);

    const screenWelcome    = $('screenWelcome');
    const screenDashboard  = $('screenDashboard');
    const dashboardContent = $('dashboardContent');
    const headerDate       = $('headerDate');
    const fabAdd           = $('fabAdd');

    // Add modal
    const modalAdd         = $('modalAdd');
    const inputAnaforName  = $('inputAnaforName');
    const selectTarget     = $('selectTarget');
    const inputNewScript   = $('inputNewScript');
    const btnAddConfirm    = $('btnAddConfirm');
    const btnAddCancel     = $('btnAddCancel');

    // Move modal
    const modalMove        = $('modalMove');
    const moveAnaforName   = $('moveAnaforName');
    const selectMoveTarget = $('selectMoveTarget');
    const btnMoveConfirm   = $('btnMoveConfirm');
    const btnMoveCancel    = $('btnMoveCancel');

    // Confirm modal
    const modalConfirmOverlay = $('modalConfirmOverlay');
    const confirmText      = $('confirmText');
    const confirmYes       = $('confirmYes');
    const confirmNo        = $('confirmNo');

    // Finished section
    const finishedSection  = $('finishedSection');
    const finishedToggle   = $('finishedToggle');
    const finishedCount    = $('finishedCount');
    const finishedGrid     = $('finishedGrid');

    // Start button
    const btnStart         = $('btnStart');

    // Detail view
    const detailOverlay    = $('detailOverlay');
    const detailBack       = $('detailBack');
    const detailName       = $('detailName');
    const detailDates      = $('detailDates');
    const detailPctBadge   = $('detailPctBadge');
    const detailPctValue   = $('detailPctValue');
    const detailStatTotal  = $('detailStatTotal');
    const detailStatSuccess= $('detailStatSuccess');
    const detailStatFail   = $('detailStatFail');
    const detailStatStreak = $('detailStatStreak');
    const detailChart      = $('detailChart');
    const detailDailyChart = $('detailDailyChart');
    const detailHistoryGrid= $('detailHistoryGrid');

    // ---- Helpers ----

    /** Generate a simple unique ID. */
    function generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
    }

    /** Get today's date as YYYY-MM-DD string (local time). */
    function getTodayStr() {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    /** Parse a YYYY-MM-DD string into a Date object (midnight local). */
    function parseDate(str) {
        const [y, m, d] = str.split('-').map(Number);
        return new Date(y, m - 1, d);
    }

    /** Format a YYYY-MM-DD string for display. */
    function formatDate(str) {
        const d = parseDate(str);
        return `${d.getDate()} ${MONTHS_TR[d.getMonth()]} ${d.getFullYear()}`;
    }

    /** Format a YYYY-MM-DD string as short (day + month). */
    function formatDateShort(str) {
        const d = parseDate(str);
        return `${d.getDate()} ${MONTHS_TR[d.getMonth()].substring(0, 3)}`;
    }

    /** Count the number of calendar days between two YYYY-MM-DD strings. */
    function daysBetween(startStr, endStr) {
        const a = parseDate(startStr);
        const b = parseDate(endStr);
        return Math.round((b - a) / (1000 * 60 * 60 * 24));
    }

    /** Add N days to a date string. */
    function addDays(str, n) {
        const d = parseDate(str);
        d.setDate(d.getDate() + n);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    // ---- Data Layer ----

    function loadData() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return null;
            return JSON.parse(raw);
        } catch {
            return null;
        }
    }

    function saveData(data) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }

    function createEmptyData() {
        return {
            scripts: [],
            standaloneAnafors: [],
            finishedAnafors: []
        };
    }

    function createAnafor(name) {
        const today = getTodayStr();
        return {
            id: generateId(),
            name: name,
            startDate: today,
            history: [{ date: today, action: 'anafor' }],
            isFinished: false,
            finishedDate: null
        };
    }

    function createScript(name) {
        return {
            id: generateId(),
            name: name,
            createdAt: getTodayStr(),
            anafors: []
        };
    }

    // ---- Core Logic (Preserved Math) ----

    /**
     * Fill in any missed days (between last history entry and today) as 'fail'.
     * Same logic as V1.0 but works on individual anafor.
     */
    function fillMissedDays(anafor) {
        if (anafor.isFinished) return anafor;

        const today = getTodayStr();
        const lastEntry = anafor.history[anafor.history.length - 1];
        const lastDate = lastEntry.date;
        const gap = daysBetween(lastDate, today);

        for (let i = 1; i < gap; i++) {
            const missedDate = addDays(lastDate, i);
            anafor.history.push({ date: missedDate, action: 'fail' });
        }

        return anafor;
    }

    /** Compute success stats – same formula as V1.0. */
    function computeStats(history) {
        const total = history.length;
        const successes = history.filter(h => h.action === 'anafor').length;
        const pct = total > 0 ? Math.round((successes / total) * 100) : 0;
        return { total, successes, pct };
    }

    /** Compute script stats – average of active anafors' percentages. */
    function computeScriptStats(script) {
        const activeAnafors = script.anafors.filter(a => !a.isFinished);
        if (activeAnafors.length === 0) return { pct: 0, count: 0 };

        let totalPct = 0;
        activeAnafors.forEach(a => {
            const stats = computeStats(a.history);
            totalPct += stats.pct;
        });

        return {
            pct: Math.round(totalPct / activeAnafors.length),
            count: activeAnafors.length
        };
    }

    /** Check if user already acted today on a specific anafor. */
    function hasActedToday(anafor) {
        const today = getTodayStr();
        return anafor.history.some(h => h.date === today);
    }

    /** Can user act today? Only if today > startDate and hasn't acted yet. */
    function canActToday(anafor) {
        const today = getTodayStr();
        if (today === anafor.startDate && anafor.history.length === 1) return false;
        return !hasActedToday(anafor);
    }

    /** Is this the start day? */
    function isStartDay(anafor) {
        const today = getTodayStr();
        return today === anafor.startDate && anafor.history.length === 1;
    }

    /** Get bar color class based on percentage (Anafor). */
    function getBarColorClass(pct) {
        if (pct < 40) return 'bar-low';
        if (pct < 70) return 'bar-mid';
        return 'bar-high';
    }

    /** Get bar color class for Scripts (Betik). */
    function getScriptBarColorClass(pct) {
        if (pct < 40) return 'script-bar-low';
        if (pct < 70) return 'script-bar-mid';
        return 'script-bar-high';
    }

    /** Get pct text color class. */
    function getPctColorClass(pct) {
        if (pct < 40) return 'pct-color-low';
        if (pct < 70) return 'pct-color-mid';
        return 'pct-color-high';
    }

    // ---- Find & Modify Helpers ----

    /** Find an anafor by ID across all data. Returns { anafor, location, scriptId? } */
    function findAnafor(data, anaforId) {
        // Check standalones
        const sa = data.standaloneAnafors.find(a => a.id === anaforId);
        if (sa) return { anafor: sa, location: 'standalone', scriptId: null };

        // Check scripts
        for (const script of data.scripts) {
            const a = script.anafors.find(a => a.id === anaforId);
            if (a) return { anafor: a, location: 'script', scriptId: script.id };
        }

        return null;
    }

    /** Remove an anafor from wherever it is. Returns the anafor object. */
    function removeAnafor(data, anaforId) {
        // Check standalones
        const saIdx = data.standaloneAnafors.findIndex(a => a.id === anaforId);
        if (saIdx !== -1) {
            return data.standaloneAnafors.splice(saIdx, 1)[0];
        }

        // Check scripts
        for (const script of data.scripts) {
            const idx = script.anafors.findIndex(a => a.id === anaforId);
            if (idx !== -1) {
                return script.anafors.splice(idx, 1)[0];
            }
        }

        return null;
    }

    // ---- Rendering ----

    function showScreen(name) {
        screenWelcome.style.display   = name === 'welcome'   ? '' : 'none';
        screenDashboard.style.display = name === 'dashboard' ? '' : 'none';
        fabAdd.style.display          = name === 'dashboard' ? '' : 'none';
    }

    function renderDashboard() {
        const data = loadData();
        if (!data) {
            showScreen('welcome');
            return;
        }

        showScreen('dashboard');

        // Header date
        headerDate.textContent = formatDate(getTodayStr());

        // Fill missed days for all active anafors
        let changed = false;
        data.standaloneAnafors.forEach(a => {
            if (!a.isFinished) {
                const oldLen = a.history.length;
                fillMissedDays(a);
                if (a.history.length !== oldLen) changed = true;
            }
        });
        data.scripts.forEach(s => {
            s.anafors.forEach(a => {
                if (!a.isFinished) {
                    const oldLen = a.history.length;
                    fillMissedDays(a);
                    if (a.history.length !== oldLen) changed = true;
                }
            });
        });
        if (changed) saveData(data);

        // Build dashboard HTML
        let html = '';

        const hasScripts = data.scripts.length > 0;
        const hasStandalone = data.standaloneAnafors.length > 0;
        const hasAnything = hasScripts || hasStandalone;

        if (!hasAnything) {
            html += renderEmptyState();
        } else {
            // Render scripts
            if (hasScripts) {
                data.scripts.forEach(script => {
                    html += renderScriptCard(script);
                });
            }

            // Render standalone anafors
            if (hasStandalone) {
                if (hasScripts) {
                    html += `<div class="section-label">Bağımsız Anaforlar</div>`;
                }
                data.standaloneAnafors.forEach(anafor => {
                    html += renderAnaforCard(anafor, true);
                });
            }
        }

        dashboardContent.innerHTML = html;

        // Render finished section
        renderFinishedSection(data);

        // Attach dynamic event listeners
        attachDashboardEvents(data);
    }

    function renderEmptyState() {
        return `
            <div class="empty-state">
                <svg class="empty-state__icon" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                    <path class="vortex-outer" d="M50 10 L70 20 L85 40 L85 60 L70 80 L50 90 L30 80 L15 60 L15 40 L30 20 Z" stroke="currentColor" stroke-width="2" fill="none"/>
                    <path class="vortex-mid" d="M50 22 L63 29 L73 43 L73 57 L63 71 L50 78 L37 71 L27 57 L27 43 L37 29 Z" stroke="currentColor" stroke-width="1.5" fill="none"/>
                    <path class="vortex-inner" d="M50 34 L57 38 L62 46 L62 54 L57 62 L50 66 L43 62 L38 54 L38 46 L43 38 Z" stroke="currentColor" stroke-width="1" fill="none"/>
                </svg>
                <h3 class="empty-state__title">Henüz bir Anafor yok</h3>
                <p class="empty-state__text">Aşağıdaki "Anafor Ekle" butonuna tıklayarak ilk takip sürecini başlat.</p>
            </div>
        `;
    }

    function renderScriptCard(script) {
        const stats = computeScriptStats(script);
        const pctClass = getPctColorClass(stats.pct);
        const barClass = getScriptBarColorClass(stats.pct);
        const activeCount = script.anafors.filter(a => !a.isFinished).length;

        let anaforsHtml = '';
        script.anafors.forEach(a => {
            if (!a.isFinished) {
                anaforsHtml += renderAnaforCard(a, false);
            }
        });

        if (activeCount === 0) {
            anaforsHtml = `<div style="padding: 16px; text-align: center; color: var(--text-dim); font-size: 0.8rem;">Bu betikte aktif anafor yok.</div>`;
        }

        return `
            <div class="script-card" data-script-id="${script.id}">
                <div class="script-card__header" data-toggle-script="${script.id}">
                    <div class="script-card__expand">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="9 18 15 12 9 6"></polyline>
                        </svg>
                    </div>
                    <div class="script-card__info">
                        <div class="script-card__name">${escapeHtml(script.name)}</div>
                        <div class="script-card__meta">${activeCount} anafor</div>
                    </div>
                    <div class="script-card__pct ${pctClass}">${stats.pct}<span style="font-size:0.7em;color:var(--text-muted)">%</span></div>
                    <button class="script-card__menu-btn" data-script-menu="${script.id}" title="Menü">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <circle cx="12" cy="5" r="2"></circle>
                            <circle cx="12" cy="12" r="2"></circle>
                            <circle cx="12" cy="19" r="2"></circle>
                        </svg>
                    </button>
                </div>
                <div class="script-card__bar">
                    <div class="script-bar-track">
                        <div class="script-bar-fill ${barClass}" style="width: ${stats.pct}%;">
                            <div class="progress-bar-shimmer"></div>
                        </div>
                    </div>
                </div>
                <div class="script-card__body">
                    <div class="script-card__anafors">
                        ${anaforsHtml}
                    </div>
                </div>
            </div>
        `;
    }

    function renderAnaforCard(anafor, isStandalone) {
        const stats = computeStats(anafor.history);
        const pctClass = getPctColorClass(stats.pct);
        const barClass = getBarColorClass(stats.pct);
        const today = getTodayStr();
        const currentDay = daysBetween(anafor.startDate, today) + 1;
        const cardClass = isStandalone ? 'anafor-card anafor-card--standalone' : 'anafor-card';

        let actionsHtml = '';

        if (isStartDay(anafor)) {
            actionsHtml = `<div class="anafor-card__start-msg">🌀 Bugün başladı – yarın ilk kararını vereceksin.</div>`;
        } else if (canActToday(anafor)) {
            actionsHtml = `
                <div class="anafor-card__actions">
                    <button class="btn-check" data-anafor-action="anafor" data-anafor-id="${anafor.id}" title="Başarılı">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                        Anafor
                    </button>
                    <button class="btn-cross" data-anafor-action="fail" data-anafor-id="${anafor.id}" title="Başarısız">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                        Çarpı
                    </button>
                </div>
            `;
        } else if (hasActedToday(anafor)) {
            const todayEntry = anafor.history.find(h => h.date === today);
            if (todayEntry && todayEntry.action === 'anafor') {
                actionsHtml = `<div class="anafor-card__acted success"><span class="anafor-card__acted-icon">✓</span> Bugün Anafor'a bastın</div>`;
            } else {
                actionsHtml = `<div class="anafor-card__acted fail"><span class="anafor-card__acted-icon">✕</span> Bugün çarpıya bastın</div>`;
            }
        }

        return `
            <div class="${cardClass}" data-anafor-id="${anafor.id}">
                <div class="anafor-card__top">
                    <span class="anafor-card__name">${escapeHtml(anafor.name)}</span>
                    <span class="anafor-card__day">Gün ${currentDay}</span>
                    <span class="anafor-card__pct ${pctClass}">${stats.pct}<span style="font-size:0.65em;color:var(--text-muted)">%</span></span>
                    <button class="anafor-card__menu-btn" data-anafor-menu="${anafor.id}" title="Menü">⋯</button>
                </div>
                <div class="anafor-card__stats">
                    <span class="anafor-card__stat">${stats.successes} başarı / ${stats.total} gün</span>
                </div>
                <div class="mini-bar-track">
                    <div class="mini-bar-fill ${barClass}" style="width: ${stats.pct}%;">
                        <div class="progress-bar-shimmer"></div>
                    </div>
                </div>
                ${actionsHtml}
            </div>
        `;
    }

    function renderFinishedSection(data) {
        const finished = data.finishedAnafors || [];

        if (finished.length === 0) {
            finishedSection.style.display = 'none';
            return;
        }

        finishedSection.style.display = '';
        finishedCount.textContent = finished.length;

        let html = '';
        finished.forEach(anafor => {
            const stats = computeStats(anafor.history);
            const pctClass = getPctColorClass(stats.pct);
            const barClass = getBarColorClass(stats.pct);
            const startStr = formatDateShort(anafor.startDate);
            const endStr = formatDateShort(anafor.finishedDate);
            const originLabel = anafor.originScriptName ? anafor.originScriptName : '';

            let historyDotsHtml = '';
            anafor.history.forEach(h => {
                const cls = h.action === 'anafor' ? 'history-dot--success' : 'history-dot--fail';
                historyDotsHtml += `<div class="history-dot ${cls}" title="${formatDate(h.date)}"></div>`;
            });

            html += `
                <div class="finished-card" data-finished-id="${anafor.id}" style="cursor:pointer;" title="Detaylı görünüm için tıkla">
                    <div class="finished-card__top">
                        <span class="finished-card__name">${escapeHtml(anafor.name)}</span>
                        ${originLabel ? `<span class="finished-card__origin">${escapeHtml(originLabel)}</span>` : ''}
                        <span class="finished-card__pct ${pctClass}">${stats.pct}<span style="font-size:0.6em;color:var(--text-muted)">%</span></span>
                    </div>
                    <div class="finished-card__dates">${startStr} – ${endStr}</div>
                    <div class="finished-card__stats">${stats.successes} başarı / ${stats.total} gün</div>
                    <div class="finished-card__bar">
                        <div class="mini-bar-track">
                            <div class="mini-bar-fill ${barClass}" style="width: ${stats.pct}%;">
                                <div class="progress-bar-shimmer"></div>
                            </div>
                        </div>
                    </div>
                    <div class="finished-card__history">
                        ${historyDotsHtml}
                    </div>
                </div>
            `;
        });

        finishedGrid.innerHTML = html;

        // Attach click events to finished cards for detail view
        document.querySelectorAll('[data-finished-id]').forEach(card => {
            card.addEventListener('click', () => {
                const anaforId = card.dataset.finishedId;
                showDetailView(anaforId, true);
            });
        });
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // ---- Dashboard Event Attachment ----

    function attachDashboardEvents(data) {
        // Script toggle (expand/collapse)
        document.querySelectorAll('[data-toggle-script]').forEach(el => {
            el.addEventListener('click', (e) => {
                // Don't toggle if clicking menu button
                if (e.target.closest('[data-script-menu]')) return;
                const scriptId = el.dataset.toggleScript;
                const card = document.querySelector(`.script-card[data-script-id="${scriptId}"]`);
                if (card) card.classList.toggle('expanded');
            });
        });

        // Anafor action buttons (check/fail)
        document.querySelectorAll('[data-anafor-action]').forEach(btn => {
            btn.addEventListener('click', () => {
                const anaforId = btn.dataset.anaforId;
                const action = btn.dataset.anaforAction;
                handleAnaforAction(anaforId, action);
            });
        });

        // Anafor menu buttons
        document.querySelectorAll('[data-anafor-menu]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const anaforId = btn.dataset.anaforMenu;
                showAnaforContextMenu(e, anaforId);
            });
        });

        // Script menu buttons
        document.querySelectorAll('[data-script-menu]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const scriptId = btn.dataset.scriptMenu;
                showScriptContextMenu(e, scriptId);
            });
        });
    }

    // ---- Actions ----

    function handleAnaforAction(anaforId, action) {
        const data = loadData();
        if (!data) return;

        const found = findAnafor(data, anaforId);
        if (!found) return;

        const anafor = found.anafor;
        if (anafor.isFinished || hasActedToday(anafor)) return;

        if (action === 'fail') {
            showConfirm('Bugünü çarpı olarak işaretlemek istediğine emin misin?', () => {
                const freshData = loadData();
                const freshFound = findAnafor(freshData, anaforId);
                if (!freshFound) return;

                const today = getTodayStr();
                freshFound.anafor.history.push({ date: today, action: 'fail' });
                saveData(freshData);
                renderDashboard();
                showToast('Bugün çarpı olarak işaretlendi ✕');
            });
        } else {
            const today = getTodayStr();
            anafor.history.push({ date: today, action: 'anafor' });
            saveData(data);
            renderDashboard();
            showToast('Harika! Bugün Anafor\'a bastın ✓');
        }
    }

    function handleFinishAnafor(anaforId) {
        const data = loadData();
        if (!data) return;

        const found = findAnafor(data, anaforId);
        if (!found) return;

        showConfirm(`"${found.anafor.name}" anaforunu bitirmek istediğine emin misin?`, () => {
            const freshData = loadData();
            const anafor = removeAnafor(freshData, anaforId);
            if (!anafor) return;

            // Fill missed days up to today
            fillMissedDays(anafor);
            const today = getTodayStr();
            if (!hasActedToday(anafor)) {
                anafor.history.push({ date: today, action: 'fail' });
            }

            anafor.isFinished = true;
            anafor.finishedDate = today;

            // Find origin script name
            let originName = null;
            for (const s of (loadData() || createEmptyData()).scripts) {
                if (s.anafors.some(a => a.id === anaforId)) {
                    originName = s.name;
                    break;
                }
            }
            // Use the found object's location info from before removal
            if (found.location === 'script') {
                const origScript = (loadData() || createEmptyData()).scripts.find(s => s.id === found.scriptId);
                originName = origScript ? origScript.name : null;
            }
            // Actually get it from freshData before removal happened... 
            // We need to determine this before removing. Let's recalculate:
            const origData = loadData(); // This is stale since we already modified freshData
            // Let's simplify - store origin from found info
            anafor.originScriptName = found.location === 'script' 
                ? (data.scripts.find(s => s.id === found.scriptId) || {}).name || null 
                : null;

            freshData.finishedAnafors = freshData.finishedAnafors || [];
            freshData.finishedAnafors.push(anafor);

            // Clean up empty scripts
            freshData.scripts = freshData.scripts.filter(s => s.anafors.length > 0 || true); // Keep even empty scripts

            saveData(freshData);
            renderDashboard();
            showToast(`"${anafor.name}" bitirildi! 🎉`);
        });
    }

    function handleMoveAnafor(anaforId) {
        const data = loadData();
        if (!data) return;

        const found = findAnafor(data, anaforId);
        if (!found) return;

        moveAnaforName.textContent = `"${found.anafor.name}" anaforunu taşı`;

        // Populate move target select
        selectMoveTarget.innerHTML = '<option value="standalone">Bağımsız</option>';
        data.scripts.forEach(s => {
            // Don't show current script as option
            if (found.location === 'script' && found.scriptId === s.id) return;
            const opt = document.createElement('option');
            opt.value = s.id;
            opt.textContent = s.name;
            selectMoveTarget.appendChild(opt);
        });

        // Pre-select current location
        if (found.location === 'standalone') {
            selectMoveTarget.value = 'standalone'; // will select first available non-standalone if possible
        }

        currentMoveAnaforId = anaforId;
        modalMove.style.display = '';
    }

    function handleDeleteScript(scriptId) {
        const data = loadData();
        if (!data) return;

        const script = data.scripts.find(s => s.id === scriptId);
        if (!script) return;

        const activeCount = script.anafors.filter(a => !a.isFinished).length;
        let msg = `"${script.name}" betiğini silmek istediğine emin misin?`;
        if (activeCount > 0) {
            msg += ` İçindeki ${activeCount} anafor bağımsız hale getirilecek.`;
        }

        showConfirm(msg, () => {
            const freshData = loadData();
            const s = freshData.scripts.find(s => s.id === scriptId);
            if (!s) return;

            // Move all anafors to standalone
            s.anafors.forEach(a => {
                freshData.standaloneAnafors.push(a);
            });

            freshData.scripts = freshData.scripts.filter(s => s.id !== scriptId);
            saveData(freshData);
            renderDashboard();
            showToast(`"${script.name}" betiği silindi`);
        });
    }

    // ---- Context Menus ----

    let activeContextMenu = null;

    function closeContextMenu() {
        if (activeContextMenu) {
            activeContextMenu.overlay.remove();
            activeContextMenu.menu.remove();
            activeContextMenu = null;
        }
    }

    function showAnaforContextMenu(event, anaforId) {
        closeContextMenu();

        const menu = document.createElement('div');
        menu.className = 'context-menu';

        menu.innerHTML = `
            <button class="context-menu__item" data-ctx-action="detail">
                <span class="context-menu__icon">📊</span>
                Detaylı Görünüm
            </button>
            <button class="context-menu__item" data-ctx-action="move">
                <span class="context-menu__icon">↗</span>
                Taşı
            </button>
            <button class="context-menu__item context-menu__item--danger" data-ctx-action="finish">
                <span class="context-menu__icon">■</span>
                Bitir
            </button>
        `;

        const overlay = document.createElement('div');
        overlay.className = 'context-menu-overlay';
        overlay.addEventListener('click', closeContextMenu);

        document.body.appendChild(overlay);
        document.body.appendChild(menu);

        // Position menu
        const rect = event.target.closest('button').getBoundingClientRect();
        menu.style.top = (rect.bottom + 4) + 'px';
        menu.style.right = (window.innerWidth - rect.right) + 'px';

        // Ensure menu is within viewport
        requestAnimationFrame(() => {
            const menuRect = menu.getBoundingClientRect();
            if (menuRect.bottom > window.innerHeight) {
                menu.style.top = (rect.top - menuRect.height - 4) + 'px';
            }
            if (menuRect.left < 0) {
                menu.style.right = 'auto';
                menu.style.left = '8px';
            }
        });

        activeContextMenu = { menu, overlay };

        menu.querySelector('[data-ctx-action="detail"]').addEventListener('click', () => {
            closeContextMenu();
            showDetailView(anaforId, false);
        });

        menu.querySelector('[data-ctx-action="move"]').addEventListener('click', () => {
            closeContextMenu();
            handleMoveAnafor(anaforId);
        });

        menu.querySelector('[data-ctx-action="finish"]').addEventListener('click', () => {
            closeContextMenu();
            handleFinishAnafor(anaforId);
        });
    }

    function showScriptContextMenu(event, scriptId) {
        closeContextMenu();

        const menu = document.createElement('div');
        menu.className = 'context-menu';

        menu.innerHTML = `
            <button class="context-menu__item context-menu__item--danger" data-ctx-action="delete">
                <span class="context-menu__icon">🗑</span>
                Betiği Sil
            </button>
        `;

        const overlay = document.createElement('div');
        overlay.className = 'context-menu-overlay';
        overlay.addEventListener('click', closeContextMenu);

        document.body.appendChild(overlay);
        document.body.appendChild(menu);

        const rect = event.target.closest('button').getBoundingClientRect();
        menu.style.top = (rect.bottom + 4) + 'px';
        menu.style.right = (window.innerWidth - rect.right) + 'px';

        activeContextMenu = { menu, overlay };

        menu.querySelector('[data-ctx-action="delete"]').addEventListener('click', () => {
            closeContextMenu();
            handleDeleteScript(scriptId);
        });
    }

    // ---- Modals ----

    // Confirm modal
    let confirmCallback = null;

    function showConfirm(text, onConfirm) {
        confirmText.textContent = text;
        modalConfirmOverlay.style.display = '';
        confirmCallback = onConfirm;
    }

    function hideConfirm() {
        modalConfirmOverlay.style.display = 'none';
        confirmCallback = null;
    }

    confirmYes.addEventListener('click', () => {
        if (confirmCallback) confirmCallback();
        hideConfirm();
    });

    confirmNo.addEventListener('click', hideConfirm);

    modalConfirmOverlay.addEventListener('click', (e) => {
        if (e.target === modalConfirmOverlay) hideConfirm();
    });

    // Add modal
    let currentMoveAnaforId = null;

    function openAddModal() {
        const data = loadData() || createEmptyData();

        // Populate target select
        selectTarget.innerHTML = '<option value="standalone">Bağımsız</option>';
        data.scripts.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.id;
            opt.textContent = s.name;
            selectTarget.appendChild(opt);
        });

        inputAnaforName.value = '';
        inputNewScript.value = '';
        btnAddConfirm.disabled = true;
        modalAdd.style.display = '';

        setTimeout(() => inputAnaforName.focus(), 100);
    }

    function closeAddModal() {
        modalAdd.style.display = 'none';
        inputAnaforName.value = '';
        inputNewScript.value = '';
    }

    // Enable/disable add button based on input
    function updateAddButtonState() {
        const hasName = inputAnaforName.value.trim().length > 0;
        btnAddConfirm.disabled = !hasName;
    }

    inputAnaforName.addEventListener('input', updateAddButtonState);

    // If new script name is typed, reset target select to standalone
    inputNewScript.addEventListener('input', () => {
        if (inputNewScript.value.trim().length > 0) {
            selectTarget.value = 'standalone';
        }
    });

    // If a script is selected from dropdown, clear new script input
    selectTarget.addEventListener('change', () => {
        if (selectTarget.value !== 'standalone') {
            inputNewScript.value = '';
        }
    });

    btnAddConfirm.addEventListener('click', () => {
        const name = inputAnaforName.value.trim();
        if (!name) return;

        const data = loadData() || createEmptyData();
        const newAnafor = createAnafor(name);
        const newScriptName = inputNewScript.value.trim();

        if (newScriptName) {
            // Create new script and add anafor to it
            const script = createScript(newScriptName);
            script.anafors.push(newAnafor);
            data.scripts.push(script);
        } else if (selectTarget.value === 'standalone') {
            data.standaloneAnafors.push(newAnafor);
        } else {
            // Add to existing script
            const script = data.scripts.find(s => s.id === selectTarget.value);
            if (script) {
                script.anafors.push(newAnafor);
            } else {
                data.standaloneAnafors.push(newAnafor);
            }
        }

        saveData(data);
        closeAddModal();
        renderDashboard();
        showToast(`"${name}" anaforu eklendi! 🌀`);
    });

    btnAddCancel.addEventListener('click', closeAddModal);

    modalAdd.addEventListener('click', (e) => {
        if (e.target === modalAdd) closeAddModal();
    });

    // Move modal
    btnMoveConfirm.addEventListener('click', () => {
        if (!currentMoveAnaforId) return;

        const data = loadData();
        if (!data) return;

        const anafor = removeAnafor(data, currentMoveAnaforId);
        if (!anafor) return;

        const targetId = selectMoveTarget.value;

        if (targetId === 'standalone') {
            data.standaloneAnafors.push(anafor);
        } else {
            const script = data.scripts.find(s => s.id === targetId);
            if (script) {
                script.anafors.push(anafor);
            } else {
                data.standaloneAnafors.push(anafor);
            }
        }

        saveData(data);
        closeMoveModal();
        renderDashboard();
        showToast(`"${anafor.name}" taşındı!`);
    });

    function closeMoveModal() {
        modalMove.style.display = 'none';
        currentMoveAnaforId = null;
    }

    btnMoveCancel.addEventListener('click', closeMoveModal);

    modalMove.addEventListener('click', (e) => {
        if (e.target === modalMove) closeMoveModal();
    });

    // ---- Detail View ----

    function showDetailView(anaforId, isFinished) {
        const data = loadData();
        if (!data) return;

        let anafor = null;

        if (isFinished) {
            anafor = (data.finishedAnafors || []).find(a => a.id === anaforId);
        } else {
            const found = findAnafor(data, anaforId);
            if (found) anafor = found.anafor;
        }

        if (!anafor) return;

        // Fill missed days for active anafors
        if (!anafor.isFinished) {
            fillMissedDays(anafor);
        }

        const stats = computeStats(anafor.history);
        const fails = stats.total - stats.successes;
        const bestStreak = computeBestStreak(anafor.history);
        const pctClass = getPctColorClass(stats.pct);

        // Header
        detailName.textContent = anafor.name;
        const endDate = anafor.isFinished ? anafor.finishedDate : getTodayStr();
        detailDates.textContent = `${formatDate(anafor.startDate)} – ${formatDate(endDate)}`;
        detailPctValue.textContent = stats.pct;
        detailPctValue.className = `detail-view__pct-value ${pctClass}`;

        // Stats
        detailStatTotal.textContent = stats.total;
        detailStatSuccess.textContent = stats.successes;
        detailStatFail.textContent = fails;
        detailStatStreak.textContent = bestStreak;

        // Draw timeline chart
        drawTimelineChart(anafor.history);

        // Daily bar chart
        renderDailyBarChart(anafor.history);

        // History grid
        renderDetailHistoryGrid(anafor.history);

        // Show overlay
        detailOverlay.style.display = '';
        fabAdd.style.display = 'none';
    }

    function hideDetailView() {
        detailOverlay.style.display = 'none';
        const data = loadData();
        if (data) {
            fabAdd.style.display = '';
        }
    }

    detailBack.addEventListener('click', hideDetailView);

    /** Compute the best consecutive success streak. */
    function computeBestStreak(history) {
        let best = 0;
        let current = 0;
        history.forEach(h => {
            if (h.action === 'anafor') {
                current++;
                if (current > best) best = current;
            } else {
                current = 0;
            }
        });
        return best;
    }

    /** Compute running percentage at each day. */
    function computeRunningPct(history) {
        const points = [];
        let successes = 0;
        history.forEach((h, i) => {
            if (h.action === 'anafor') successes++;
            const pct = Math.round((successes / (i + 1)) * 100);
            points.push({ day: i + 1, date: h.date, pct: pct, action: h.action });
        });
        return points;
    }

    /** Draw the timeline chart on canvas. */
    function drawTimelineChart(history) {
        const container = detailChart.parentElement;
        const dpr = window.devicePixelRatio || 1;
        const w = container.clientWidth;
        const h = container.clientHeight;

        detailChart.width = w * dpr;
        detailChart.height = h * dpr;
        detailChart.style.width = w + 'px';
        detailChart.style.height = h + 'px';

        const ctx = detailChart.getContext('2d');
        ctx.scale(dpr, dpr);

        const points = computeRunningPct(history);
        if (points.length === 0) return;

        const padLeft = 36;
        const padRight = 12;
        const padTop = 12;
        const padBottom = 28;
        const chartW = w - padLeft - padRight;
        const chartH = h - padTop - padBottom;

        // Clear
        ctx.clearRect(0, 0, w, h);

        // Zone backgrounds
        const zones = [
            { min: 0, max: 40, color: 'rgba(255, 82, 82, 0.04)' },
            { min: 40, max: 70, color: 'rgba(253, 203, 110, 0.04)' },
            { min: 70, max: 100, color: 'rgba(0, 230, 118, 0.04)' }
        ];

        zones.forEach(zone => {
            const y1 = padTop + chartH * (1 - zone.max / 100);
            const y2 = padTop + chartH * (1 - zone.min / 100);
            ctx.fillStyle = zone.color;
            ctx.fillRect(padLeft, y1, chartW, y2 - y1);
        });

        // Grid lines
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
        ctx.lineWidth = 1;
        [0, 25, 50, 75, 100].forEach(pct => {
            const y = padTop + chartH * (1 - pct / 100);
            ctx.beginPath();
            ctx.moveTo(padLeft, y);
            ctx.lineTo(padLeft + chartW, y);
            ctx.stroke();

            // Label
            ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
            ctx.font = '10px "JetBrains Mono", monospace';
            ctx.textAlign = 'right';
            ctx.textBaseline = 'middle';
            ctx.fillText(pct + '%', padLeft - 6, y);
        });

        // Zone threshold lines
        ctx.setLineDash([4, 4]);
        ctx.lineWidth = 1;

        // 40% line
        ctx.strokeStyle = 'rgba(255, 82, 82, 0.2)';
        let threshY = padTop + chartH * (1 - 40 / 100);
        ctx.beginPath();
        ctx.moveTo(padLeft, threshY);
        ctx.lineTo(padLeft + chartW, threshY);
        ctx.stroke();

        // 70% line
        ctx.strokeStyle = 'rgba(0, 230, 118, 0.2)';
        threshY = padTop + chartH * (1 - 70 / 100);
        ctx.beginPath();
        ctx.moveTo(padLeft, threshY);
        ctx.lineTo(padLeft + chartW, threshY);
        ctx.stroke();

        ctx.setLineDash([]);

        // Line chart
        const maxDays = points.length;
        const getX = (i) => padLeft + (i / Math.max(maxDays - 1, 1)) * chartW;
        const getY = (pct) => padTop + chartH * (1 - pct / 100);

        // Gradient fill under line
        const gradient = ctx.createLinearGradient(0, padTop, 0, padTop + chartH);
        gradient.addColorStop(0, 'rgba(108, 92, 231, 0.2)');
        gradient.addColorStop(1, 'rgba(108, 92, 231, 0.0)');

        ctx.beginPath();
        ctx.moveTo(getX(0), padTop + chartH);
        points.forEach((p, i) => {
            ctx.lineTo(getX(i), getY(p.pct));
        });
        ctx.lineTo(getX(points.length - 1), padTop + chartH);
        ctx.closePath();
        ctx.fillStyle = gradient;
        ctx.fill();

        // Main line
        ctx.beginPath();
        points.forEach((p, i) => {
            const x = getX(i);
            const y = getY(p.pct);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.strokeStyle = '#a29bfe';
        ctx.lineWidth = 2;
        ctx.lineJoin = 'round';
        ctx.stroke();

        // Dots for each day
        points.forEach((p, i) => {
            const x = getX(i);
            const y = getY(p.pct);
            const isSuccess = p.action === 'anafor';

            ctx.beginPath();
            ctx.arc(x, y, 3, 0, Math.PI * 2);
            ctx.fillStyle = isSuccess ? '#00e676' : '#ff5252';
            ctx.fill();
        });

        // X-axis labels (show subset for readability)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.font = '9px "Inter", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';

        const labelInterval = Math.max(1, Math.floor(points.length / 8));
        points.forEach((p, i) => {
            if (i === 0 || i === points.length - 1 || i % labelInterval === 0) {
                const x = getX(i);
                ctx.fillText('G' + p.day, x, padTop + chartH + 8);
            }
        });
    }

    /** Render daily bar chart. */
    function renderDailyBarChart(history) {
        let html = '';
        history.forEach((h, i) => {
            const isSuccess = h.action === 'anafor';
            const cls = isSuccess ? 'daily-bar--success' : 'daily-bar--fail';
            const height = isSuccess ? '100%' : '40%';
            html += `<div class="daily-bar ${cls}" style="height:${height}" title="Gün ${i + 1}: ${formatDate(h.date)} – ${isSuccess ? 'Başarı' : 'Çarpı'}"></div>`;
        });
        detailDailyChart.innerHTML = html;
    }

    /** Render detail history grid (calendar-like). */
    function renderDetailHistoryGrid(history) {
        let html = '';
        history.forEach((h, i) => {
            const isSuccess = h.action === 'anafor';
            const cls = isSuccess ? 'detail-history-cell--success' : 'detail-history-cell--fail';
            const icon = isSuccess ? '✓' : '✕';
            const d = parseDate(h.date);
            const dayNum = d.getDate();
            const monthShort = MONTHS_TR[d.getMonth()].substring(0, 3);

            html += `
                <div class="detail-history-cell ${cls}" title="Gün ${i + 1}: ${formatDate(h.date)}">
                    <span class="detail-history-cell__day">${icon}</span>
                    <span class="detail-history-cell__date">${dayNum} ${monthShort}</span>
                </div>
            `;
        });
        detailHistoryGrid.innerHTML = html;
    }

    // ---- Toast ----

    function showToast(message, durationMs = 2500) {
        const existing = document.querySelector('.toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('hide');
            setTimeout(() => toast.remove(), 300);
        }, durationMs);
    }

    // ---- Event Handlers ----

    // Welcome → Dashboard
    btnStart.addEventListener('click', () => {
        const data = createEmptyData();
        saveData(data);
        renderDashboard();
        showToast('Anafor hazır! İlk takip sürecini ekle. 🌀');
    });

    // FAB - Add anafor
    fabAdd.addEventListener('click', openAddModal);

    // Finished toggle
    finishedToggle.addEventListener('click', () => {
        const isOpen = finishedGrid.style.display !== 'none';
        finishedGrid.style.display = isOpen ? 'none' : '';
        finishedToggle.classList.toggle('open', !isOpen);
    });

    // ---- Init ----

    function init() {
        const data = loadData();

        if (!data) {
            showScreen('welcome');
            return;
        }

        renderDashboard();
    }

    // Run
    init();

})();
