/**
 * STUDENT BUDGET TRACKER - ADVANCED ADMIN PANEL (admin.js)
 * =========================================================
 * Features: GET, PUT, DELETE, stats, charts (Chart.js), debounced search,
 * sorting, CSV export, dark mode, toast notifications.
 */

// ============================================
// CONFIGURATION
// ============================================

const API_URL = 'http://localhost:3000/transactions';

const INCOME_CATS = ['Pocket Money', 'Scholarship', 'Freelancing', 'Part-Time Job', 'Other'];
const EXPENSE_CATS = ['Food', 'Transport', 'Education', 'Internet', 'Shopping', 'Entertainment', 'Hostel/Room Rent', 'Other'];
const ALL_CATS = [...INCOME_CATS, ...EXPENSE_CATS];

// ============================================
// DOM REFERENCES
// ============================================

const tableBody = document.getElementById('transactionsTableBody');
const loadingState = document.getElementById('loadingState');
const errorState = document.getElementById('errorState');
const tableContainer = document.getElementById('tableContainer');
const retryBtn = document.getElementById('retryBtn');
const themeToggle = document.getElementById('themeToggle');
const toastContainer = document.getElementById('toastContainer');
const searchInput = document.getElementById('searchInput');
const adminTypeFilter = document.getElementById('adminTypeFilter');
const adminCategoryFilter = document.getElementById('adminCategoryFilter');
const exportBtn = document.getElementById('exportBtn');
const recordCount = document.getElementById('recordCount');

const totalIncomeEl = document.getElementById('totalIncome');
const totalExpensesEl = document.getElementById('totalExpenses');
const currentBalanceEl = document.getElementById('currentBalance');
const totalCountEl = document.getElementById('totalCount');

const editModal = new bootstrap.Modal(document.getElementById('editModal'));
const saveEditBtn = document.getElementById('saveEditBtn');
const editId = document.getElementById('editId');
const editDesc = document.getElementById('editDescription');
const editAmount = document.getElementById('editAmount');
const editDate = document.getElementById('editDate');
const editCategory = document.getElementById('editCategory');

const deleteModal = new bootstrap.Modal(document.getElementById('deleteModal'));
const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
let currentDeleteId = null;

let allTransactions = [];
let currentEditId = null;
let pieChart = null;
let barChart = null;
let sortField = 'date';
let sortDir = 'desc';

// ============================================
// DARK MODE
// ============================================

function initTheme() {
    const saved = localStorage.getItem('theme');
    const sysDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (saved === 'dark' || (!saved && sysDark)) {
        document.documentElement.setAttribute('data-theme', 'dark');
        updateIcon(true);
    }
}

function toggleTheme() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    if (isDark) {
        document.documentElement.removeAttribute('data-theme');
        localStorage.setItem('theme', 'light');
        updateIcon(false);
    } else {
        document.documentElement.setAttribute('data-theme', 'dark');
        localStorage.setItem('theme', 'dark');
        updateIcon(true);
    }
    renderCharts();
}

function updateIcon(isDark) {
    themeToggle.innerHTML = isDark ? '<i class="bi bi-sun-fill"></i>' : '<i class="bi bi-moon-stars"></i>';
}

// ============================================
// TOAST
// ============================================

function showToast(msg, type = 'info') {
    const id = 'toast-' + Date.now();
    const bg = { success: 'bg-success', danger: 'bg-danger', warning: 'bg-warning text-dark', info: 'bg-info text-dark' }[type] || 'bg-info';
    const html = `<div id="${id}" class="toast ${bg} text-white border-0" role="alert">
        <div class="d-flex align-items-center px-3 py-2">
            <div class="toast-body fw-semibold">${msg}</div>
            <button type="button" class="btn-close btn-close-white ms-auto" data-bs-dismiss="toast"></button>
        </div></div>`;
    toastContainer.insertAdjacentHTML('beforeend', html);
    const el = document.getElementById(id);
    const t = new bootstrap.Toast(el, { delay: 3000 });
    t.show();
    el.addEventListener('hidden.bs.toast', () => el.remove());
}

// ============================================
// FETCH ALL (GET)
// ============================================

/**
 * async/await: The function pauses at await, event loop handles other tasks,
 * resumes when Promise resolves. Makes async code readable like sync code.
 */
