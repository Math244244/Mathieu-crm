// 1. INITIALISATION FIREBASE
const firebaseConfig = {
    apiKey: "AIzaSyDBFGDo2IEpSUqHNCxwZWBAUZxa8Lq5VpE",
    authDomain: "crm-dealer-mathieu.firebaseapp.com",
    projectId: "crm-dealer-mathieu",
    storageBucket: "crm-dealer-mathieu.firebasestorage.app",
    messagingSenderId: "99774542996",
    appId: "1:99774542996:web:59457e2166c9646a54f081"
};
firebase.initializeApp(firebaseConfig);

firebase.firestore().enablePersistence().catch(err => {
    if (err.code == 'failed-precondition') {
        console.warn("La persistance hors-ligne a échoué, probablement à cause de plusieurs onglets ouverts.");
    } else if (err.code == 'unimplemented') {
        console.log("Ce navigateur ne supporte pas la persistance hors-ligne.");
    }
});
const db = firebase.firestore();

// 2. SÉLECTION DES ÉLÉMENTS DU DOM
const navContainer = document.querySelector('.crm-nav');
const mainContent = document.querySelector('.crm-main');
const performanceBody = document.getElementById('performance-body');
const visitesBody = document.getElementById('visites-body');
const yearSelect = document.getElementById('year-select');
const notesOverlay = document.getElementById('notes-overlay');
const infoOverlay = document.getElementById('info-overlay');
const visitHistoryOverlay = document.getElementById('visit-history-overlay');
const formationOverlay = document.getElementById('formation-overlay');
const formationSaveBtn = document.getElementById('formation-save');
const formationCloseBtn = document.getElementById('formation-close');
const formationDateInput = document.getElementById('formation-date');
const formationTitreInput = document.getElementById('formation-titre');
const searchInputPerformance = document.getElementById('search-input-performance');
const searchInputVisites = document.getElementById('search-input-visites');
const showInactivePerformance = document.getElementById('show-inactive-performance');
const showInactiveVisites = document.getElementById('show-inactive-visites');
const dealerSelect = document.getElementById('dealer-select');
const dashboardContent = document.getElementById('dashboard-content');
const dashboardPlaceholder = document.getElementById('dashboard-placeholder');
const exportDashboardBtn = document.getElementById('export-dashboard');
const filterContainer = document.querySelector('.dashboard-filters');

// 3. ÉTAT DE L'APPLICATION
const state = {
    concessionnaires: [],
    selectedYear: new Date().getFullYear(),
    searchTermPerformance: '',
    searchTermVisites: '',
    showInactive: false,
    currentConcessionnaireId: null,
    flatpickrInstances: {},
    formationDatepicker: null,
    dashboard: {
        pieChart: null,
        lineChart: null,
        selectedDealerId: null,
        filterMonths: 12,
        choicesInstance: null,
    },
};

const moisKeys = ['janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin', 'juillet', 'aout', 'septembre', 'octobre', 'novembre', 'decembre'];

// 4. FONCTIONS UTILITAIRES
const handleError = (op, error) => console.error(`Erreur durant ${op}: `, error);
const calcTotal = (r = {}) => moisKeys.reduce((s, m) => s + (parseFloat(r[m]) || 0), 0);
const calcMoyenne = (r = {}) => {
    const v = moisKeys.map(m => parseFloat(r[m]) || 0).filter(n => n > 0);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0;
};
const getDaysSince = (d) => {
    if (!d) return null;
    const t = new Date(); t.setHours(0,0,0,0);
    const v = new Date(d); v.setHours(0,0,0,0);
    return Math.max(0, Math.round((t - v) / 86400000));
};

// 5. FONCTIONS DE RENDU
const renderAll = () => {
    try {
        searchInputPerformance.value = state.searchTermPerformance;
        searchInputVisites.value = state.searchTermVisites;
        showInactivePerformance.checked = state.showInactive;
        showInactiveVisites.checked = state.showInactive;

        Object.values(state.flatpickrInstances).forEach(fp => fp.destroy());
        state.flatpickrInstances = {};
        
        renderPerformance();
        renderVisites();
        initDashboard();
        renderDashboardForSelectedDealer();
    } catch (e) { handleError('renderAll', e); }
};

