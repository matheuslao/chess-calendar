/**
 * Cavaleiros do Centro - Calendar Script
 */

// Configuration
// Using the new, user-provided CSV URL
const SPREADSHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQV98v6jJrnyYRGE2E9yjc0aw1nWDUvjtT6UN6hTkGU3SsZ386uH7owYHxKwVXNhPXGGYpjxY8wCA35/pub?gid=366704952&single=true&output=csv';
const REFRESH_INTERVAL = 300000; // 5 minutes

// DOM Elements
const loadingState = document.getElementById('loading');
const errorState = document.getElementById('error-message');
const eventsContainer = document.getElementById('events-container');
const retryBtn = document.getElementById('retry-btn');

// Initialize App
document.addEventListener('DOMContentLoaded', init);

function init() {
    loadEvents();
    retryBtn.addEventListener('click', loadEvents);
}

function loadEvents() {
    showLoading();

    Papa.parse(SPREADSHEET_URL, {
        download: true,
        header: true, // Expect headers in first row
        skipEmptyLines: true,
        complete: function (results) {
            console.log('CSV Parsed:', results);
            if (results.data && results.data.length > 0) {
                renderEvents(results.data);
            } else {
                console.warn('No data found or empty. Using Mock Data for demo.');
                useMockData();
            }
        },
        error: function (err) {
            console.error('PapaParse Error:', err);
            useMockData();
        }
    }); // fixed syntax
}

function useMockData() {
    // Schema matches the real CSV headers we observed
    // Headers: Timestamp, Email Address, Nome do Evento, Data, Hora de início, Hora de término, Local, Custo, Link do Evento, Realização, Breve Descrição, Tipo do Evento, Rating?
    const mockEvents = [
        {
            "Nome do Evento": "Encontro Cavaleiros do Centro",
            "Data": "2/1/2026",
            "Hora de início": "10:30:00 AM",
            "Local": "Cine Glauber Rocha",
            "Custo": "Gratuito",
            "Link do Evento": "",
            "Realização": "Ô Rei, Clube de Xadrez",
            "Breve Descrição": "Encontro semanal da comunidade.",
            "Tipo do Evento": "Encontro",
            "Rating?": ""
        },
        {
            "Nome do Evento": "Torneio de Abertura",
            "Data": "2/15/2026",
            "Hora de início": "2:00:00 PM",
            "Local": "Biblioteca Central",
            "Custo": "Pago",
            "Link do Evento": "https://example.com/inscricao",
            "Realização": "Federação Bahiana de Xadrez",
            "Breve Descrição": "Torneio valendo rating FIDE.",
            "Tipo do Evento": "Torneio",
            "Rating?": "Valendo Rating"
        }
    ];

    setTimeout(() => {
        renderEvents(mockEvents);
    }, 800);
}

function renderEvents(data) {
    eventsContainer.innerHTML = '';

    // Filter empty rows where "Nome do Evento" is missing
    const validEvents = data.filter(row => row['Nome do Evento'] && row['Nome do Evento'].trim() !== '');

    if (validEvents.length === 0) {
        showError();
        return;
    }

    validEvents.forEach(event => {
        // Map fields based on Real CSV Headers
        // Headers: Timestamp,Email Address,Nome do Evento,Data,Hora de início,Hora de término,Local,Custo,Link do Evento,Realização,Breve Descrição,Tipo do Evento,Rating?

        const name = event['Nome do Evento'] || 'Evento Sem Nome';

        // Format Date/Time
        let rawDate = event['Data'] || '';
        const timeStr = event['Hora de início'] || '';

        let dateStr = formatDateToBR(rawDate);

        // Combine Date + Time
        let finalDate = dateStr;
        if (dateStr && timeStr) {
            // Clean up time if needed (e.g. remove seconds if 10:30:00)
            const shortTime = timeStr.replace(/:00\s/, ' ').replace(/:00$/, '');
            finalDate = `${dateStr} - ${shortTime}`;
        } else if (!dateStr && event['Timestamp']) {
            // Fallback to timestamp if Data is missing
            // timestamp usually M/D/YYYY H:M:S
            let parts = event['Timestamp'].split(' ');
            if (parts[0]) dateStr = formatDateToBR(parts[0]);
            finalDate = dateStr;
        }

        const location = event['Local'] || 'Local não informado';
        // Ensure link is not undefined
        const link = event['Link do Evento'] || '';

        // Badge Fields
        const type = event['Tipo do Evento'] || 'Evento';
        const cost = event['Custo'] || '';
        const rating = event['Rating?'] || '';

        // Description & Organizer
        const description = event['Breve Descrição'] || '';
        const organizer = event['Realização'] || '';

        const card = createEventCard({
            date: finalDate,
            name,
            location,
            link,
            type,
            rating,
            cost,
            description,
            organizer
        });
        eventsContainer.appendChild(card);
    });

    showContent();
}

