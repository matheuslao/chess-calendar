/**
 * Cavaleiros do Centro - Calendar Script
 */

// Configuration
const SPREADSHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQV98v6jJrnyYRGE2E9yjc0aw1nWDUvjtT6UN6hTkGU3SsZ386uH7owYHxKwVXNhPXGGYpjxY8wCA35/pub?gid=366704952&single=true&output=csv';

// State
let allEvents = [];
let currentMonth = new Date().getMonth(); // 0-11
let currentYear = new Date().getFullYear();

// DOM Elements vars (init on load)
let loadingState, errorState, calendarWrapper, calendarGrid, monthYearLabel;
let prevMonthBtn, nextMonthBtn, retryBtn;
let modalOverlay, modalBody, modalCloseBtn;

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    // Assign DOM elements
    loadingState = document.getElementById('loading');
    errorState = document.getElementById('error-message');
    calendarWrapper = document.getElementById('calendar-wrapper');
    calendarGrid = document.getElementById('calendar-grid');
    monthYearLabel = document.getElementById('month-year-label');
    prevMonthBtn = document.getElementById('prev-month');
    nextMonthBtn = document.getElementById('next-month');
    retryBtn = document.getElementById('retry-btn');

    // Modal Elements
    modalOverlay = document.getElementById('event-modal');
    modalBody = document.getElementById('modal-body');
    modalCloseBtn = document.getElementById('close-modal');

    init();
});

function init() {
    loadEvents();
    if (retryBtn) retryBtn.addEventListener('click', loadEvents);
    if (prevMonthBtn) prevMonthBtn.addEventListener('click', () => changeMonth(-1));
    if (nextMonthBtn) nextMonthBtn.addEventListener('click', () => changeMonth(1));

    // Modal Listeners
    if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeModal);
    if (modalOverlay) {
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) closeModal();
        });
    }
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !modalOverlay.classList.contains('hidden')) {
            closeModal();
        }
    });
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

function loadEvents() {
    showLoading();

    Papa.parse(SPREADSHEET_URL, {
        download: true,
        header: true,
        skipEmptyLines: true,
        complete: function (results) {
            if (results.data && results.data.length > 0) {
                processEvents(results.data);
                showContent();
                renderCalendar();
            } else {
                showError();
            }
        },
        error: function (err) {
            console.error('PapaParse Error:', err);
            showError();
        }
    });
}

function processEvents(data) {
    allEvents = data
        .filter(row => row['Nome do Evento'] && row['Nome do Evento'].trim() !== '')
        .map(event => {
            const dateStr = event['Data'] || '';
            const timestamp = parseDateForSort(dateStr || event['Timestamp']);

            if (!timestamp) return null;

            // Create a Date object from timestamp
            const dateObj = new Date(timestamp);

            return {
                raw: event,
                date: dateObj,
                day: dateObj.getDate(),
                month: dateObj.getMonth(),
                year: dateObj.getFullYear(),
                timestamp: timestamp
            };
        })
        .filter(item => item !== null);
}

function renderCalendar() {
    calendarGrid.innerHTML = '';
    monthYearLabel.textContent = formatMonthYear(currentMonth, currentYear);

    // First day of the month
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);

    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay(); // 0 (Sun) to 6 (Sat)

    // Previous Month Fillers
    const prevMonthLastDay = new Date(currentYear, currentMonth, 0).getDate();
    for (let i = startingDay - 1; i >= 0; i--) {
        const dayNum = prevMonthLastDay - i;
        const cell = createDayCell(dayNum, 'other-month');
        calendarGrid.appendChild(cell);
    }

    // Current Month Days
    const today = new Date();
    for (let i = 1; i <= daysInMonth; i++) {
        const isToday = (i === today.getDate() && currentMonth === today.getMonth() && currentYear === today.getFullYear());
        const cell = createDayCell(i, isToday ? 'today' : '');

        // Find events for this day
        const dayEvents = allEvents.filter(e =>
            e.day === i && e.month === currentMonth && e.year === currentYear
        );

        if (dayEvents.length > 0) {
            const dotsContainer = document.createElement('div');
            dotsContainer.className = 'event-dots';

            dayEvents.forEach(event => {
                const dot = document.createElement('span');
                dot.className = `event-dot ${getEventTypeClass(event.raw['Tipo do Evento'])}`;
                dot.textContent = event.raw['Nome do Evento'];

                // Add click listener to the specific event dot
                dot.addEventListener('click', (e) => {
                    e.stopPropagation(); // Prevent bubbling if we added click to cell later
                    openModal(event.raw, event.date);
                });

                dotsContainer.appendChild(dot);
            });
            cell.appendChild(dotsContainer);
        }

        calendarGrid.appendChild(cell);
    }

    // Next Month Fillers (to complete grid)
    const totalCells = startingDay + daysInMonth;
    const nextMonthDays = (7 - (totalCells % 7)) % 7;
    for (let i = 1; i <= nextMonthDays; i++) {
        const cell = createDayCell(i, 'other-month');
        calendarGrid.appendChild(cell);
    }
}