const renderPerformance = () => {
    performanceBody.innerHTML = '';
    const currentYear = state.selectedYear;
    let idx = 1;
    
    const concessionnairesFiltres = state.concessionnaires
      .filter(doc => state.showInactive || doc.statut === 'actif')
      .filter(doc => (doc.nom || '').toLowerCase().includes(state.searchTermPerformance.toLowerCase()))
      .sort((a, b) => (a.nom || '').localeCompare(b.nom || '', 'fr'));


    concessionnairesFiltres.forEach(doc => {
        const dataForYear = (doc.data && doc.data[currentYear]) || {};
        const revenus = dataForYear.revenus || {};
        const tot = calcTotal(revenus);
        const moy = calcMoyenne(revenus);
        const prevMoy = dataForYear.moyennePrecedente || 0;
        const varPct = prevMoy ? Math.round(((moy - prevMoy) / prevMoy) * 100) : 0;
        const taux = dataForYear.tauxReclamation || 0;
        
        let tauxBg = 'var(--color-success-bg)', tauxColor = 'var(--color-success-text)';
        if (taux > 40) { tauxBg = 'var(--color-danger-bg)'; tauxColor = 'var(--color-danger-text)'; }
        else if (taux > 30) { tauxBg = 'var(--color-warning-bg)'; tauxColor = 'var(--color-warning-text)';}
        
        const tr = document.createElement('tr');
        tr.dataset.id = doc.id;
        if (doc.statut === 'inactif') {
            tr.classList.add('is-inactive');
        }

        const actionButtons = doc.statut === 'actif'
            ? `<button class="btn-archive" aria-label="Archiver" title="Archiver">📥</button>`
            : `<button class="btn-reactivate" aria-label="Réactiver" title="Réactiver">🔄</button>
               <button class="btn-delete-permanent" aria-label="Supprimer Définitivement" title="Supprimer Définitivement">🗑️</button>`;
        
        const inputsDisabled = doc.statut === 'inactif' ? 'disabled' : '';

        tr.innerHTML = `
            <td data-label="#">${idx++}</td>
            <td data-label="INFOS"><button class="info-btn" aria-label="Infos">ℹ️</button></td>
            <td data-label="Nom"><input type="text" class="input-underline name-cell" data-field="nom" value="${doc.nom || ''}" ${inputsDisabled}></td>
            <td data-label="Taux Réclam."><div class="taux-wrapper"><input type="number" class="taux-input-badge" data-field="tauxReclamation" value="${taux}" style="background-color:${tauxBg}; color:${tauxColor}; border-color:${tauxBg};" ${inputsDisabled}><span class="sign">%</span></div></td>
            ${moisKeys.map(m => `<td data-label="${m.charAt(0).toUpperCase() + m.slice(1)}"><div class="currency-wrapper"><input type="text" class="input-underline month-cell" data-month="${m}" value="${(revenus[m] !== undefined && revenus[m] !== null) ? parseFloat(revenus[m]).toLocaleString('fr-FR') : ''}" placeholder="-" ${inputsDisabled}><span class="sign">$</span></div></td>`).join('')}
            <td data-label="Total ${currentYear}"><span class="total-badge">${tot.toLocaleString('fr-FR')} $</span></td>
            <td data-label="Moyenne ${currentYear}"><span class="total-badge yellow">${moy.toLocaleString('fr-FR')} $</span></td>
            <td data-label="Moyenne année précédente"><div class="currency-wrapper"><input type="text" class="input-underline prev-cell" data-field="moyennePrecedente" value="${prevMoy ? prevMoy.toLocaleString('fr-FR') : ''}" placeholder="-" ${inputsDisabled}><span class="sign">$</span></div></td>
            <td data-label="Var. vs Année Préc."><div class="diff-badge" style="background-color:${varPct >= 0 ? 'var(--color-success-bg)' : 'var(--color-danger-bg)'}; color:${varPct >= 0 ? 'var(--color-success-text)' : 'var(--color-danger-text)'};">${varPct > 0 ? '+' : ''}${varPct}%</div></td>
            <td data-label="Actions" class="actions-cell">
                <button class="notes-btn" aria-label="Notes">📝</button>
                ${actionButtons}
            </td>
        `;
        performanceBody.appendChild(tr);
    });
};

const renderVisites = () => {
    visitesBody.innerHTML = '';
    const concessionnairesFiltres = state.concessionnaires
        .filter(doc => state.showInactive || doc.statut === 'actif')
        .filter(doc => (doc.nom || '').toLowerCase().includes(state.searchTermVisites.toLowerCase()))
        .sort((a, b) => {
            const moyB = calcMoyenne(((b.data && b.data[state.selectedYear]) || {}).revenus);
            const moyA = calcMoyenne(((a.data && a.data[state.selectedYear]) || {}).revenus);
            return moyB - moyA;
        });

    concessionnairesFiltres.forEach(doc => {
        const dataForYear = (doc.data && doc.data[state.selectedYear]) || {};
        const moy = calcMoyenne(dataForYear.revenus);
        const visites = doc.visites || [];
        const lastVisit = visites.length > 0 ? [...visites].sort().slice(-1)[0] : '';
        const daysSince = getDaysSince(lastVisit);
        const taux = dataForYear.tauxReclamation || 0;
        
        let tauxBg = 'var(--color-success-bg)', tauxColor = 'var(--color-success-text)';
        if (taux > 40) { tauxBg = 'var(--color-danger-bg)'; tauxColor = 'var(--color-danger-text)'; }
        else if (taux > 30) { tauxBg = 'var(--color-warning-bg)'; tauxColor = 'var(--color-warning-text)';}
        
        let moyBg = 'var(--color-danger-bg)', moyColor = 'var(--color-danger-text)';
        if (moy > 15000) { moyBg = 'var(--color-success-bg)'; moyColor = 'var(--color-success-text)';}
        else if (moy > 5000) { moyBg = 'var(--color-warning-bg)'; moyColor = 'var(--color-warning-text)';}
        
        let daysClass = '';
        if (daysSince !== null) {
            if (daysSince <= 60) { daysClass = 'success'; }
            else if (daysSince <= 90) { daysClass = 'warning';}
            else { daysClass = 'danger'; }
        }
        
        const tr = document.createElement('tr');
        tr.dataset.id = doc.id;
        if (doc.statut === 'inactif') {
            tr.classList.add('is-inactive');
        }

        const historyButtonHtml = visites.length > 2 ? `<button class="visit-history-btn" aria-label="Voir l'historique">+${visites.length - 2}</button>` : (visites.length > 0 ? `<button class="visit-history-btn" aria-label="Voir l'historique">...</button>` : '');
        
        const actionButtons = doc.statut === 'actif'
            ? `<button class="btn-archive" aria-label="Archiver" title="Archiver">📥</button>`
            : `<button class="btn-reactivate" aria-label="Réactiver" title="Réactiver">🔄</button>
               <button class="btn-delete-permanent" aria-label="Supprimer Définitivement" title="Supprimer Définitivement">🗑️</button>`;

        // NOTE : Ordre des cellules <td> inversé pour correspondre à la correction de l'en-tête dans index.html
        tr.innerHTML = `
            <td data-label="Taux"><div class="static-badge" style="background-color:${tauxBg}; color:${tauxColor};">${taux}%</div></td>
            <td data-label="Concessionnaire">${doc.nom || ''}</td>
            <td data-label="Moyenne Rev."><div class="static-badge" style="background-color:${moyBg}; color:${moyColor};">${Math.round(moy).toLocaleString('fr-FR')}$</div></td>
            <td data-label="Visites" class="visit-cell">
                <div class="visit-cell-buttons">
                    <button class="btn-today" aria-label="Aujourd'hui" title="Visite aujourd'hui">🕒</button>
                    <button class="btn-calendar" aria-label="Choisir une date" title="Ajouter une visite">📅</button>
                    ${historyButtonHtml}
                </div>
            </td>
            <td data-label="Jours depuis" class="days-cell ${daysClass}">${daysSince !== null ? daysSince : '–'}</td>
            <td data-label="Google Agenda"><button class="btn-agenda" aria-label="Créer un événement dans Google Agenda">AGENDA</button></td>
            <td data-label="Actions" class="actions-cell">
                <button class="notes-btn" aria-label="Notes">📝</button>
                ${actionButtons}
            </td>
        `;
        visitesBody.appendChild(tr);

        const calendarBtn = tr.querySelector('.btn-calendar');
        if (calendarBtn && doc.statut === 'actif') {
            state.flatpickrInstances[doc.id] = flatpickr(calendarBtn, {
                maxDate: "today",
                onChange: async (selectedDates) => {
                    if (!selectedDates.length) return;
                    const newDate = selectedDates[0].toISOString().slice(0, 10);
                    try {
                        await db.collection('concessionnaires').doc(doc.id).update({ visites: firebase.firestore.FieldValue.arrayUnion(newDate) });
                        fetchDataAndRender();
                    } catch (e) { handleError('Mise à jour visite', e); }
                }
            });
        }
    });
};