async function fetchTransactions() {
    loadingState.classList.remove('d-none');
    errorState.classList.add('d-none');
    tableContainer.classList.add('d-none');
    
    try {
        const response = await fetch(API_URL);
        
        // fetch() only throws on NETWORK errors. HTTP 404/500 still resolve!
        // response.ok checks status 200-299. We MUST verify manually.
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        // response.json() is a METHOD. () calls it.
        // Returns a Promise resolving to parsed JavaScript object/array.
        const transactions = await response.json();
        
        allTransactions = transactions;
        populateCategoryFilter();
        applyAdminFilters();
        calculateStats(transactions);
        renderCharts();
        
        loadingState.classList.add('d-none');
        tableContainer.classList.remove('d-none');
        
    } catch (err) {
        console.error('Fetch error:', err);
        loadingState.classList.add('d-none');
        errorState.classList.remove('d-none');
    }
}

// ============================================
// POPULATE CATEGORY FILTER
// ============================================

function populateCategoryFilter() {
    adminCategoryFilter.innerHTML = '<option value="all">All Categories</option>';
    ALL_CATS.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat;
        opt.textContent = cat;
        adminCategoryFilter.appendChild(opt);
    });
}

// ============================================
// STATISTICS
// ============================================

function calculateStats(transactions) {
    const income = transactions.filter(t => t.type === 'income').reduce((s, t) => s + parseFloat(t.amount), 0);
    const expenses = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + parseFloat(t.amount), 0);
    const balance = income - expenses;
    
    animateNum(totalIncomeEl, income);
    animateNum(totalExpensesEl, expenses);
    animateNum(currentBalanceEl, balance);
    totalCountEl.textContent = transactions.length;
    
    // Color-code balance card
    const balCard = currentBalanceEl.closest('.card');
    if (balance < 0) {
        balCard.classList.remove('bg-primary');
        balCard.classList.add('bg-danger');
    } else {
        balCard.classList.remove('bg-danger');
        balCard.classList.add('bg-primary');
    }
}

function animateNum(el, target) {
    const start = parseFloat(el.textContent.replace(/,/g, '')) || 0;
    const duration = 500;
    const startTime = performance.now();
    
    function step(now) {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = (start + (target - start) * eased).toFixed(2);
        if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
}

// ============================================
// CHARTS (Chart.js)
// ============================================

function renderCharts() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? '#e2e8f0' : '#333';
    const gridColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
    
    // Pie Chart: Income vs Expense
    const income = allTransactions.filter(t => t.type === 'income').reduce((s, t) => s + parseFloat(t.amount), 0);
    const expense = allTransactions.filter(t => t.type === 'expense').reduce((s, t) => s + parseFloat(t.amount), 0);
    
    const pieCtx = document.getElementById('pieChart');
    if (pieCtx) {
        if (pieChart) pieChart.destroy();
        pieChart = new Chart(pieCtx, {
            type: 'doughnut',
            data: {
                labels: ['Income', 'Expenses'],
                datasets: [{
                    data: [income, expense],
                    backgroundColor: ['#198754', '#dc3545'],
                    borderWidth: 0,
                    hoverOffset: 10
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom', labels: { color: textColor, padding: 20, font: { size: 12 } } },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const val = context.parsed;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const pct = total > 0 ? ((val / total) * 100).toFixed(1) : 0;
                                return ` ₹${val.toFixed(2)} (${pct}%)`;
                            }
                        }
                    }
                },
                cutout: '60%'
            }
        });
    }
    
    // Bar Chart: Category breakdown (top 6)
    const barCtx = document.getElementById('barChart');
    if (barCtx) {
        if (barChart) barChart.destroy();
        
        const catTotals = {};
        allTransactions.forEach(t => {
            catTotals[t.category] = (catTotals[t.category] || 0) + parseFloat(t.amount);
        });
        
        const sorted = Object.entries(catTotals).sort((a, b) => b[1] - a[1]).slice(0, 6);
        const labels = sorted.map(x => x[0]);
        const data = sorted.map(x => x[1]);
        
        barChart = new Chart(barCtx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Amount (₹)',
                    data: data,
                    backgroundColor: ['#0d6efd', '#198754', '#dc3545', '#ffc107', '#6f42c1', '#fd7e14'],
                    borderRadius: 6,
                    borderSkipped: false
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: { callbacks: { label: ctx => ` ₹${ctx.parsed.y.toFixed(2)}` } }
                },
                scales: {
                    x: { ticks: { color: textColor }, grid: { color: gridColor } },
                    y: { ticks: { color: textColor }, grid: { color: gridColor } }
                }
            }
        });
    }
}

