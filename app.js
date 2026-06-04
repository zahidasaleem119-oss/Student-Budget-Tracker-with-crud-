/**
 * STUDENT BUDGET TRACKER - ADVANCED USER PANEL (app.js)
 * ======================================================
 * Features: GET, POST, inline validation, category/type filters,
 * search, mini stats, Chart.js pie chart, dark mode, toast notifications,
 * export to CSV, pagination, staggered animations.
 */

// ============================================
// CONFIGURATION
// ============================================

const API_URL = 'http://localhost:3000/transactions';

const INCOME_CATEGORIES = ['Pocket Money', 'Scholarship', 'Freelancing', 'Part-Time Job', 'Other'];
const EXPENSE_CATEGORIES = ['Food', 'Transport', 'Education', 'Internet', 'Shopping', 'Entertainment', 'Hostel/Room Rent', 'Other'];
const ALL_CATEGORIES = [...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES];

// ============================================
// DOM REFERENCES
// ============================================

const transactionsList = document.getElementById('transactionsList');
const loadingState = document.getElementById('loadingState');
const errorState = document.getElementById('errorState');
const emptyState = document.getElementById('emptyState');
const searchInput = document.getElementById('searchInput');
const typeFilter = document.getElementById('typeFilter');
const categoryFilter = document.getElementById('categoryFilter');
const transactionForm = document.getElementById('transactionForm');
const themeToggle = document.getElementById('themeToggle');
const retryBtn = document.getElementById('retryBtn');
const toastContainer = document.getElementById('toastContainer');
const descInput = document.getElementById('description');
const amountInput = document.getElementById('amount');
const dateInput = document.getElementById('date');
const categorySelect = document.getElementById('category');

// Stats elements
const userIncomeEl = document.getElementById('userIncome');
const userExpensesEl = document.getElementById('userExpenses');
const userBalanceEl = document.getElementById('userBalance');

// Global data store
let allTransactions = [];
let currentPage = 1;
const ITEMS_PER_PAGE = 6;
let pieChartInstance = null;

// ============================================
// DARK MODE
// ============================================

function initTheme() {
    const saved = localStorage.getItem('theme');
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (saved === 'dark' || (!saved && systemDark)) {
        document.documentElement.setAttribute('data-theme', 'dark');
        updateThemeIcon(true);
    }
}

function toggleTheme() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    if (isDark) {
        document.documentElement.removeAttribute('data-theme');
        localStorage.setItem('theme', 'light');
        updateThemeIcon(false);
    } else {
        document.documentElement.setAttribute('data-theme', 'dark');
        localStorage.setItem('theme', 'dark');
        updateThemeIcon(true);
    }
    // Re-render charts with new colors
    if (pieChartInstance) pieChartInstance.destroy();
    renderPieChart();
}

function updateThemeIcon(isDark) {
    themeToggle.innerHTML = isDark ? '<i class="bi bi-sun-fill"></i>' : '<i class="bi bi-moon-stars"></i>';
}

// ============================================
// TOAST NOTIFICATIONS
// ============================================

function showToast(message, type = 'info') {
    const toastId = 'toast-' + Date.now();
    const bgMap = { success: 'bg-success', danger: 'bg-danger', warning: 'bg-warning text-dark', info: 'bg-info text-dark' };
    const bgClass = bgMap[type] || bgMap.info;
    
    const html = `
        <div id="${toastId}" class="toast ${bgClass} text-white border-0" role="alert">
            <div class="d-flex align-items-center px-3 py-2">
                <div class="toast-body fw-semibold">${message}</div>
                <button type="button" class="btn-close btn-close-white ms-auto" data-bs-dismiss="toast"></button>
            </div>
        </div>`;
    
    toastContainer.insertAdjacentHTML('beforeend', html);
    const el = document.getElementById(toastId);
    const toast = new bootstrap.Toast(el, { delay: 3000 });
    toast.show();
    el.addEventListener('hidden.bs.toast', () => el.remove());
}