// 6. FONCTIONS DU TABLEAU DE BORD
function initDashboard() {
    if (state.dashboard.choicesInstance) {
        const activeDealers = state.concessionnaires.filter(d => d.statut === 'actif');
        const sortedDealers = [...activeDealers].sort((a,b) => (a.nom || "").localeCompare(b.nom || "", 'fr'));
        const choicesData = sortedDealers.map(d => ({
            value: d.id,
            label: d.nom || 'Sans nom',
        }));
        choicesData.unshift({value: '', label: 'Choisir un concessionnaire actif...', placeholder: true});
        state.dashboard.choicesInstance.setChoices(choicesData, 'value', 'label', true);
        
        if (state.dashboard.selectedDealerId) {
            state.dashboard.choicesInstance.setChoiceByValue(state.dashboard.selectedDealerId);
        }
    }
}
function renderDashboardForSelectedDealer() {
    const dashboardSection = document.getElementById('tableau-de-bord');
    if (dashboardSection.classList.contains('hidden')) {
        return; 
    }

    const id = state.dashboard.selectedDealerId;
    if (!id) {
        dashboardPlaceholder.classList.remove('hidden');
        dashboardContent.classList.add('hidden');
        return;
    }
    dashboardPlaceholder.classList.add('hidden');
    dashboardContent.classList.remove('hidden');
    
    const dealer = state.concessionnaires.find(d => d.id === id);
    if (!dealer) return;

    const currentYear = state.selectedYear;
    const prevYear = currentYear - 1;

    document.querySelectorAll('.stat-year').forEach(el => el.textContent = currentYear);
    document.querySelectorAll('.stat-year-prev').forEach(el => el.textContent = prevYear);

    const data = (dealer.data && dealer.data[currentYear]) ? dealer.data[currentYear] : { revenus: {}, tauxReclamation: 0 };
    const prevData = (dealer.data && dealer.data[prevYear]) ? dealer.data[prevYear] : { revenus: {} };
    const prevMoyenneConcessionnaire = data.moyennePrecedente || calcMoyenne(prevData.revenus);

    const total = calcTotal(data.revenus);
    const moy = calcMoyenne(data.revenus);
    const diff = prevMoyenneConcessionnaire ? ((moy - prevMoyenneConcessionnaire) / prevMoyenneConcessionnaire * 100) : 0;
    const taux = data.tauxReclamation || 0;

    document.getElementById('dealer-name').textContent = dealer.nom || 'Concessionnaire sans nom';
    
    const alertsContainer = document.getElementById('dealer-alerts');
    alertsContainer.innerHTML = '';
    if (taux > 40) {
        alertsContainer.innerHTML += `<span class="alert-badge danger">Taux réclamation élevé (${taux}%)</span>`;
    }
    if (diff < 0) {
        alertsContainer.innerHTML += `<span class="alert-badge danger">En baisse vs Année Préc. (${diff.toFixed(1)}%)</span>`;
    }

    document.getElementById('annual-total').textContent = `${total.toLocaleString('fr-FR', { style: 'currency', currency: 'CAD' })}`;
    document.getElementById('monthly-avg').textContent = `${moy.toLocaleString('fr-FR', { style: 'currency', currency: 'CAD' })}`;
    const comparisonEl = document.getElementById('comparison-prev');
    comparisonEl.textContent = `${diff > 0 ? '+' : ''}${diff.toFixed(1)}%`;
    comparisonEl.className = diff >= 0 ? 'positive' : 'negative';
    document.getElementById('claim-rate').textContent = `${taux}%`;

    const monthlyAvgCard = document.getElementById('monthly-avg').closest('.stat-card');
    const claimRateCard = document.getElementById('claim-rate').closest('.stat-card');

    [monthlyAvgCard, claimRateCard].forEach(card => {
        card.style.backgroundColor = '';
        card.querySelector('h3').style.color = '';
        card.querySelector('span').style.color = '';
    });
    
    if (moy <= 5000) {
        monthlyAvgCard.style.backgroundColor = 'var(--color-danger-bg)';
        monthlyAvgCard.querySelector('h3').style.color = 'var(--color-danger-text)';
        monthlyAvgCard.querySelector('span').style.color = 'var(--color-danger-text)';
    } else if (moy <= 15000) {
        monthlyAvgCard.style.backgroundColor = 'var(--color-warning-bg)';
        monthlyAvgCard.querySelector('h3').style.color = 'var(--color-warning-text)';
        monthlyAvgCard.querySelector('span').style.color = 'var(--color-warning-text)';
    } else {
        monthlyAvgCard.style.backgroundColor = 'var(--color-success-bg)';
        monthlyAvgCard.querySelector('h3').style.color = 'var(--color-success-text)';
        monthlyAvgCard.querySelector('span').style.color = 'var(--color-success-text)';
    }

    if (taux <= 30) {
        claimRateCard.style.backgroundColor = 'var(--color-success-bg)';
        claimRateCard.querySelector('h3').style.color = 'var(--color-success-text)';
        claimRateCard.querySelector('span').style.color = 'var(--color-success-text)';
    } else if (taux <= 40) {
        claimRateCard.style.backgroundColor = 'var(--color-warning-bg)';
        claimRateCard.querySelector('h3').style.color = 'var(--color-warning-text)';
        claimRateCard.querySelector('span').style.color = 'var(--color-warning-text)';
    } else {
        claimRateCard.style.backgroundColor = 'var(--color-danger-bg)';
        claimRateCard.querySelector('h3').style.color = 'var(--color-danger-text)';
        claimRateCard.querySelector('span').style.color = 'var(--color-danger-text)';
    }

    if (state.dashboard.pieChart) state.dashboard.pieChart.destroy();
    if (state.dashboard.lineChart) state.dashboard.lineChart.destroy();
    
    const filteredMonths = moisKeys.slice(0, state.dashboard.filterMonths);
    const revenusData = filteredMonths.map(m => (data.revenus && data.revenus[m]) || 0);
    const prevRevenusData = filteredMonths.map(m => (prevData.revenus && prevData.revenus[m]) || 0);
    
    state.dashboard.pieChart = new Chart(document.getElementById('revenuPieChart').getContext('2d'), {
        type: 'pie', data: {
            labels: filteredMonths.map(m => m.charAt(0).toUpperCase() + m.slice(1)),
            datasets: [{ data: revenusData, backgroundColor: ['#991b1b', '#b91c1c', '#dc2626', '#ef4444', '#f87171', '#fca5a5', '#fee2e2', '#fecaca', '#fca5a5', '#f87171', '#ef4444', '#dc2626'] }]
        }, options: { responsive: true, maintainAspectRatio: false }
    });
    state.dashboard.lineChart = new Chart(document.getElementById('revenuLineChart').getContext('2d'), {
        type: 'line', data: {
            labels: filteredMonths.map(m => m.charAt(0).toUpperCase() + m.slice(1)),
            datasets: [
                { label: `${currentYear}`, data: revenusData, borderColor: '#7f1d1d', tension: 0.1, fill: false },
                { label: `${prevYear}`, data: prevRevenusData, borderColor: '#6b7280', tension: 0.1, fill: false, borderDash: [5, 5] }]
        }, options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }
    });
    
    const monthlyTableBody = document.querySelector('#monthly-detail-table tbody');
    monthlyTableBody.innerHTML = filteredMonths.map(m => {
        const curr = (data.revenus && data.revenus[m]) || 0;
        const prev = (prevData.revenus && prevData.revenus[m]) || 0;
        const ecartNum = curr - prev;
        const ecartPct = prev ? ((curr - prev) / prev * 100) : 0;
        
        let badgeHtml = '-';
        if (prev !== 0 || curr !== 0) {
            const badgeBg = ecartPct >= 0 ? 'var(--color-success-bg)' : 'var(--color-danger-bg)';
            const textColor = ecartPct >= 0 ? 'var(--color-success-text)' : 'var(--color-danger-text)';
            badgeHtml = `<div class="diff-badge" style="background-color:${badgeBg}; color:${textColor};">${ecartPct > 0 ? '+' : ''}${ecartPct.toFixed(1)}%</div>`;
        }

        return `<tr><td>${m.charAt(0).toUpperCase() + m.slice(1)}</td><td>${curr.toLocaleString('fr-FR', { style: 'currency', currency: 'CAD' })}</td><td>${prev.toLocaleString('fr-FR', { style: 'currency', currency: 'CAD' })}</td><td>${ecartNum.toLocaleString('fr-FR', { style: 'currency', currency: 'CAD' })}</td><td>${badgeHtml}</td></tr>`;
    }).join('');
    
    document.getElementById('last-visit-date').textContent = (dealer.visites && dealer.visites.length > 0) ? new Date([...dealer.visites].sort().pop()).toLocaleDateString('fr-FR') : 'Aucune';
    document.getElementById('days-since-visit').textContent = getDaysSince((dealer.visites && dealer.visites.length > 0) ? [...dealer.visites].sort().pop() : null) !== null ? `${getDaysSince((dealer.visites && dealer.visites.length > 0) ? [...dealer.visites].sort().pop() : null)} jours` : 'N/A';
    document.getElementById('btn-view-all-visits').onclick = () => openVisitHistoryModal(id);
    
    const formations = (dealer.formations || []).sort((a, b) => b.date.localeCompare(a.date));
    const recentFormationsList = document.getElementById('recent-formations-list');
    if (formations.length > 0) {
        recentFormationsList.innerHTML = formations.slice(0, 3).map(f => `<li><span class="list-item-date">${new Date(f.date).toLocaleDateString('fr-FR')}:</span> ${f.titre}</li>`).join('');
    } else {
        recentFormationsList.innerHTML = '<li>Aucune formation.</li>';
    }
    document.getElementById('btn-add-formation').onclick = () => openFormationModal(id);

    const notes = (dealer.notes || []).sort((a,b) => b.date.localeCompare(a.date));
    const recentNotesList = document.getElementById('recent-notes-list');
    if(notes.length > 0) {
        recentNotesList.innerHTML = notes.slice(0, 3).map(n => `<li><span class="list-item-date">${new Date(n.date).toLocaleDateString('fr-FR')}:</span> ${n.text}</li>`).join('');
    } else {
        recentNotesList.innerHTML = '<li>Aucune note.</li>';
    }
    document.getElementById('btn-view-all-notes').onclick = () => openNotesModal(id);
}