// ============================================
// FILTERING, SEARCH & SORTING
// ============================================

let searchTimer = null;

function handleSearch() {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
        applyAdminFilters();
    }, 300); // Debounce: wait 300ms after user stops typing
}

function applyAdminFilters() {
    const query = searchInput.value.trim().toLowerCase();
    const typeVal = adminTypeFilter.value;
    const catVal = adminCategoryFilter.value;
    
    let filtered = [...allTransactions];
    
    if (query) {
        filtered = filtered.filter(t => t.description.toLowerCase().includes(query));
    }
    if (typeVal !== 'all') {
        filtered = filtered.filter(t => t.type === typeVal);
    }
    if (catVal !== 'all') {
        filtered = filtered.filter(t => t.category === catVal);
    }
    
    // Sort
    filtered.sort((a, b) => {
        let valA = a[sortField];
        let valB = b[sortField];
        
        if (sortField === 'amount') {
            valA = parseFloat(valA);
            valB = parseFloat(valB);
        } else if (sortField === 'date') {
            valA = new Date(valA);
            valB = new Date(valB);
        }
        
        if (valA < valB) return sortDir === 'asc' ? -1 : 1;
        if (valA > valB) return sortDir === 'asc' ? 1 : -1;
        return 0;
    });
    
    renderTable(filtered);
    recordCount.textContent = `${filtered.length} record${filtered.length !== 1 ? 's' : ''}`;
}

// Sort handler - make global for onclick
window.sortTable = function(field) {
    if (sortField === field) {
        sortDir = sortDir === 'asc' ? 'desc' : 'asc';
    } else {
        sortField = field;
        sortDir = 'desc';
    }
    applyAdminFilters();
};

// ============================================
// RENDER TABLE
// ============================================

// ============================================
// RENDER TABLE (UPDATED WITH FIXES)
// ============================================

function renderTable(transactions) {
    if (transactions.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-muted"><i class="bi bi-inbox display-4 d-block mb-2"></i>No transactions found.</td></tr>`;
        return;
    }
    
    tableBody.innerHTML = transactions.map((t, index) => {
        const isIncome = t.type === 'income';
        const badge = isIncome 
            ? '<span class="badge bg-success"><i class="bi bi-arrow-down-circle me-1"></i>Income</span>'
            : '<span class="badge bg-danger"><i class="bi bi-arrow-up-circle me-1"></i>Expense</span>';
        const amtClass = isIncome ? 'text-success' : 'text-danger';
        const sign = isIncome ? '+' : '-';
        
        // SMART ID FIX: Create a visual sequential number
        // This ensures the oldest is always #1 and newest gets the highest number
        // If a record is deleted, everything instantly recalculates!
        const visualId = transactions.length - index;
        
        return `
            <tr class="align-middle">
                <td class="text-muted font-monospace fw-bold text-primary">#${visualId}</td>
                <td class="fw-semibold">${escapeHtml(t.description)}</td>
                <td><span class="badge bg-secondary bg-opacity-10 text-secondary">${t.category}</span></td>
                <td>${badge}</td>
                <td class="fw-bold ${amtClass}">${sign}₹${parseFloat(t.amount).toFixed(2)}</td>
                <td>${formatDate(t.date)}</td>
                <td class="text-center">
                    <button class="btn btn-warning btn-sm me-1" onclick="openEditModal('${t.id}')" title="Edit"><i class="bi bi-pencil-square"></i></button>
                    <button class="btn btn-danger btn-sm" onclick="deleteTransaction('${t.id}')" title="Delete"><i class="bi bi-trash"></i></button>
                </td>
            </tr>
        `;
    }).join('');
}

// ============================================
// EDIT (PUT)
// ============================================

/**
 * PUT = FULL REPLACEMENT. We send the COMPLETE updated object.
 * The server replaces the ENTIRE resource. If we omit a field, it's lost.
 * PATCH = PARTIAL UPDATE (only changed fields). We use PUT for simplicity.
 */

async function openEditModal(id) {
    currentEditId = id;
    try {
        const response = await fetch(`${API_URL}/${id}`);
        if (!response.ok) throw new Error(`Load failed: ${response.status}`);
        
        const t = await response.json();
        
        editId.value = t.id;
        editDesc.value = t.description;
        editAmount.value = t.amount;
        editDate.value = t.date;
        
        const radio = document.querySelector(`input[name="editType"][value="${t.type}"]`);
        if (radio) radio.checked = true;
        
        updateEditCategories(t.type, t.category);
        editModal.show();
        
    } catch (err) {
        console.error(err);
        showToast('Failed to load transaction.', 'danger');
    }
}

