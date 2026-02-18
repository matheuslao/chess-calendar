/**
 * Cavaleiros do Centro - Calendar Script
 * Wrapped in IIFE to avoid polluting global scope.
 */
(function () {
    'use strict';

    // Configuration
    const SPREADSHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQV98v6jJrnyYRGE2E9yjc0aw1nWDUvjtT6UN6hTkGU3SsZ386uH7owYHxKwVXNhPXGGYpjxY8wCA35/pub?gid=366704952&single=true&output=csv';
    const CACHE_KEY = 'chess_calendar_cache';
    const CACHE_TTL = 10 * 60 * 1000; // 10 minutes
    const REQUEST_TIMEOUT = 15000; // 15 seconds

    // State
    let allEvents = [];
    let currentMonth = new Date().getMonth();
    let currentYear = new Date().getFullYear();
    let deepLinkHandled = false;

    // DOM Elements
    let loadingState, errorState, calendarWrapper, calendarGrid, monthYearLabel;
    let prevMonthBtn, nextMonthBtn, todayBtn, retryBtn;
    let modalOverlay, modalBody, modalCloseBtn;

    // Initialize App
    document.addEventListener('DOMContentLoaded', function () {
        loadingState = document.getElementById('loading');
        errorState = document.getElementById('error-message');
        calendarWrapper = document.getElementById('calendar-wrapper');
        calendarGrid = document.getElementById('calendar-grid');
        monthYearLabel = document.getElementById('month-year-label');
        prevMonthBtn = document.getElementById('prev-month');
        nextMonthBtn = document.getElementById('next-month');
        todayBtn = document.getElementById('today-btn');
        retryBtn = document.getElementById('retry-btn');

        modalOverlay = document.getElementById('event-modal');
        modalBody = document.getElementById('modal-body');
        modalCloseBtn = document.getElementById('close-modal');

        init();
    });

    function init() {
        loadEvents();

        if (retryBtn) retryBtn.addEventListener('click', loadEvents);
        if (prevMonthBtn) prevMonthBtn.addEventListener('click', function () { changeMonth(-1); });
        if (nextMonthBtn) nextMonthBtn.addEventListener('click', function () { changeMonth(1); });
        if (todayBtn) todayBtn.addEventListener('click', goToToday);

        // Modal listeners
        if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeModal);
        if (modalOverlay) {
            modalOverlay.addEventListener('click', function (e) {
                if (e.target === modalOverlay) closeModal();
            });
        }
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && modalOverlay && !modalOverlay.classList.contains('hidden')) {
                closeModal();
            }
        });

        // Event delegation on calendar grid
        if (calendarGrid) {
            calendarGrid.addEventListener('click', function (e) {
                var dot = e.target.closest('.event-dot');
                if (!dot) return;

                var idx = dot.dataset.eventIndex;
                if (idx !== undefined && allEvents[idx]) {
                    var ev = allEvents[idx];
                    openModal(ev, ev.date);
                }
            });
        }

        // Handle URL hash changes (e.g., clicking a shared link)
        window.addEventListener('hashchange', function () {
            checkDeepLink(true);
        });
    }

    function goToToday() {
        var now = new Date();
        currentMonth = now.getMonth();
        currentYear = now.getFullYear();
        renderCalendar();
    }

    function changeMonth(delta) {
        currentMonth += delta;
        if (currentMonth < 0) {
            currentMonth = 11;
            currentYear--;
        } else if (currentMonth > 11) {
            currentMonth = 0;
            currentYear++;
        }
        renderCalendar();
    }

    // --- Data Loading with Cache & Timeout ---
    function loadEvents() {
        showLoading();

        // Try cache first
        var cached = getCache();
        if (cached) {
            processEvents(cached);
            showContent();
            renderCalendar();
            // Still refresh in background
            fetchCSV(true);
            return;
        }

        fetchCSV(false);
    }

    function fetchCSV(isBackground) {
        var timedOut = false;
        var timeoutId = setTimeout(function () {
            timedOut = true;
            if (!isBackground) showError();
        }, REQUEST_TIMEOUT);

        Papa.parse(SPREADSHEET_URL, {
            download: true,
            header: true,
            skipEmptyLines: true,
            complete: function (results) {
                clearTimeout(timeoutId);
                if (timedOut && !isBackground) return;

                if (results.data && results.data.length > 0) {
                    setCache(results.data);
                    processEvents(results.data);
                    if (!isBackground) {
                        showContent();
                    }
                    renderCalendar();
                } else if (!isBackground) {
                    showError();
                }
            },
            error: function (err) {
                clearTimeout(timeoutId);
                console.error('PapaParse Error:', err);
                if (!isBackground) showError();
            }
        });
    }

    // --- LocalStorage Cache ---
    function getCache() {
        try {
            var raw = localStorage.getItem(CACHE_KEY);
            if (!raw) return null;
            var parsed = JSON.parse(raw);
            if (Date.now() - parsed.timestamp > CACHE_TTL) return null;
            return parsed.data;
        } catch (e) {
            return null;
        }
    }

    function setCache(data) {
        try {
            localStorage.setItem(CACHE_KEY, JSON.stringify({
                timestamp: Date.now(),
                data: data
            }));
        } catch (e) {
            // Storage full or unavailable — ignore
        }
    }

    // --- Data Processing ---
    function processEvents(data) {
        allEvents = data
            .filter(function (row) { return row['Nome do Evento'] && row['Nome do Evento'].trim() !== ''; })
            .map(function (event) {
                var dateStr = event['Data'] || '';
                var timestamp = parseDateForSort(dateStr || event['Timestamp']);

                if (!timestamp) return null;

                var dateObj = new Date(timestamp);

                return {
                    raw: event,
                    date: dateObj,
                    day: dateObj.getDate(),
                    month: dateObj.getMonth(),
                    year: dateObj.getFullYear(),
                    timestamp: timestamp,
                    id: 'ev' + timestamp
                };
            })
            .filter(function (item) { return item !== null; });
    }

    // --- Calendar Rendering ---
    function renderCalendar() {
        calendarGrid.innerHTML = '';
        monthYearLabel.textContent = formatMonthYear(currentMonth, currentYear);

        // Update "Today" button visibility
        var now = new Date();
        if (todayBtn) {
            var isCurrentMonth = currentMonth === now.getMonth() && currentYear === now.getFullYear();
            todayBtn.classList.toggle('hidden', isCurrentMonth);
        }

        var firstDay = new Date(currentYear, currentMonth, 1);
        var lastDay = new Date(currentYear, currentMonth + 1, 0);
        var daysInMonth = lastDay.getDate();
        var startingDay = firstDay.getDay();

        // Previous month fillers (with events)
        var prevMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
        var prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
        var prevMonthLastDay = new Date(currentYear, currentMonth, 0).getDate();
        for (var i = startingDay - 1; i >= 0; i--) {
            var dayNum = prevMonthLastDay - i;
            var cell = createDayCell(dayNum, 'other-month');
            appendEventsToCell(cell, dayNum, prevMonth, prevMonthYear);
            calendarGrid.appendChild(cell);
        }

        // Current month days
        for (var d = 1; d <= daysInMonth; d++) {
            var isToday = (d === now.getDate() && currentMonth === now.getMonth() && currentYear === now.getFullYear());
            var cell = createDayCell(d, isToday ? 'today' : '');
            appendEventsToCell(cell, d, currentMonth, currentYear);
            calendarGrid.appendChild(cell);
        }

        // Next month fillers (with events)
        var totalCells = startingDay + daysInMonth;
        var nextMonthDays = (7 - (totalCells % 7)) % 7;
        var nextMonthVal = currentMonth === 11 ? 0 : currentMonth + 1;
        var nextMonthYear = currentMonth === 11 ? currentYear + 1 : currentYear;
        for (var n = 1; n <= nextMonthDays; n++) {
            var cell = createDayCell(n, 'other-month');
            appendEventsToCell(cell, n, nextMonthVal, nextMonthYear);
            calendarGrid.appendChild(cell);
        }

        // Apply transition animation
        calendarGrid.classList.remove('calendar-fade');
        // Force reflow
        void calendarGrid.offsetWidth;
        calendarGrid.classList.add('calendar-fade');
            // After rendering, check if URL contains a deep link to open
            checkDeepLink();
    }

        // Try to open event from URL hash or ?event=ID
        function checkDeepLink(force) {
            if (deepLinkHandled && !force) return;
            var hash = window.location.hash || '';
            var params = new URLSearchParams(window.location.search);
            var id = '';
            if (hash && hash.startsWith('#')) id = hash.substring(1);
            if (!id && params.has('event')) id = params.get('event');
            if (!id) return;
            deepLinkHandled = true;
            openEventById(id);
        }

        function openEventById(id) {
            if (!id) return;
            var foundIdx = allEvents.findIndex(function (e) { return e.id === id; });
            if (foundIdx === -1) return;
            var ev = allEvents[foundIdx];
            // Move calendar to event month/year then render
            currentMonth = ev.month;
            currentYear = ev.year;
            renderCalendar();
            // After render, find the element and scroll/open
            setTimeout(function () {
                var el = document.querySelector('[data-event-id="' + id + '"]');
                if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                openModal(ev, ev.date);
            }, 60);
        }

    function appendEventsToCell(cell, day, month, year) {
        var dayEvents = allEvents.filter(function (e) {
            return e.day === day && e.month === month && e.year === year;
        });

        if (dayEvents.length === 0) return;

        var dotsContainer = document.createElement('div');
        dotsContainer.className = 'event-dots';

        dayEvents.forEach(function (event) {
            var idx = allEvents.indexOf(event);
            var dot = document.createElement('span');
            dot.className = 'event-dot ' + getEventTypeClass(event.raw['Tipo do Evento']);
            dot.textContent = event.raw['Nome do Evento'];
            dot.dataset.eventIndex = idx;
            if (event.id) dot.dataset.eventId = event.id;
            dot.setAttribute('role', 'button');
            dot.setAttribute('tabindex', '0');
            dot.setAttribute('aria-label', 'Ver detalhes: ' + event.raw['Nome do Evento']);
            dotsContainer.appendChild(dot);

            // Small share link next to the dot
            // (share icon removed from calendar view per user request)
        });

        cell.appendChild(dotsContainer);
    }

    function createDayCell(number, extraClass) {
        var div = document.createElement('div');
        div.className = 'day-cell ' + extraClass;
        div.innerHTML = '<span class="day-number">' + number + '</span>';
        return div;
    }

    function getEventTypeClass(type) {
        if (!type) return 'default';
        var lower = type.toLowerCase();
        if (lower.includes('torneio')) return 'tournament';
        if (lower.includes('encontro') || lower.includes('clube')) return 'meetup';
        return 'other';
    }

    // --- Modal ---
    function openModal(eventObj, dateObj) {
        modalBody.innerHTML = '';
        var card = createEventDetails(eventObj, dateObj);
        modalBody.appendChild(card);
        // After inserting details, wire up share/copy button if present
        var copyBtn = modalBody.querySelector('.copy-share-btn');
        if (copyBtn) {
            var originalCopyLabel = copyBtn.textContent;
            copyBtn.addEventListener('click', function () {
                var shareUrl = window.location.origin + window.location.pathname + '#' + (eventObj.id || '');
                try {
                    navigator.clipboard.writeText(shareUrl);
                    copyBtn.textContent = 'Copiado!';
                    setTimeout(function () { copyBtn.textContent = originalCopyLabel; }, 1500);
                } catch (e) {
                    // fallback: select and prompt (rare since we no longer render an input)
                    var input = modalBody.querySelector('.share-url-input');
                    if (input) {
                        input.select();
                        document.execCommand('copy');
                        copyBtn.textContent = 'Copiado!';
                        setTimeout(function () { copyBtn.textContent = originalCopyLabel; }, 1500);
                    }
                }
            });
        }
        modalOverlay.classList.remove('hidden');
        document.body.style.overflow = 'hidden';

        // Focus trap
        var focusableEls = modalOverlay.querySelectorAll('button, a[href], [tabindex]:not([tabindex="-1"])');
        if (focusableEls.length > 0) {
            focusableEls[0].focus();
        }
        modalOverlay._focusTrap = function (e) {
            if (e.key !== 'Tab') return;
            var first = focusableEls[0];
            var last = focusableEls[focusableEls.length - 1];
            if (e.shiftKey) {
                if (document.activeElement === first) {
                    e.preventDefault();
                    last.focus();
                }
            } else {
                if (document.activeElement === last) {
                    e.preventDefault();
                    first.focus();
                }
            }
        };
        document.addEventListener('keydown', modalOverlay._focusTrap);
    }

    function closeModal() {
        modalOverlay.classList.add('hidden');
        document.body.style.overflow = '';
        if (modalOverlay._focusTrap) {
            document.removeEventListener('keydown', modalOverlay._focusTrap);
        }
    }

    function formatMonthYear(monthIndex, year) {
        var months = [
            'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
            'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
        ];
        return months[monthIndex] + ' ' + year;
    }

    // --- Event Detail Card (no inline styles) ---
    function createEventDetails(eventObj, dateObj) {
        var div = document.createElement('div');

        var event = eventObj.raw || {};
        var name = event['Nome do Evento'] || 'Evento Sem Nome';
        var location = event['Local'] || 'Local não informado';
        var link = event['Link do Evento'] || '';
        var type = event['Tipo do Evento'] || 'Evento';
        var cost = event['Custo'] || '';
        var organizer = event['Realização'] || '';
        var description = event['Breve Descrição'] || '';
        var timeStr = event['Hora de início'] || '';

        var dateFormatted = dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
        var isoDate = dateObj.toISOString().split('T')[0];
        var fullTime = timeStr ? dateFormatted + ' às ' + timeStr : dateFormatted;

        var typeBadgeClass = getEventTypeClass(type) === 'tournament' ? 'badge-tournament' :
            (getEventTypeClass(type) === 'meetup' ? 'badge-meetup' : 'badge-default');

        var costBadgeHtml = (cost && cost.toLowerCase().includes('gratuito'))
            ? '<span class="badge badge-free">Gratuito</span>' : '';

        var ratingHtml = '';
        if (event['Rating?']) {
            ratingHtml = '<div class="rating-info">⚡ Rating!</div>';
        }

        var organizerHtml = organizer ? '<div class="event-organizer"><span>♟️</span><span>' + escapeHtml(organizer) + '</span></div>' : '';
        var linkHtml = link ? '<a href="' + escapeHtml(link) + '" target="_blank" rel="noopener noreferrer" class="event-link">Mais Informações</a>' : '';

        var shareUrl = (eventObj.id) ? window.location.origin + window.location.pathname + '#' + eventObj.id : '';
        var shareHtml = '';
        if (shareUrl) {
            // Simple share button with icon — no visible URL or external anchor
            shareHtml = '<div class="event-share-row" style="margin-top:1rem;display:flex;justify-content:flex-end">'
                + '<button class="copy-share-btn share-btn" aria-label="Copiar link" style="display:inline-flex;align-items:center;gap:0.5rem;padding:0.4rem 0.6rem;border-radius:6px;border:none;background:var(--primary-dark);color:#fff;font-weight:600;">'
                + '🔗 <span style="font-size:0.7rem">Copiar Link</span>'
                + '</button>'
                + '</div>';
        }

        var html =
            '<div style="display:flex;align-items:center;justify-content:space-between;gap:1rem">'
                + '<h2 class="event-title modal-title" style="margin:0">' + escapeHtml(name) + '</h2>'
                + (shareHtml ? '' : '')
            + '</div>'
            + '<div class="event-meta-top modal-meta">'
                + '<div class="modal-datetime">'
                    + '📅 <time datetime="' + isoDate + '">' + fullTime + '</time>'
                + '</div>'
                + '<div class="badges-container">'
                    + '<span class="badge ' + typeBadgeClass + '">' + escapeHtml(type) + '</span>'
                    + costBadgeHtml
                    + ratingHtml
                + '</div>'
            + '</div>'
            + '<div class="event-description">'
                + '<p>' + escapeHtml(description) + '</p>'
            + '</div>'
            + organizerHtml
            + '<div class="event-location modal-location">'
                + '<span>📍</span><span>' + escapeHtml(location) + '</span>'
            + '</div>'
            + linkHtml + shareHtml;

        div.innerHTML = html;
        return div;
    }

    // --- UI State Helpers ---
    function showLoading() {
        loadingState.classList.remove('hidden');
        errorState.classList.add('hidden');
        calendarWrapper.classList.add('hidden');
    }

    function showContent() {
        loadingState.classList.add('hidden');
        errorState.classList.add('hidden');
        calendarWrapper.classList.remove('hidden');
    }

    function showError() {
        loadingState.classList.add('hidden');
        errorState.classList.remove('hidden');
        calendarWrapper.classList.add('hidden');
    }

    // --- Date Parsing ---
    function parseDateForSort(dateString) {
        if (!dateString) return null;

        if (dateString.includes('/')) {
            var parts = dateString.split('/');
            if (parts.length === 3) {
                var p0 = parseInt(parts[0], 10);
                var p1 = parseInt(parts[1], 10);
                var p2 = parseInt(parts[2], 10);
                if (!isNaN(p0) && !isNaN(p1) && !isNaN(p2)) {
                    // Detect format: if first part > 12, it's DD/MM/YYYY (Brazilian)
                    // Otherwise default to MM/DD/YYYY (American, Google Sheets default)
                    if (p0 > 12) {
                        // DD/MM/YYYY
                        return new Date(p2, p1 - 1, p0).getTime();
                    } else if (p1 > 12) {
                        // MM/DD/YYYY (American) where day > 12
                        return new Date(p2, p0 - 1, p1).getTime();
                    } else {
                        // Ambiguous — default to MM/DD/YYYY (Google Sheets export default)
                        return new Date(p2, p0 - 1, p1).getTime();
                    }
                }
            }
        }

        if (dateString.includes('-')) {
            var parts = dateString.split('-');
            if (parts.length === 3 && parts[0].length === 4) {
                var year = parseInt(parts[0], 10);
                var month = parseInt(parts[1], 10);
                var day = parseInt(parts[2], 10);
                if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
                    return new Date(year, month - 1, day).getTime();
                }
            }
        }

        var timestamp = Date.parse(dateString);
        if (!isNaN(timestamp)) return timestamp;

        return null;
    }

    function escapeHtml(text) {
        if (!text) return '';
        return text.toString()
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

})();