// ============================================
// CATEGORY POPULATION
// ============================================

function populateCategoryFilter() {
    categoryFilter.innerHTML = '<option value="all">All Categories</option>';
    ALL_CATEGORIES.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat;
        opt.textContent = cat;
        categoryFilter.appendChild(opt);
    });
}

function updateCategoryOptions(type) {
    categorySelect.innerHTML = '<option value="" disabled selected>Select a category</option>';
    const cats = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
    cats.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat;
        opt.textContent = cat;
        categorySelect.appendChild(opt);
    });
}

// ============================================
// FETCH TRANSACTIONS (GET)
// ============================================

/**
 * async/await: Makes async code look synchronous.
 * The function pauses at 'await', the event loop handles other tasks,
 * then resumes when the Promise resolves.
 */
async function fetchTransactions() {
    loadingState.classList.remove('d-none');
    errorState.classList.add('d-none');
    transactionsList.classList.add('d-none');
    emptyState.classList.add('d-none');
    
    try {
        const response = await fetch(API_URL);
        
        // response.ok is true for HTTP 200-299.
        // fetch() does NOT throw on 404/500! We MUST check manually.
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        // response.json() is a METHOD. The () CALL it.
        // Returns a Promise that resolves to parsed JSON.
        const transactions = await response.json();
        
        allTransactions = transactions;
        populateCategoryFilter();
        applyFilters();
        calculateUserStats(transactions);
        renderPieChart();
        
        loadingState.classList.add('d-none');
        
    } catch (error) {
        console.error('Fetch error:', error);
        loadingState.classList.add('d-none');
        errorState.classList.remove('d-none');
    }
}

// ============================================
// CALCULATE STATS
// ============================================

function calculateUserStats(transactions) {
    const income = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + parseFloat(t.amount), 0);
    const expenses = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + parseFloat(t.amount), 0);
    const balance = income - expenses;
    
    animateNumber(userIncomeEl, income);
    animateNumber(userExpensesEl, expenses);
    animateNumber(userBalanceEl, balance);
}

/**
 * Animate a number counting up with easing.
 * Uses requestAnimationFrame for smooth 60fps animation.
 */
function animateNumber(element, target) {
    const start = parseFloat(element.textContent.replace(/,/g, '')) || 0;
    const duration = 600;
    const startTime = performance.now();
    
    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        // Ease out cubic: starts fast, slows down
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = start + (target - start) * eased;
        element.textContent = current.toFixed(2);
        
        if (progress < 1) {
            requestAnimationFrame(update);
        }
    }
    requestAnimationFrame(update);
}

// ============================================
// PIE CHART (Chart.js)
// ============================================

function renderPieChart() {
    const ctx = document.getElementById('pieChart');
    if (!ctx) return;
    
    const income = allTransactions.filter(t => t.type === 'income').reduce((s, t) => s + parseFloat(t.amount), 0);
    const expense = allTransactions.filter(t => t.type === 'expense').reduce((s, t) => s + parseFloat(t.amount), 0);
    
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    
    if (pieChartInstance) pieChartInstance.destroy();
    
    pieChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Income', 'Expenses'],
            datasets: [{
                data: [income, expense],
                backgroundColor: ['#198754', '#dc3545'],
                borderWidth: 0,
                hoverOffset: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: isDark ? '#e2e8f0' : '#333', padding: 20 }
                },
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
            cutout: '65%'
        }
    });
}

// ============================================
// FILTERING & SEARCH (with debounce)
// ============================================

/**
 * Debouncing: Waits 300ms after user STOPS typing before searching.
 * Prevents overwhelming the browser with rapid function calls.
 */
let searchTimeout = null;

function handleSearch() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        currentPage = 1;
        applyFilters();
    }, 300);
}