function updateEditCategories(type, selected = '') {
    editCategory.innerHTML = '';
    const cats = type === 'income' ? INCOME_CATS : EXPENSE_CATS;
    cats.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat;
        opt.textContent = cat;
        if (cat === selected) opt.selected = true;
        editCategory.appendChild(opt);
    });
}

async function saveEdit() {
    if (!editDesc.value.trim() || editDesc.value.length < 3) {
        editDesc.classList.add('is-invalid');
        return;
    }
    if (!editAmount.value || parseFloat(editAmount.value) <= 0) {
        editAmount.classList.add('is-invalid');
        return;
    }
    
    const typeRadio = document.querySelector('input[name="editType"]:checked');
    
    // Build COMPLETE object for PUT (full replacement)
    const updated = {
        id: currentEditId,
        description: editDesc.value.trim(),
        amount: parseFloat(editAmount.value),
        date: editDate.value,
        type: typeRadio ? typeRadio.value : 'expense',
        category: editCategory.value,
        updatedAt: new Date().toISOString()
    };
    
    saveEditBtn.disabled = true;
    saveEditBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Saving...';
    
    try {
        const response = await fetch(`${API_URL}/${currentEditId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updated)
        });
        
        if (!response.ok) throw new Error(`Update failed: ${response.status}`);
        
        showToast('Transaction updated!', 'success');
        editModal.hide();
        await fetchTransactions();
        
    } catch (err) {
        console.error(err);
        showToast('Update failed.', 'danger');
    } finally {
        saveEditBtn.disabled = false;
        saveEditBtn.innerHTML = '<i class="bi bi-check-lg me-1"></i>Save Changes';
    }
}

// ============================================
// DELETE
// ============================================
// ============================================
// DELETE (UPDATED WITH MODAL)
// ============================================

// 1. Opens the stylish modal instead of the browser alert
function deleteTransaction(id) {
    currentDeleteId = id;
    deleteModal.show();
}

// 2. Executes the actual deletion when the red button is clicked
async function executeDelete() {
    if (!currentDeleteId) return;
    
    // Show loading state on the button
    const originalText = confirmDeleteBtn.innerHTML;
    confirmDeleteBtn.disabled = true;
    confirmDeleteBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Deleting...';
    
    try {
        const response = await fetch(`${API_URL}/${currentDeleteId}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) throw new Error(`Delete failed: ${response.status}`);
        
        showToast('Transaction deleted successfully.', 'success');
        deleteModal.hide();
        await fetchTransactions(); // Refresh the table and stats
        
    } catch (err) {
        console.error(err);
        showToast('Delete failed.', 'danger');
    } finally {
        // Reset button state
        confirmDeleteBtn.disabled = false;
        confirmDeleteBtn.innerHTML = originalText;
        currentDeleteId = null;
    }
}

// ============================================
// EXPORT CSV
// ============================================

function exportToCSV() {
    if (allTransactions.length === 0) {
        showToast('No data to export.', 'warning');
        return;
    }
    
    const headers = ['ID', 'Description', 'Amount', 'Date', 'Type', 'Category'];
    const rows = allTransactions.map(t => [
        t.id,
        `"${t.description.replace(/"/g, '""')}"`,
        t.amount,
        t.date,
        t.type,
        t.category
    ]);
    
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `budget-export-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showToast('CSV exported!', 'success');
}

// ============================================
// HELPERS
// ============================================

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(ds) {
    return new Date(ds).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ============================================
// EVENT LISTENERS
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    fetchTransactions();
    
    themeToggle.addEventListener('click', toggleTheme);
    retryBtn.addEventListener('click', fetchTransactions);
    saveEditBtn.addEventListener('click', saveEdit);
    exportBtn.addEventListener('click', exportToCSV);
    
    searchInput.addEventListener('input', handleSearch);
    adminTypeFilter.addEventListener('change', applyAdminFilters);
    adminCategoryFilter.addEventListener('change', applyAdminFilters);

    confirmDeleteBtn.addEventListener('click', executeDelete);
    
    document.querySelectorAll('input[name="editType"]').forEach(r => {
        r.addEventListener('change', (e) => updateEditCategories(e.target.value));
    });
    
    [editDesc, editAmount].forEach(f => {
        f.addEventListener('input', () => f.classList.remove('is-invalid'));
    });
});