function createDayCell(number, extraClass) {
    const div = document.createElement('div');
    div.className = `day-cell ${extraClass}`;
    div.innerHTML = `<span class="day-number">${number}</span>`;
    return div;
}

function getEventTypeClass(type) {
    if (!type) return 'default';
    const lower = type.toLowerCase();
    if (lower.includes('torneio')) return 'tournament';
    if (lower.includes('encontro') || lower.includes('clube')) return 'meetup';
    return 'other';
}

function openModal(eventData, dateObj) {
    modalBody.innerHTML = '';
    const card = createEventDetails(eventData, dateObj);
    modalBody.appendChild(card);
    modalOverlay.classList.remove('hidden');
    // Prevent background scrolling
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    modalOverlay.classList.add('hidden');
    document.body.style.overflow = '';
}

function formatMonthYear(monthIndex, year) {
    const months = [
        'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    return `${months[monthIndex]} ${year}`;
}

// Prepare content for modal
function createEventDetails(event, dateObj) {
    const div = document.createElement('div');

    const name = event['Nome do Evento'] || 'Evento Sem Nome';
    const location = event['Local'] || 'Local não informado';
    const link = event['Link do Evento'] || '';
    const type = event['Tipo do Evento'] || 'Evento';
    const cost = event['Custo'] || '';
    const organizer = event['Realização'] || '';
    const description = event['Breve Descrição'] || '';
    const timeStr = event['Hora de início'] || '';

    // Format Date nicely
    const dateFormatted = dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
    const fullTime = timeStr ? `${dateFormatted} às ${timeStr}` : dateFormatted;

    // Badge
    let typeBadgeClass = getEventTypeClass(type) === 'tournament' ? 'badge-tournament' :
        (getEventTypeClass(type) === 'meetup' ? 'badge-meetup' : 'badge-default');

    let costBadgeHtml = (cost && cost.toLowerCase().includes('gratuito'))
        ? `<span class="badge badge-free">Gratuito</span>` : '';

    let organizerHtml = organizer ? `
        <div class="event-organizer">
            <span>♟️</span><span>${escapeHtml(organizer)}</span>
        </div>` : '';

    let linkHtml = link ? `
        <a href="${escapeHtml(link)}" target="_blank" class="event-link">Mais Informações</a>` : '';

    div.innerHTML = `
        <div class="event-meta-top">
            <span class="event-date">${fullTime}</span>
            <div class="badges-container">
                <span class="badge ${typeBadgeClass}">${escapeHtml(type)}</span>
                ${costBadgeHtml}
            </div>
        </div>
        <h2 class="event-title">${escapeHtml(name)}</h2>
        <div class="event-description">
            <p>${escapeHtml(description)}</p>
        </div>
        ${organizerHtml}
        <div class="event-location" style="margin-top: 1rem;">
            <span>📍</span><span>${escapeHtml(location)}</span>
        </div>
        ${linkHtml}
    `;
    return div;
}

// -- Helpers (same as before) --
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

// Helper to parse date for sorting (timestamp)
function parseDateForSort(dateString) {
    if (!dateString) return 0;
    if (dateString.includes('/')) {
        const parts = dateString.split('/');
        if (parts.length === 3) {
            const month = parseInt(parts[0], 10);
            const day = parseInt(parts[1], 10);
            const year = parseInt(parts[2], 10);
            if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
                return new Date(year, month - 1, day).getTime();
            }
        }
    }
    if (dateString.includes('-')) {
        const parts = dateString.split('-');
        if (parts.length === 3 && parts[0].length === 4) {
            const year = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10);
            const day = parseInt(parts[2], 10);
            return new Date(year, month - 1, day).getTime();
        }
    }
    let timestamp = Date.parse(dateString);
    if (!isNaN(timestamp)) return timestamp;
    return 0;
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