// Helper to format date to DD/MM/YYYY
function formatDateToBR(dateString) {
    if (!dateString) return '';

    // Handle M/D/YYYY (common in US CSVs from Google Sheets)
    // Regex matches D/M/YYYY or M/D/YYYY depending on locale, but typically default Sheets export is M/D/YYYY
    // Let's try to detect separator.

    if (dateString.includes('/')) {
        const parts = dateString.split('/');
        // If 3 parts:
        if (parts.length === 3) {
            // Heuristic: If first part > 12, it's definitely Day.
            // But Sheets CSV often exports as M/D/YYYY. 
            // example: 2/1/2026 (Feb 1st). 
            // In Brazil 2/1 would be Jan 2nd. 
            // Assuming the standard export is US format since we saw "1/31/2026" in previous output.
            let month = parts[0];
            let day = parts[1];
            let year = parts[2];

            // Pad with 0
            month = month.padStart(2, '0');
            day = day.padStart(2, '0');

            return `${day}/${month}/${year}`;
        }
    }

    // Fallback or if already YYYY-MM-DD
    if (dateString.includes('-')) {
        const parts = dateString.split('-');
        if (parts.length === 3) {
            // YYYY-MM-DD ?
            if (parts[0].length === 4) {
                const [year, month, day] = parts;
                return `${day}/${month}/${year}`;
            }
        }
    }

    return dateString;
}

function createEventCard(data) {
    const article = document.createElement('article');
    article.className = 'event-card';

    // Badge Logic
    let typeBadgeClass = 'badge-default';
    if (data.type && data.type.toLowerCase().includes('torneio')) typeBadgeClass = 'badge-tournament';
    if (data.type && (data.type.toLowerCase().includes('encontro') || data.type.toLowerCase().includes('clube'))) typeBadgeClass = 'badge-meetup';

    let costBadgeHtml = '';
    if (data.cost && data.cost.toLowerCase() === 'gratuito') {
        costBadgeHtml = `<span class="badge badge-free">Gratuito</span>`;
    }

    // Rating Logic (Show only if present)
    let ratingHtml = '';
    if (data.rating) {
        ratingHtml = `<div class="rating-info">⚡ ${escapeHtml(data.rating)}</div>`;
    }

    // Organizer Logic
    let organizerHtml = '';
    if (data.organizer) {
        organizerHtml = `
            <div class="event-organizer">
                <span>♟️</span>
                <span>${escapeHtml(data.organizer)}</span>
            </div>
        `;
    }

    // Link Logic
    let linkHtml = '';
    if (data.link) {
        linkHtml = `
        <a href="${escapeHtml(data.link)}" target="_blank" rel="noopener noreferrer" class="event-link">
            Mais Informações
        </a>`;
    }

    // safe limit description
    const safeDesc = escapeHtml(data.description);

    // Date display
    const dateDisplay = data.date ? escapeHtml(data.date) : 'Data a confirmar';

    article.innerHTML = `
        <div class="event-meta-top">
            <span class="event-date">${dateDisplay}</span>
            <div class="badges-container">
                <span class="badge ${typeBadgeClass}">${escapeHtml(data.type)}</span>
                ${costBadgeHtml}
            </div>
        </div>
        
        <h2 class="event-title">${escapeHtml(data.name)}</h2>
        ${ratingHtml}
        
        <div class="event-description">
            ${safeDesc}
        </div>

        ${organizerHtml}

        <div class="event-location" style="margin-top: auto;">
            <span>📍</span>
            <span>${escapeHtml(data.location)}</span>
        </div>

        ${linkHtml}
    `;

    return article;
}

function showLoading() {
    loadingState.classList.remove('hidden');
    errorState.classList.add('hidden');
    eventsContainer.classList.add('hidden');
}

function showContent() {
    loadingState.classList.add('hidden');
    errorState.classList.add('hidden');
    eventsContainer.classList.remove('hidden');
}

function showError() {
    loadingState.classList.add('hidden');
    errorState.classList.remove('hidden');
    eventsContainer.classList.add('hidden');
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