function applyFilters() {
    const query = searchInput.value.trim().toLowerCase();
    const typeVal = typeFilter.value;
    const catVal = categoryFilter.value;
    
    let filtered = allTransactions;
    
    if (query) {
        filtered = filtered.filter(t => t.description.toLowerCase().includes(query));
    }
    if (typeVal !== 'all') {
        filtered = filtered.filter(t => t.type === typeVal);
    }
    if (catVal !== 'all') {
        filtered = filtered.filter(t => t.category === catVal);
    }
    
    // Sort by date descending
    filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    renderTransactions(filtered);
}

// ============================================
// RENDER TRANSACTIONS (with pagination)
// ============================================

function renderTransactions(transactions) {
    if (transactions.length === 0) {
        transactionsList.classList.add('d-none');
        emptyState.classList.remove('d-none');
        return;
    }
    
    emptyState.classList.add('d-none');
    transactionsList.classList.remove('d-none');
    
    // Pagination
    const totalPages = Math.ceil(transactions.length / ITEMS_PER_PAGE);
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginated = transactions.slice(start, start + ITEMS_PER_PAGE);
    
    transactionsList.innerHTML = paginated.map((t, index) => {
        const isIncome = t.type === 'income';
        const typeClass = isIncome ? 'income' : 'expense';
        const badge = isIncome 
            ? '<span class="badge bg-success"><i class="bi bi-arrow-down-circle me-1"></i>Income</span>'
            : '<span class="badge bg-danger"><i class="bi bi-arrow-up-circle me-1"></i>Expense</span>';
        const amountColor = isIncome ? 'text-success' : 'text-danger';
        const sign = isIncome ? '+' : '-';
        const delay = index * 0.05; // Staggered animation delay
        
        return `
            <div class="col-md-6 col-lg-4" style="animation: fadeInUp 0.4s ease ${delay}s both;">
                <div class="card shadow-sm transaction-card ${typeClass} h-100">
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-start mb-2">
                            <h6 class="card-title mb-0 fw-bold text-truncate" style="max-width: 65%;">${escapeHtml(t.description)}</h6>
                            ${badge}
                        </div>
                        <p class="text-muted mb-2 small"><i class="bi bi-tag me-1"></i>${t.category}</p>
                        <div class="d-flex justify-content-between align-items-end">
                            <span class="amount-display ${amountColor}">${sign}₹${parseFloat(t.amount).toFixed(2)}</span>
                            <small class="text-muted"><i class="bi bi-calendar3 me-1"></i>${formatDate(t.date)}</small>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    // Render pagination if needed
    if (totalPages > 1) {
        renderPagination(totalPages, transactions.length);
    }
}

function renderPagination(totalPages, totalItems) {
    let html = '<div class="col-12 mt-3"><nav><ul class="pagination justify-content-center">';
    
    // Previous
    html += `<li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
        <a class="page-link" href="#" onclick="changePage(${currentPage - 1}); return false;">Previous</a></li>`;
    
    // Page numbers (show max 5)
    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
            html += `<li class="page-item ${i === currentPage ? 'active' : ''}">
                <a class="page-link" href="#" onclick="changePage(${i}); return false;">${i}</a></li>`;
        } else if (i === currentPage - 2 || i === currentPage + 2) {
            html += '<li class="page-item disabled"><span class="page-link">...</span></li>';
        }
    }
    
    // Next
    html += `<li class="page-item ${currentPage === totalPages ? 'disabled' : ''}">
        <a class="page-link" href="#" onclick="changePage(${currentPage + 1}); return false;">Next</a></li>`;
    
    html += '</ul></nav>';
    html += `<p class="text-center text-muted small mt-2">Showing ${(currentPage - 1) * ITEMS_PER_PAGE + 1}-${Math.min(currentPage * ITEMS_PER_PAGE, totalItems)} of ${totalItems}</p></div>`;
    
    transactionsList.insertAdjacentHTML('beforeend', html);
}

// Global for onclick handlers
window.changePage = function(page) {
    currentPage = page;
    applyFilters();
};

// ============================================
// FORM VALIDATION
// ============================================

function validateForm() {
    let valid = true;
    
    if (!descInput.value.trim() || descInput.value.length < 3) {
        descInput.classList.add('is-invalid'); valid = false;
    } else { descInput.classList.remove('is-invalid'); }
    
    const amt = parseFloat(amountInput.value);
    if (isNaN(amt) || amt <= 0) {
        amountInput.classList.add('is-invalid'); valid = false;
    } else { amountInput.classList.remove('is-invalid'); }
    
    if (!dateInput.value) {
        dateInput.classList.add('is-invalid'); valid = false;
    } else { dateInput.classList.remove('is-invalid'); }
    
    const typeSelected = document.querySelector('input[name="type"]:checked');
    const typeError = document.getElementById('typeError');
    if (!typeSelected) { typeError.style.display = 'block'; valid = false; }
    else { typeError.style.display = 'none'; }
    
    if (!categorySelect.value) {
        categorySelect.classList.add('is-invalid'); valid = false;
    } else { categorySelect.classList.remove('is-invalid'); }
    
    return valid;
}

// ============================================
// ADD TRANSACTION (POST)
// ============================================

/**
 * e.preventDefault() stops the browser from reloading the page
 * when the form submits. Instead, we handle it with JavaScript fetch().
 */
async function handleFormSubmit(e) {
    e.preventDefault();
    
    if (!validateForm()) {
        showToast('Please fix the form errors.', 'warning');
        return;
    }
    
    const newTx = {
        description: descInput.value.trim(),
        amount: parseFloat(amountInput.value),
        date: dateInput.value,
        type: document.querySelector('input[name="type"]:checked').value,
        category: categorySelect.value,
        createdAt: new Date().toISOString()
    };
    
    const btn = transactionForm.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Adding...';
    
    try {
        // POST creates a NEW resource. Server assigns the ID.
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newTx)
        });
        
        if (!response.ok) throw new Error(`Server error: ${response.status}`);
        
        await response.json();
        
        showToast('Transaction added successfully!', 'success');
        transactionForm.reset();
        categorySelect.innerHTML = '<option value="" disabled selected>Select type first</option>';
        document.querySelectorAll('.is-invalid').forEach(el => el.classList.remove('is-invalid'));
        
        await fetchTransactions();
        
    } catch (error) {
        console.error('Add error:', error);
        showToast('Failed to add transaction.', 'danger');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="bi bi-check-circle me-2"></i>Add Transaction';
    }
}

// ============================================
// EXPORT TO CSV
// ============================================

function exportToCSV() {
    if (allTransactions.length === 0) {
        showToast('No data to export.', 'warning');
        return;
    }
    
    const headers = ['ID', 'Description', 'Amount', 'Date', 'Type', 'Category'];
    const rows = allTransactions.map(t => [t.id, `"${t.description}"`, t.amount, t.date, t.type, t.category]);
    
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `budget-tracker-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showToast('CSV exported successfully!', 'success');
}

// ============================================
// HELPERS
// ============================================

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ============================================
// EVENT LISTENERS
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    populateCategoryFilter();
    dateInput.valueAsDate = new Date();
    fetchTransactions();
    
    themeToggle.addEventListener('click', toggleTheme);
    retryBtn.addEventListener('click', fetchTransactions);
    searchInput.addEventListener('input', handleSearch);
    typeFilter.addEventListener('change', () => { currentPage = 1; applyFilters(); });
    categoryFilter.addEventListener('change', () => { currentPage = 1; applyFilters(); });
    transactionForm.addEventListener('submit', handleFormSubmit);
    
    document.querySelectorAll('input[name="type"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            updateCategoryOptions(e.target.value);
            categorySelect.classList.remove('is-invalid');
        });
    });
    
    [descInput, amountInput, dateInput, categorySelect].forEach(field => {
        field.addEventListener('input', () => field.classList.remove('is-invalid'));
    });
});