// 7. GESTION DES MODALES
function addDFRow(container, name = '', email = '') {
    const div = document.createElement('div');
    div.className = 'info-group df-group';
    div.innerHTML = `<label>Directeur financier</label><input type="text" class="df-name" value="${name}" placeholder="Nom du directeur financier"/><input type="email" class="df-email" value="${email}" placeholder="Adresse e-mail du directeur financier"/><button type="button" class="df-delete-btn" aria-label="Supprimer Directeur financier">❌</button>`;
    container.appendChild(div);
}
async function openNotesModal(id) {
    state.currentConcessionnaireId = id;
    try {
        const docSnap = await db.collection('concessionnaires').doc(id).get();
        if (!docSnap.exists) return;
        const c = docSnap.data();
        document.getElementById('notes-title').textContent = `Notes – ${c.nom || 'N/A'}`;
        const list = document.getElementById('notes-list');
        list.innerHTML = '';
        if (c.notes && c.notes.length > 0) {
            c.notes.sort((a,b) => b.date.localeCompare(a.date)).forEach(note => {
                const div = document.createElement('div');
                div.className = 'note-item';
                div.textContent = `[${note.date}] ${note.text}`;
                list.appendChild(div);
            });
        } else { list.innerHTML = '<p>Aucune note.</p>'; }
        document.getElementById('notes-input').value = '';
        notesOverlay.classList.remove('hidden');
    } catch(e) { handleError('openNotesModal', e); }
}
async function openInfoModal(id) {
    state.currentConcessionnaireId = id;
    try {
        const docSnap = await db.collection('concessionnaires').doc(id).get();
        if (!docSnap.exists) return;
        const d = docSnap.data() || {};
        document.getElementById('info-title').textContent = `Infos – ${d.nom || 'N/A'}`;
        const modalBody = document.getElementById('info-modal-body');
        modalBody.innerHTML = `<div class="info-group"><label>Propriétaire :</label><input type="text" id="info-owner" value="${d.owner || ''}" placeholder="Nom du propriétaire"/><input type="email" id="info-owner-email" value="${d.ownerEmail || ''}" placeholder="Adresse e-mail du propriétaire"/></div>
            <div class="info-group"><label>Directeur de service :</label><input type="text" id="info-ds" value="${d.ds || ''}" placeholder="Nom du directeur de service"/><input type="email" id="info-ds-email" value="${d.dsEmail || ''}" placeholder="Adresse e-mail du directeur de service"/></div>
            <div class="info-group"><label>Administration :</label><input type="text" id="info-admin" value="${d.admin || ''}" placeholder="Nom de l'administration"/><input type="email" id="info-admin-email" value="${d.adminEmail || ''}" placeholder="Adresse e-mail de l'administration"/></div>
            <div id="df-container"></div>
            <button type="button" id="add-df-btn">➕ Ajouter Directeur financier</button>
            <button id="info-save" class="modal-save">Sauvegarder</button>`;
        const dfContainer = modalBody.querySelector('#df-container');
        (d.financiers || []).forEach(f => addDFRow(dfContainer, f.name, f.email));
        infoOverlay.classList.remove('hidden');
    } catch(e) { handleError('openInfoModal', e); }
}
async function openVisitHistoryModal(id) {
    state.currentConcessionnaireId = id;
    const c = state.concessionnaires.find(doc => doc.id === id);
    if (!c) return;
    document.getElementById('visit-history-title').textContent = `Historique des visites – ${c.nom || 'N/A'}`;
    const list = document.getElementById('visit-history-list');
    list.innerHTML = '';
    const visites = c.visites || [];
    if (visites.length > 0) {
        [...visites].sort().reverse().forEach(v => {
            const div = document.createElement('div');
            div.className = 'history-item';
            div.innerHTML = `<span>${v}</span><button class="btn-delete-visit" data-date="${v}">❌</button>`;
            list.appendChild(div);
        });
    } else { list.innerHTML = '<p>Aucune visite enregistrée.</p>'; }
    visitHistoryOverlay.classList.remove('hidden');
}
async function openFormationModal(id) {
    state.currentConcessionnaireId = id;
    formationTitreInput.value = '';
    formationOverlay.classList.remove('hidden');
    if(state.formationDatepicker) state.formationDatepicker.destroy();
    state.formationDatepicker = flatpickr(formationDateInput, {
        maxDate: "today",
        dateFormat: "Y-m-d",
    });
    formationDateInput.value = '';
}
async function saveNotes() {
    const text = document.getElementById('notes-input').value.trim();
    if (!text || !state.currentConcessionnaireId) return;
    try {
        const newNote = { date: new Date().toISOString().slice(0, 10), text };
        await db.collection('concessionnaires').doc(state.currentConcessionnaireId).update({
            notes: firebase.firestore.FieldValue.arrayUnion(newNote)
        });
        await fetchDataAndRender();
        openNotesModal(state.currentConcessionnaireId); 
    } catch(e) { handleError('saveNotes', e); }
}
async function saveInfo() {
    if (!state.currentConcessionnaireId) return;
    const financiers = Array.from(document.querySelectorAll('#df-container .df-group')).map(group => ({
        name: group.querySelector('.df-name').value.trim(),
        email: group.querySelector('.df-email').value.trim()
    })).filter(f => f.name || f.email);
    const dataToSave = {
        owner: document.getElementById('info-owner').value.trim(), ownerEmail: document.getElementById('info-owner-email').value.trim(),
        ds: document.getElementById('info-ds').value.trim(), dsEmail: document.getElementById('info-ds-email').value.trim(),
        admin: document.getElementById('info-admin').value.trim(), adminEmail: document.getElementById('info-admin-email').value.trim(),
        financiers
    };
    try {
        await db.collection('concessionnaires').doc(state.currentConcessionnaireId).set(dataToSave, { merge: true });
        fetchDataAndRender();
        infoOverlay.classList.add('hidden');
    } catch(e) { handleError('saveInfo', e); }
}
async function saveFormation() {
    const titre = formationTitreInput.value.trim();
    const date = formationDateInput.value;
    if (!titre || !date || !state.currentConcessionnaireId) {
        alert("Veuillez remplir la date et le titre de la formation.");
        return;
    }
    try {
        const newFormation = { date, titre };
        await db.collection('concessionnaires').doc(state.currentConcessionnaireId).update({
            formations: firebase.firestore.FieldValue.arrayUnion(newFormation)
        });
        await fetchDataAndRender();
        formationOverlay.classList.add('hidden');
    } catch(e) { handleError('saveFormation', e); }
}

