/* ============================================================
   ANAFOR V1.1 – Çoklu Anafor Takip Sistemi
   Application Logic
   ============================================================ */

(function () {
    'use strict';

    // ---- Constants ----
    const STORAGE_KEY = 'anafor_v1_1_data';
    const NOTES_STORAGE_KEY = 'anafor_v1_1_dev_notes';
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

    // Tab bar
    const tabBar           = $('tabBar');
    const screenTimeline   = $('screenTimeline');
    const screenNotes      = $('screenNotes');
    const screenSettings   = $('screenSettings');
    const timelineHeaderDate = $('timelineHeaderDate');
    const tlFilters        = $('tlFilters');
    const tlContent        = $('tlContent');
    const settingsStats    = $('settingsStats');
    const btnExport        = $('btnExport');
    const btnImport        = $('btnImport');
    const importFileInput  = $('importFileInput');
    const btnClearAll      = $('btnClearAll');

    // Notes DOM
    const notesInput       = $('notesInput');
    const notesStatus      = $('notesStatus');
    const notesWordCount   = $('notesWordCount');
    const btnCopyNotes     = $('btnCopyNotes');
    const btnClearNotes    = $('btnClearNotes');

    let currentTab = 'dashboard';
    let currentTlFilter = 'all';

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
        screenTimeline.style.display  = name === 'timeline'  ? '' : 'none';
        screenNotes.style.display     = name === 'notes'     ? '' : 'none';
        screenSettings.style.display  = name === 'settings'  ? '' : 'none';
        fabAdd.style.display          = name === 'dashboard' ? '' : 'none';
        tabBar.style.display          = name === 'welcome'   ? 'none' : '';
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
        const barClass = getBarColorClass(stats.pct);
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
                        <div class="script-card__title-line">
                            <span class="card-badge card-badge--script">BETİK</span>
                            <span class="script-card__name">${escapeHtml(script.name)}</span>
                        </div>
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
                    <div class="anafor-card__title-line">
                        ${isStandalone ? `<span class="card-badge card-badge--anafor">ANAFOR</span>` : ''}
                        <span class="anafor-card__name">${escapeHtml(anafor.name)}</span>
                    </div>
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
        switchTab('dashboard');
        showToast('Anafor hazır! İlk takip sürecini ekle. 🌀');
    });

    // FAB - Add anafor
    fabAdd.addEventListener('click', openAddModal);

    // ---- Tab Navigation ----

    function switchTab(tabName) {
        currentTab = tabName;

        // Update tab bar active state
        document.querySelectorAll('.tab-bar__item').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });

        const data = loadData();
        if (!data) {
            showScreen('welcome');
            return;
        }

        showScreen(tabName);

        if (tabName === 'dashboard') {
            renderDashboard();
        } else if (tabName === 'timeline') {
            renderTimeline();
        } else if (tabName === 'notes') {
            renderNotes();
        } else if (tabName === 'settings') {
            renderSettings();
        }
    }

    // Tab bar click handlers (Event delegation)
    tabBar.addEventListener('click', (e) => {
        const btn = e.target.closest('.tab-bar__item');
        if (!btn || !btn.dataset.tab) return;
        switchTab(btn.dataset.tab);
    });

    // ---- Timeline ----

    // Filter chip handlers (Event delegation)
    tlFilters.addEventListener('click', (e) => {
        const chip = e.target.closest('[data-tl-filter]');
        if (!chip) return;
        currentTlFilter = chip.dataset.tlFilter;
        tlFilters.querySelectorAll('[data-tl-filter]').forEach(c => {
            c.classList.toggle('active', c.dataset.tlFilter === currentTlFilter);
        });
        renderTimeline();
    });

    function renderTimeline() {
        const data = loadData();
        if (!data) return;

        timelineHeaderDate.textContent = formatDate(getTodayStr());

        // Fill missed days
        data.standaloneAnafors.forEach(a => { if (!a.isFinished) fillMissedDays(a); });
        data.scripts.forEach(s => s.anafors.forEach(a => { if (!a.isFinished) fillMissedDays(a); }));

        const items = buildTimelineItems(data);

        if (items.length === 0) {
            tlContent.innerHTML = '<div class="tl-empty">Henüz gösterilecek bir şey yok.<br>Ana sayfadan yeni anafor veya betik ekleyerek başla.</div>';
            return;
        }

        // Find global date range
        const today = getTodayStr();
        let globalStart = today;
        let globalEnd = today;
        items.forEach(item => {
            if (item.startDate < globalStart) globalStart = item.startDate;
            if (item.endDate > globalEnd) globalEnd = item.endDate;
        });

        // Add 1 to totalDays so each day has a visible slot
        const totalSpanDays = Math.max(daysBetween(globalStart, globalEnd) + 1, 1);

        // Build axis
        const axisLabels = buildAxisLabels(globalStart, globalEnd, totalSpanDays - 1);

        let html = '';

        // Axis header
        html += `
            <div class="tl-axis">
                <div class="tl-axis__label">Ad</div>
                <div class="tl-axis__dates">
                    ${axisLabels.map(l => `<span>${l}</span>`).join('')}
                </div>
            </div>
        `;

        // Sort items: active first, then by start date
        items.sort((a, b) => {
            if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
            return a.startDate < b.startDate ? -1 : 1;
        });

        // Render rows
        items.forEach(item => {
            const startOffset = daysBetween(globalStart, item.startDate);
            const itemDuration = Math.max(daysBetween(item.startDate, item.endDate) + 1, 1);

            const leftPct = (startOffset / totalSpanDays) * 100;
            const widthPct = Math.min(Math.max((itemDuration / totalSpanDays) * 100, 4), 100 - leftPct);

            const barTypeClass = item.type === 'script' ? 'tl-row__bar--script' : 'tl-row__bar--standalone';
            const barStateClass = item.isActive ? 'tl-row__bar--active' : 'tl-row__bar--finished';
            const badgeClass = item.type === 'script' ? 'tl-row__badge--script' : 'tl-row__badge--standalone';
            const badgeLabel = item.type === 'script' ? 'Betik' : 'Bağımsız';

            html += `
                <div class="tl-row" data-tl-item-id="${item.id}" data-tl-item-type="${item.type}">
                    <div class="tl-row__info">
                        <div class="tl-row__name" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</div>
                        <div class="tl-row__meta">
                            <span class="tl-row__badge ${badgeClass}">${badgeLabel}</span>
                            ${item.pct}%
                        </div>
                    </div>
                    <div class="tl-row__bar-area">
                        <div class="tl-row__bar ${barTypeClass} ${barStateClass}" style="left: ${leftPct}%; width: ${widthPct}%;">
                            ${widthPct > 12 ? `<span class="tl-row__bar-pct">${item.pct}%</span>` : ''}
                        </div>
                    </div>
                </div>
            `;
        });

        tlContent.innerHTML = html;

        // Attach click events for detail view
        document.querySelectorAll('.tl-row').forEach(row => {
            row.addEventListener('click', () => {
                const itemId = row.dataset.tlItemId;
                const itemType = row.dataset.tlItemType;
                // For standalone anafors (active or finished), show detail
                if (itemType === 'standalone') {
                    const data = loadData();
                    // Check if it's active standalone
                    const activeStandalone = data.standaloneAnafors.find(a => a.id === itemId);
                    if (activeStandalone) {
                        showDetailView(itemId, false);
                    } else {
                        // Check finished
                        const finished = (data.finishedAnafors || []).find(a => a.id === itemId);
                        if (finished) {
                            showDetailView(itemId, true);
                        }
                    }
                }
                // For scripts, we don't open detail for now
            });
        });
    }

    function buildTimelineItems(data) {
        const today = getTodayStr();
        const items = [];

        // Active scripts
        if (currentTlFilter === 'all' || currentTlFilter === 'scripts') {
            data.scripts.forEach(script => {
                const stats = computeScriptStats(script);
                // Find earliest anafor start and latest end within this script
                let earliest = script.createdAt || today;
                script.anafors.forEach(a => {
                    if (a.startDate < earliest) earliest = a.startDate;
                });

                items.push({
                    id: script.id,
                    name: script.name,
                    type: 'script',
                    startDate: earliest,
                    endDate: today,
                    pct: stats.pct,
                    isActive: true,
                    count: stats.count
                });
            });
        }

        // Active standalone anafors
        if (currentTlFilter === 'all' || currentTlFilter === 'standalone') {
            data.standaloneAnafors.forEach(anafor => {
                const stats = computeStats(anafor.history);
                items.push({
                    id: anafor.id,
                    name: anafor.name,
                    type: 'standalone',
                    startDate: anafor.startDate,
                    endDate: today,
                    pct: stats.pct,
                    isActive: true
                });
            });
        }

        // Finished anafors (only standalone ones - those without originScriptName)
        if (currentTlFilter === 'all' || currentTlFilter === 'standalone') {
            (data.finishedAnafors || []).forEach(anafor => {
                // Skip if it belonged to a script
                if (anafor.originScriptName) return;

                const stats = computeStats(anafor.history);
                items.push({
                    id: anafor.id,
                    name: anafor.name,
                    type: 'standalone',
                    startDate: anafor.startDate,
                    endDate: anafor.finishedDate || today,
                    pct: stats.pct,
                    isActive: false
                });
            });
        }

        return items;
    }

    function buildAxisLabels(startStr, endStr, totalDays) {
        const labels = [];
        const labelCount = Math.min(totalDays + 1, 6);
        const step = totalDays / (labelCount - 1);

        for (let i = 0; i < labelCount; i++) {
            const dayOffset = Math.round(i * step);
            const dateStr = addDays(startStr, dayOffset);
            labels.push(formatDateShort(dateStr));
        }

        return labels;
    }

    // ---- Settings ----

    function renderSettings() {
        const data = loadData();
        if (!data) return;

        // Count stats
        let totalAnafors = data.standaloneAnafors.length;
        data.scripts.forEach(s => { totalAnafors += s.anafors.length; });
        const totalScripts = data.scripts.length;
        const totalFinished = (data.finishedAnafors || []).length;

        settingsStats.innerHTML = `
            <div class="settings-stat">
                <span class="settings-stat__value settings-stat__value--accent">${totalAnafors}</span>
                <span class="settings-stat__label">Aktif Anafor</span>
            </div>
            <div class="settings-stat">
                <span class="settings-stat__value settings-stat__value--success">${totalScripts}</span>
                <span class="settings-stat__label">Betik</span>
            </div>
            <div class="settings-stat">
                <span class="settings-stat__value settings-stat__value--warning">${totalFinished}</span>
                <span class="settings-stat__label">Bitirilen</span>
            </div>
        `;
    }

    // ---- Notes (Geliştirici Notları) ----

    function loadNotes() {
        try {
            return localStorage.getItem(NOTES_STORAGE_KEY) || '';
        } catch {
            return '';
        }
    }

    function saveNotes(text) {
        try {
            localStorage.setItem(NOTES_STORAGE_KEY, text);
        } catch (e) {
            console.error('Notlar kaydedilemedi:', e);
        }
    }

    function updateNotesMeta(text) {
        const chars = text.length;
        const words = text.trim() ? text.trim().split(/\s+/).length : 0;
        notesWordCount.textContent = `${words} kelime, ${chars} karakter`;
    }

    let notesSaveTimeout = null;

    function renderNotes() {
        const savedText = loadNotes();
        notesInput.value = savedText;
        updateNotesMeta(savedText);
        notesStatus.textContent = savedText ? 'Otomatik kaydedildi ✓' : 'Otomatik kaydedilir';
    }

    notesInput.addEventListener('input', () => {
        const text = notesInput.value;
        updateNotesMeta(text);
        notesStatus.textContent = 'Kaydediliyor...';

        clearTimeout(notesSaveTimeout);
        notesSaveTimeout = setTimeout(() => {
            saveNotes(text);
            notesStatus.textContent = 'Kaydedildi ✓';
        }, 300);
    });

    btnCopyNotes.addEventListener('click', async () => {
        const text = notesInput.value;
        if (!text) {
            showToast('Kopyalanacak not yok.');
            return;
        }
        try {
            await navigator.clipboard.writeText(text);
            showToast('Notlar panoya kopyalandı! 📋');
        } catch {
            notesInput.select();
            document.execCommand('copy');
            showToast('Notlar kopyalandı! 📋');
        }
    });

    btnClearNotes.addEventListener('click', () => {
        if (!notesInput.value.trim()) return;
        showConfirm('Tüm geliştirici notlarını silmek istediğine emin misin?', () => {
            notesInput.value = '';
            saveNotes('');
            updateNotesMeta('');
            notesStatus.textContent = 'Temizlendi';
            showToast('Notlar temizlendi.');
        });
    });

    // Export data
    btnExport.addEventListener('click', () => {
        const data = loadData();
        if (!data) {
            showToast('Dışa aktarılacak veri yok.');
            return;
        }

        // Include developer notes in the backup object
        const backupData = {
            ...data,
            devNotes: loadNotes()
        };

        const json = JSON.stringify(backupData, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `anafor_backup_${getTodayStr()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast('Veriler ve notlar dışa aktarıldı! 📁');
    });

    // Import data
    btnImport.addEventListener('click', () => {
        importFileInput.click();
    });

    importFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const imported = JSON.parse(ev.target.result);
                // Basic validation
                if (!imported.scripts && !imported.standaloneAnafors) {
                    showToast('Geçersiz veri dosyası!');
                    return;
                }

                showConfirm('Mevcut veriler içe aktarılan verilerle değiştirilecek. Devam etmek istiyor musun?', () => {
                    if (typeof imported.devNotes === 'string') {
                        saveNotes(imported.devNotes);
                    }
                    saveData(imported);
                    switchTab('dashboard');
                    showToast('Veriler başarıyla içe aktarıldı! ✅');
                });
            } catch {
                showToast('Dosya okunamadı!');
            }
        };
        reader.readAsText(file);
        importFileInput.value = ''; // Reset
    });

    // Clear all data
    btnClearAll.addEventListener('click', () => {
        showConfirm('TÜM verİLER ve notlar sİlİnecek! Bu işlem geri alınamaz. Emin misin?', () => {
            localStorage.removeItem(STORAGE_KEY);
            localStorage.removeItem(NOTES_STORAGE_KEY);
            showScreen('welcome');
            showToast('Tüm veriler silindi.');
        });
    });

    // ---- Init ----

    function init() {
        const data = loadData();

        if (!data) {
            showScreen('welcome');
            return;
        }

        switchTab('dashboard');
    }

    // Run
    init();

})();