// 8. GESTION DES DONNÉES
async function fetchDataAndRender() {
    try {
        const snapshot = await db.collection('concessionnaires').get();
        state.concessionnaires = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        if (!state.dashboard.selectedDealerId || !state.concessionnaires.some(c => c.id === state.dashboard.selectedDealerId && c.statut === 'actif')) {
            selectTopPerformer();
        }

        renderAll();
    } catch (e) { handleError('fetchData', e); }
}
function selectTopPerformer() {
    const activeDealers = state.concessionnaires.filter(c => c.statut === 'actif');
    if (activeDealers.length === 0) {
        state.dashboard.selectedDealerId = null;
        return;
    }
    const topPerformer = activeDealers.reduce((prev, current) => {
        const prevAvg = calcMoyenne((prev.data && prev.data[state.selectedYear]) ? prev.data[state.selectedYear].revenus : {});
        const currentAvg = calcMoyenne((current.data && current.data[state.selectedYear]) ? current.data[state.selectedYear].revenus : {});
        return (prevAvg > currentAvg) ? prev : current;
    });
    state.dashboard.selectedDealerId = topPerformer.id;
}
function handleImport(event) {
    const file = event.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
        const lines = e.target.result.split('\n');
        const dataLines = lines.slice(1).filter(line => line.trim() !== '');
        const batch = db.batch();
        dataLines.forEach(line => {
            const values = line.split(';'); let i = 0;
            const docData = {
                nom: values[i++] || '',
                statut: 'actif',
                owner: values[i++] || '', ownerEmail: values[i++] || '',
                ds: values[i++] || '', dsEmail: values[i++] || '', admin: values[i++] || '',
                adminEmail: values[i++] || '', data: { [state.selectedYear]: {
                        tauxReclamation: parseFloat(values[i++]) || 0,
                        moyennePrecedente: parseFloat(values[i++]) || 0,
                        revenus: {} }},
                financiers: [], notes: [], visites: [], formations: [] };
            moisKeys.forEach(key => {
                const revenu = parseFloat(values[i++]);
                if (!isNaN(revenu)) docData.data[state.selectedYear].revenus[key] = revenu;
            });
            try { docData.financiers = JSON.parse(values[i++] || '[]'); } catch(err) {}
            try { docData.notes = JSON.parse(values[i++] || '[]'); } catch(err) {}
            try { docData.visites = JSON.parse(values[i++] || '[]'); } catch(err) {}
            const newDocRef = db.collection('concessionnaires').doc();
            batch.set(newDocRef, docData, { merge: true });
        });
        try {
            await batch.commit();
            alert(`${dataLines.length} concessionnaire(s) importé(s) avec succès !`);
            fetchDataAndRender();
        } catch (err) { handleError('batch.commit', err); }
    };
    reader.readAsText(file, "ISO-8859-1");
}
async function handleExport() {
    let csvContent = "data:text/csv;charset=utf-8,";
    const headers = [ "nom", "statut", "proprietaire_nom", "proprietaire_email", "directeur_service_nom", "directeur_service_email", 
        "admin_nom", "admin_email", "taux_reclamation", "moyenne_precedente", ...moisKeys, 
        "financiers_json", "notes_json", "visites_json", "formations_json" ];
    csvContent += headers.join(";") + "\r\n";
    state.concessionnaires.forEach(doc => {
        const dataForYear = doc.data ? (doc.data[state.selectedYear] || {}) : {};
        const clean = (str) => (str || '').toString().replace(/;/g, ',').replace(/\r?\n|\r/g, ' ');
        const rowData = [ clean(doc.nom), clean(doc.statut), clean(doc.owner), clean(doc.ownerEmail), clean(doc.ds),
            clean(doc.dsEmail), clean(doc.admin), clean(doc.adminEmail),
            dataForYear.tauxReclamation || 0, dataForYear.moyennePrecedente || 0,
            ...moisKeys.map(m => (dataForYear.revenus ? dataForYear.revenus[m] : 0) || 0),
            JSON.stringify(doc.financiers || []), JSON.stringify(doc.notes || []), JSON.stringify(doc.visites || []), JSON.stringify(doc.formations || []) ];
        csvContent += rowData.join(";") + "\r\n";
    });
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `export_complet_${state.selectedYear}.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
}

// 9. GESTION DES ÉVÉNEMENTS
function setupEventListeners() {
    navContainer.addEventListener('click', (e) => {
        const target = e.target.closest('.nav-tab');
        if (!target) return;
        document.querySelectorAll('.tab-content').forEach(s => s.classList.add('hidden'));
        document.getElementById(target.dataset.tab).classList.remove('hidden');
        navContainer.querySelectorAll('.nav-tab').forEach(b => b.classList.remove('nav-active'));
        target.classList.add('nav-active');
        if (target.dataset.tab === 'tableau-de-bord') {
            renderDashboardForSelectedDealer();
        }
    });

    yearSelect.addEventListener('change', () => { 
        state.selectedYear = parseInt(yearSelect.value);
        state.dashboard.selectedDealerId = null; 
        fetchDataAndRender();
    });
    
    searchInputPerformance.addEventListener('keyup', (e) => { state.searchTermPerformance = e.target.value; renderAll(); });
    searchInputVisites.addEventListener('keyup', (e) => { state.searchTermVisites = e.target.value; renderAll(); });

    const handleInactiveToggle = (e) => {
        state.showInactive = e.target.checked;
        renderAll();
    };
    showInactivePerformance.addEventListener('change', handleInactiveToggle);
    showInactiveVisites.addEventListener('change', handleInactiveToggle);

    document.getElementById('add-concessionnaire').addEventListener('click', async () => {
        try {
            await db.collection('concessionnaires').add({ 
                nom: "Nouveau Concessionnaire", 
                statut: 'actif', 
                data: { [state.selectedYear]: { moyennePrecedente: 0, revenus:{}, tauxReclamation: 0 } }, 
                visites: [], notes: [], formations: []
            });
            fetchDataAndRender();
        } catch (err) { handleError('addConcessionnaire', err); }
    });
    document.getElementById('btn-import').addEventListener('click', () => document.getElementById('import-file').click());
    document.getElementById('import-file').addEventListener('change', handleImport);
    document.getElementById('btn-export').addEventListener('click', handleExport);

    mainContent.addEventListener('click', async (e) => {
        const button = e.target.closest('button');
        if (!button || button.closest('.modal-container') || button.closest('.dashboard-header') || button.closest('.quick-actions')) return;
        
        const tr = button.closest('tr');
        if (!tr || !tr.dataset.id) return;
        const id = tr.dataset.id;
        const concessionnaire = state.concessionnaires.find(c => c.id === id);
        if (!concessionnaire) return;
        
        if (button.matches('.info-btn')) openInfoModal(id);
        else if (button.matches('.notes-btn')) openNotesModal(id);
        else if (button.matches('.visit-history-btn')) openVisitHistoryModal(id);
        else if (button.matches('.btn-calendar')) { if (state.flatpickrInstances[id]) state.flatpickrInstances[id].open(); }
        else if (button.matches('.btn-today')) {
            await db.collection('concessionnaires').doc(id).update({ visites: firebase.firestore.FieldValue.arrayUnion(new Date().toISOString().slice(0, 10)) });
            fetchDataAndRender();
        } else if (button.matches('.btn-agenda')) {
            const now = new Date(), later = new Date(now.getTime() + 3600000);
            const toGoogleISO = d => d.toISOString().replace(/[-:]|\.\d{3}/g, '');
            window.open(`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(`Visite - ${concessionnaire.nom}`)}&dates=${toGoogleISO(now)}/${toGoogleISO(later)}`, '_blank');
        } 
        else if (button.matches('.btn-archive')) {
            if (confirm(`Êtes-vous sûr de vouloir archiver ${concessionnaire.nom || 'ce concessionnaire'} ? Il sera masqué de la vue par défaut.`)) {
                await db.collection('concessionnaires').doc(id).update({ statut: 'inactif' });
                fetchDataAndRender();
            }
        }
        else if (button.matches('.btn-reactivate')) {
            await db.collection('concessionnaires').doc(id).update({ statut: 'actif' });
            fetchDataAndRender();
        }
        else if (button.matches('.btn-delete-permanent')) {
            const confirmationText = `Êtes-vous ABSOLUMENT SÛR de vouloir supprimer définitivement ${concessionnaire.nom || 'ce concessionnaire'} ?\n\nTOUTES ses données, y compris l'historique, seront perdues à jamais. Cette action est irréversible.`;
            if (confirm(confirmationText)) {
                await db.collection('concessionnaires').doc(id).delete();
                fetchDataAndRender();
            }
        }
    });
    
    mainContent.addEventListener('change', async (e) => {
        const input = e.target;
        if (input.tagName !== 'INPUT' || !input.closest('tr')) return;
        const id = input.closest('tr').dataset.id;
        if (!id) return;
        let fieldPath; let value = input.value;
        const field = input.dataset.field;
        if (field === 'nom') { fieldPath = 'nom'; }
        else if (field === 'tauxReclamation') { fieldPath = `data.${state.selectedYear}.tauxReclamation`; value = parseFloat(value) || 0; }
        else if (field === 'moyennePrecedente') { fieldPath = `data.${state.selectedYear}.moyennePrecedente`; value = parseFloat(value.replace(/\s/g, '').replace(',', '.')) || 0; }
        else if (input.matches('.month-cell')) {
            fieldPath = `data.${state.selectedYear}.revenus.${input.dataset.month}`;
            value = parseFloat(value.replace(/\s/g, '').replace(',', '.')) || 0;
        }
        if (fieldPath) {
            try { 
                await db.collection('concessionnaires').doc(id).update({ [fieldPath]: value }); 
                fetchDataAndRender();
            }
            catch(err) { handleError('updateField', err); }
        }
    });

    notesOverlay.addEventListener('click', (e) => {
        if (e.target.matches('#notes-close') || e.target === notesOverlay) notesOverlay.classList.add('hidden');
        if (e.target.matches('#notes-save')) saveNotes();
    });

    infoOverlay.addEventListener('click', (e) => {
        if (e.target.matches('#info-close') || e.target === infoOverlay) infoOverlay.classList.add('hidden');
        if (e.target.matches('#info-save')) saveInfo();
        if (e.target.matches('#add-df-btn')) addDFRow(document.getElementById('df-container'));
        if (e.target.matches('.df-delete-btn')) e.target.closest('.df-group').remove();
    });

    visitHistoryOverlay.addEventListener('click', async (e) => {
        if (e.target.matches('#visit-history-close') || e.target === visitHistoryOverlay) visitHistoryOverlay.classList.add('hidden');
        else if (e.target.matches('.btn-delete-visit')) {
            const dateToDelete = e.target.dataset.date;
            if (confirm(`Supprimer la visite du ${dateToDelete} ?`)) {
                await db.collection('concessionnaires').doc(state.currentConcessionnaireId).update({ visites: firebase.firestore.FieldValue.arrayRemove(dateToDelete) });
                await fetchDataAndRender();
                visitHistoryOverlay.classList.add('hidden');
            }
        }
    });

    formationOverlay.addEventListener('click', (e) => {
        if (e.target === formationOverlay || e.target.matches('#formation-close')) {
            formationOverlay.classList.add('hidden');
        }
    });
    formationSaveBtn.addEventListener('click', saveFormation);

    exportDashboardBtn.addEventListener('click', () => window.print());
    document.getElementById('quick-add-note').addEventListener('click', () => { if (state.dashboard.selectedDealerId) openNotesModal(state.dashboard.selectedDealerId); });
    document.getElementById('quick-add-visit').addEventListener('click', () => { if (state.dashboard.selectedDealerId) openVisitHistoryModal(state.dashboard.selectedDealerId); });
    document.getElementById('quick-info').addEventListener('click', () => { if (state.dashboard.selectedDealerId) openInfoModal(state.dashboard.selectedDealerId); });
    filterContainer.addEventListener('click', (e) => {
        const button = e.target.closest('button');
        if (!button) return;
        filterContainer.querySelectorAll('button').forEach(btn => btn.classList.remove('active-filter'));
        button.classList.add('active-filter');
        state.dashboard.filterMonths = parseInt(button.dataset.filter, 10);
        renderDashboardForSelectedDealer();
    });
}

// 10. INITIALISATION DE L'APPLICATION
function init() {
    const now = new Date().getFullYear();
    for (let y = now - 5; y <= now + 5; y++) {
        const opt = document.createElement('option');
        opt.value = y; opt.textContent = y;
        if (y === state.selectedYear) opt.selected = true;
        yearSelect.appendChild(opt);
    }
    
    state.dashboard.choicesInstance = new Choices(dealerSelect, {
        searchEnabled: true,
        itemSelectText: 'Cliquer pour choisir',
        removeItemButton: true,
        shouldSort: false,
    });
    
    dealerSelect.addEventListener('change', (event) => {
        if (event.detail.value) {
            state.dashboard.selectedDealerId = event.detail.value;
            renderDashboardForSelectedDealer();
        }
    });

    setupEventListeners();
    fetchDataAndRender();
    
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            // NOTE : Le chemin vers sw.js est maintenant relatif pour fonctionner sur GitHub Pages
            navigator.serviceWorker.register('sw.js')
                .then(registration => {
                    console.log('Service Worker enregistré avec succès:', registration);
                })
                .catch(error => {
                    console.log('Échec de l\'enregistrement du Service Worker:', error);
                });
        });
    }
}

init();