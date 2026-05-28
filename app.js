/**
 * app.js — Expense & Budget Visualizer
 * Single JS file. All logic wrapped in an IIFE to avoid global pollution.
 * Architecture: unidirectional data flow — action → state mutation → render.
 */
(function () {
  'use strict';

  /* ================================================================
     CONSTANTS
  ================================================================ */
  const LS_KEYS = {
    transactions: 'ebv_transactions',
    theme:        'ebv_theme',
    budgetLimits: 'ebv_budget_limits',
  };

  const CATEGORIES = ['Food', 'Transport', 'Fun'];

  /** Transactions above this amount are highlighted regardless of budget limits. */
  const HIGH_SPEND_THRESHOLD = 100_000;

  const CATEGORY_COLORS = {
    Food:      '#4f6ef7',
    Transport: '#f7a84f',
    Fun:       '#4fc97e',
  };

  const CATEGORY_WARNING_COLORS = {
    Food:      '#e05252',
    Transport: '#c0392b',
    Fun:       '#e74c3c',
  };

  /* ================================================================
     APP STATE
  ================================================================ */
  let transactions  = [];   // Transaction[]
  let budgetLimits  = { Food: null, Transport: null, Fun: null };
  let currentSort   = 'all';
  let currentTheme  = 'light';
  let chartInstance = null; // Chart.js instance

  /* ================================================================
     STORAGE MODULE
  ================================================================ */

  /**
   * Load transactions from localStorage.
   * Returns [] on missing key, parse failure, or invalid shape.
   */
  function loadTransactions() {
    try {
      const raw = localStorage.getItem(LS_KEYS.transactions);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      // Filter out any malformed entries
      return parsed.filter(
        (t) =>
          typeof t.id        === 'string' &&
          typeof t.name      === 'string' &&
          typeof t.amount    === 'number' &&
          typeof t.category  === 'string' &&
          typeof t.timestamp === 'number'
      );
    } catch {
      showToast('Stored data was corrupted and has been cleared.');
      return [];
    }
  }

  /**
   * Persist transactions to localStorage.
   * Shows a toast on write failure; does NOT roll back in-memory state.
   */
  function saveTransactions(txns) {
    try {
      localStorage.setItem(LS_KEYS.transactions, JSON.stringify(txns));
    } catch {
      showToast('Failed to save transactions. Storage may be full.');
    }
  }

  /** Returns 'light' | 'dark'. Defaults to 'light' on any invalid value. */
  function loadTheme() {
    try {
      const val = localStorage.getItem(LS_KEYS.theme);
      return val === 'dark' ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  }

  /** Persists theme. Silently swallows write errors (non-critical). */
  function saveTheme(theme) {
    try {
      localStorage.setItem(LS_KEYS.theme, theme);
    } catch {
      console.warn('Could not persist theme preference.');
    }
  }

  /** Returns BudgetLimits object. Falls back to all-null on failure. */
  function loadBudgetLimits() {
    try {
      const raw = localStorage.getItem(LS_KEYS.budgetLimits);
      if (!raw) return { Food: null, Transport: null, Fun: null };
      const parsed = JSON.parse(raw);
      return {
        Food:      typeof parsed.Food      === 'number' ? parsed.Food      : null,
        Transport: typeof parsed.Transport === 'number' ? parsed.Transport : null,
        Fun:       typeof parsed.Fun       === 'number' ? parsed.Fun       : null,
      };
    } catch {
      return { Food: null, Transport: null, Fun: null };
    }
  }

  /** Persists budget limits. Silently swallows write errors (non-critical). */
  function saveBudgetLimits(limits) {
    try {
      localStorage.setItem(LS_KEYS.budgetLimits, JSON.stringify(limits));
    } catch {
      console.warn('Could not persist budget limits.');
    }
  }

  /* ================================================================
     UTILITIES
  ================================================================ */

  /**
   * Format a number as Indonesian Rupiah: Rp 10.000
   * Uses locale "id-ID" and currency "IDR".
   * IDR has no decimal fraction, so minimumFractionDigits is 0.
   * @param {number} amount
   * @returns {string}
   */
  function formatCurrency(amount) {
    return new Intl.NumberFormat('id-ID', {
      style:                 'currency',
      currency:              'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  }

  /**
   * Generate a unique ID. Uses crypto.randomUUID() when available,
   * falls back to a timestamp + random suffix.
   * @returns {string}
   */
  function generateId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  /**
   * Show a toast notification for a given duration.
   * @param {string} message
   * @param {number} [duration=4000]
   */
  function showToast(message, duration = 4000) {
    const toast = document.getElementById('toast-error');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.remove('toast--hidden');
    clearTimeout(toast._hideTimer);
    toast._hideTimer = setTimeout(() => {
      toast.classList.add('toast--hidden');
    }, duration);
  }

  /* ================================================================
     VALIDATOR
  ================================================================ */

  /**
   * Validate the transaction form inputs.
   * @param {string} name
   * @param {string} amountStr  — raw string from the input
   * @param {string} category
   * @returns {{ valid: boolean, errors: { name?: string, amount?: string, category?: string } }}
   */
  function validateForm(name, amountStr, category) {
    const errors = {};

    // Name: required, non-whitespace, max 100 chars
    if (!name || name.trim().length === 0) {
      errors.name = 'Item name is required.';
    } else if (name.trim().length > 100) {
      errors.name = 'Item name must be 100 characters or fewer.';
    }

    // Amount: required, numeric, in range [0.01, 999_999_999.99]
    const amount = parseFloat(amountStr);
    if (amountStr === '' || amountStr === null || amountStr === undefined) {
      errors.amount = 'Amount is required.';
    } else if (isNaN(amount) || amount <= 0) {
      errors.amount = 'Amount must be a positive number.';
    } else if (amount > 999_999_999.99) {
      errors.amount = 'Amount must be less than Rp 999.999.999.';
    }

    // Category: must be one of the three valid options
    if (!category || !CATEGORIES.includes(category)) {
      errors.category = 'Please select a category.';
    }

    return { valid: Object.keys(errors).length === 0, errors };
  }

  /**
   * Validate a budget limit input value.
   * @param {string} valueStr
   * @returns {{ valid: boolean, error?: string }}
   */
  function validateBudgetLimit(valueStr) {
    if (valueStr === '' || valueStr === null || valueStr === undefined) {
      // Empty = clear the limit (valid)
      return { valid: true };
    }
    const val = parseFloat(valueStr);
    if (isNaN(val) || val <= 0) {
      return { valid: false, error: 'Limit must be a positive number.' };
    }
    if (val > 999_999_999.99) {
      return { valid: false, error: 'Limit must be less than Rp 999.999.999.' };
    }
    return { valid: true };
  }

  /** Show or clear an inline error message for a field. */
  function setFieldError(errorSpanId, message) {
    const span = document.getElementById(errorSpanId);
    if (!span) return;
    span.textContent = message || '';
  }

  /** Apply or remove the .is-invalid class on a form control. */
  function setFieldInvalid(fieldId, isInvalid) {
    const el = document.getElementById(fieldId);
    if (!el) return;
    el.classList.toggle('is-invalid', isInvalid);
  }

  /** Clear all form validation state. */
  function clearFormErrors() {
    ['item-name', 'item-amount', 'item-category'].forEach((id) => setFieldInvalid(id, false));
    ['error-name', 'error-amount', 'error-category'].forEach((id) => setFieldError(id, ''));
  }

  /* ================================================================
     TRANSACTION MANAGER
  ================================================================ */

  /**
   * Add a new transaction to state, persist, and re-render.
   * @param {string} name
   * @param {number} amount
   * @param {string} category
   */
  function addTransaction(name, amount, category) {
    const tx = {
      id:        generateId(),
      name:      name.trim(),
      amount:    parseFloat(amount.toFixed(2)),
      category,
      timestamp: Date.now(),
    };
    transactions.push(tx);
    saveTransactions(transactions);
    render();
  }

  /**
   * Delete a transaction by ID.
   * On storage failure: shows toast and does NOT remove from state.
   * @param {string} id
   */
  function deleteTransaction(id) {
    const index = transactions.findIndex((t) => t.id === id);
    if (index === -1) return;

    const removed = transactions.splice(index, 1);
    try {
      localStorage.setItem(LS_KEYS.transactions, JSON.stringify(transactions));
    } catch {
      // Rollback: put the transaction back
      transactions.splice(index, 0, removed[0]);
      showToast('Failed to delete transaction. Please try again.');
      return;
    }
    render();
  }

  /**
   * Filter and/or sort transactions based on the current control value.
   *
   * Sort/filter keys:
   *   all                — all transactions, insertion order (newest first)
   *   amount-desc        — all transactions, highest amount first
   *   amount-asc         — all transactions, lowest amount first
   *   category-Food      — only Food transactions, insertion order
   *   category-Transport — only Transport transactions, insertion order
   *   category-Fun       — only Fun transactions, insertion order
   *
   * Ties in amount sorts are broken by timestamp (insertion order).
   *
   * @param {Array}  txns
   * @param {string} sortKey
   * @returns {Array}
   */
  function getFilteredSorted(txns, sortKey) {
    // ── Category filter: show only matching transactions ──
    if (sortKey.startsWith('category-')) {
      const target = sortKey.replace('category-', ''); // 'Food' | 'Transport' | 'Fun'
      return txns
        .filter((t) => t.category === target)
        .sort((a, b) => b.timestamp - a.timestamp); // newest first within category
    }

    // ── Amount sort: show all, sorted by amount ──
    const copy = [...txns];
    if (sortKey === 'amount-asc') {
      copy.sort((a, b) => a.amount - b.amount || a.timestamp - b.timestamp);
    } else if (sortKey === 'amount-desc') {
      copy.sort((a, b) => b.amount - a.amount || a.timestamp - b.timestamp);
    } else {
      // 'all' — newest first (default insertion order)
      copy.sort((a, b) => b.timestamp - a.timestamp);
    }
    return copy;
  }

  /* ================================================================
     CATEGORY TOTALS HELPER
  ================================================================ */

  /**
   * Compute per-category spending totals.
   * @param {Array} txns
   * @returns {{ Food: number, Transport: number, Fun: number }}
   */
  function getCategoryTotals(txns) {
    return txns.reduce(
      (acc, t) => {
        acc[t.category] = (acc[t.category] || 0) + t.amount;
        return acc;
      },
      { Food: 0, Transport: 0, Fun: 0 }
    );
  }

  /* ================================================================
     UI RENDERER — TRANSACTION LIST
  ================================================================ */

  /**
   * Rebuild the #transaction-list DOM from the current sorted transactions.
   * Applies over-budget and high-spend warning classes.
   * @param {Array} sortedTxns
   */
  function renderTransactionList(sortedTxns) {
    const listEl = document.getElementById('transaction-list');
    if (!listEl) return;

    // Clear existing items (keep the empty-state paragraph in DOM but hide it)
    const emptyMsg = document.getElementById('empty-state-msg');

    // Remove all transaction items (not the empty-state paragraph)
    Array.from(listEl.querySelectorAll('.transaction-item')).forEach((el) => el.remove());

    if (sortedTxns.length === 0) {
      if (emptyMsg) {
        // Distinguish between "no transactions at all" and "filter returned nothing"
        const isFiltered = currentSort.startsWith('category-');
        const category   = isFiltered ? currentSort.replace('category-', '') : '';
        emptyMsg.textContent = isFiltered
          ? `No ${category} transactions yet.`
          : 'No transactions yet. Add one above to get started!';
        emptyMsg.style.display = '';
      }
      return;
    }

    if (emptyMsg) emptyMsg.style.display = 'none';

    const categoryTotals = getCategoryTotals(transactions);

    sortedTxns.forEach((tx) => {
      const isOverBudget =
        budgetLimits[tx.category] !== null &&
        categoryTotals[tx.category] > budgetLimits[tx.category];

      const isHighSpend = tx.amount > HIGH_SPEND_THRESHOLD;

      // Determine warning reason for aria label
      let warningNote = '';
      if (isOverBudget) warningNote = ' (over budget)';
      else if (isHighSpend) warningNote = ' (high spend)';

      const item = document.createElement('div');
      item.className = 'transaction-item';
      item.setAttribute('role', 'listitem');
      item.dataset.id = tx.id;

      if (isOverBudget) item.classList.add('is-over-budget');
      if (isHighSpend && !isOverBudget) item.classList.add('is-high-spend');

      // Category CSS modifier (lowercase)
      const catClass = tx.category.toLowerCase();

      item.innerHTML = `
        <div class="transaction-item__info">
          <div class="transaction-item__name" title="${escapeHtml(tx.name)}">${escapeHtml(tx.name)}${warningNote ? `<span class="warning-badge" aria-label="${warningNote.trim()}">⚠️</span>` : ''}</div>
          <div class="transaction-item__meta">
            <span class="transaction-item__amount">${formatCurrency(tx.amount)}</span>
            <span class="category-badge category-badge--${catClass}">${escapeHtml(tx.category)}</span>
          </div>
        </div>
        <button
          class="btn btn--danger delete-btn"
          data-id="${tx.id}"
          aria-label="Delete transaction: ${escapeHtml(tx.name)}"
          title="Delete"
        >🗑</button>
      `;

      listEl.appendChild(item);
    });
  }

  /** Minimal HTML escape to prevent XSS from user-entered names. */
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /* ================================================================
     UI RENDERER — BALANCE
  ================================================================ */

  /**
   * Update the balance display and per-category summary.
   * @param {Array} txns
   */
  function renderBalance(txns) {
    const total = txns.reduce((sum, t) => sum + t.amount, 0);
    const balanceEl = document.getElementById('balance-display');
    if (balanceEl) balanceEl.textContent = formatCurrency(total);

    // Per-category summary
    const totals = getCategoryTotals(txns);
    CATEGORIES.forEach((cat) => {
      const amountEl = document.getElementById(`summary-amount-${cat}`);
      if (amountEl) amountEl.textContent = formatCurrency(totals[cat]);

      // Apply over-budget warning to summary row
      const rowEl = document.getElementById(`summary-${cat}`);
      if (rowEl) {
        const isOver =
          budgetLimits[cat] !== null && totals[cat] > budgetLimits[cat];
        rowEl.classList.toggle('is-over-budget', isOver);
      }
    });
  }

  /* ================================================================
     UI RENDERER — PIE CHART
  ================================================================ */

  /**
   * Destroy the existing Chart.js instance (if any) and recreate it
   * with current data. Shows empty state when no transactions exist.
   * @param {Array} txns
   */
  function renderChart(txns) {
    const canvas  = document.getElementById('spending-chart');
    const emptyEl = document.getElementById('chart-empty-msg');
    if (!canvas || !emptyEl) return;

    // Guard: Chart.js may not have loaded (e.g. offline or CDN failure)
    if (typeof Chart === 'undefined') {
      canvas.hidden = true;
      emptyEl.hidden = false;
      const textEl = emptyEl.querySelector('.chart-empty__text');
      if (textEl) textEl.textContent = 'Chart unavailable. Check your internet connection.';
      return;
    }

    const totals = getCategoryTotals(txns);
    const activeCategories = CATEGORIES.filter((cat) => totals[cat] > 0);

    // ── Always set visibility unconditionally first ──
    // This ensures the two elements never overlap regardless of render timing.
    const hasData = txns.length > 0 && activeCategories.length > 0;
    canvas.hidden  = !hasData;
    emptyEl.hidden =  hasData;

    // Empty state: destroy any existing chart instance and stop here
    if (!hasData) {
      if (chartInstance) {
        chartInstance.destroy();
        chartInstance = null;
      }
      return;
    }

    // Destroy previous instance before recreating to avoid animation bugs
    if (chartInstance) {
      chartInstance.destroy();
      chartInstance = null;
    }

    const grandTotal = activeCategories.reduce((s, cat) => s + totals[cat], 0);

    // Resolve text colors from the live CSS custom properties so Chart.js
    // stays in sync with both light and dark themes automatically.
    const isDark       = document.body.classList.contains('dark');
    const legendColor  = isDark ? '#e8e8f8' : '#1a1a2e';   // --text-primary equivalent
    const tooltipBg    = isDark ? '#2a2a3e' : '#ffffff';
    const tooltipText  = isDark ? '#e8e8f8' : '#1a1a2e';
    const tooltipBorder= isDark ? '#3a3a5e' : '#e0e3ef';

    const labels     = activeCategories;
    const data       = activeCategories.map((cat) => totals[cat]);
    const bgColors   = activeCategories.map((cat) => {
      const isOver =
        budgetLimits[cat] !== null && totals[cat] > budgetLimits[cat];
      return isOver ? CATEGORY_WARNING_COLORS[cat] : CATEGORY_COLORS[cat];
    });
    const borderColors = bgColors.map((c) => c);

    chartInstance = new Chart(canvas, {
      type: 'pie',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: bgColors,
          borderColor:     borderColors,
          borderWidth:     2,
          hoverOffset:     8,
        }],
      },
      options: {
        responsive:          true,
        maintainAspectRatio: true,
        animation: { duration: 300 },
        plugins: {
          tooltip: {
            backgroundColor: tooltipBg,
            titleColor:      tooltipText,
            bodyColor:       tooltipText,
            borderColor:     tooltipBorder,
            borderWidth:     1,
            callbacks: {
              label(ctx) {
                const val = ctx.parsed;
                const pct = grandTotal > 0 ? ((val / grandTotal) * 100).toFixed(1) : '0.0';
                return ` ${ctx.label}: ${formatCurrency(val)} (${pct}%)`;
              },
            },
          },
          legend: {
            display:  true,
            position: 'bottom',
            labels: {
              color:     legendColor,
              padding:   16,
              boxWidth:  14,
              font:      { size: 13 },
              generateLabels(chart) {
                return chart.data.labels.map((label, i) => {
                  const val = chart.data.datasets[0].data[i];
                  const pct = grandTotal > 0 ? ((val / grandTotal) * 100).toFixed(1) : '0.0';
                  return {
                    text:        `${label}: ${pct}%`,
                    fillStyle:   bgColors[i],
                    strokeStyle: bgColors[i],
                    fontColor:   legendColor,
                    lineWidth:   0,
                    index:       i,
                  };
                });
              },
            },
          },
        },
      },
    });
  }

  /* ================================================================
     MASTER RENDER ORCHESTRATOR
  ================================================================ */

  /**
   * Re-render all UI regions in one pass.
   * Called after every state mutation.
   */
  function render() {
    const sorted = getFilteredSorted(transactions, currentSort);
    renderTransactionList(sorted);
    renderBalance(transactions);
    renderChart(transactions);
  }

  /* ================================================================
     EVENT HANDLERS
  ================================================================ */

  /** Handle transaction form submission. */
  function handleFormSubmit(e) {
    e.preventDefault();

    const nameVal     = document.getElementById('item-name').value;
    const amountVal   = document.getElementById('item-amount').value;
    const categoryVal = document.getElementById('item-category').value;

    const { valid, errors } = validateForm(nameVal, amountVal, categoryVal);

    // Show / clear inline errors
    setFieldError('error-name',     errors.name     || '');
    setFieldError('error-amount',   errors.amount   || '');
    setFieldError('error-category', errors.category || '');
    setFieldInvalid('item-name',     !!errors.name);
    setFieldInvalid('item-amount',   !!errors.amount);
    setFieldInvalid('item-category', !!errors.category);

    if (!valid) return;

    clearFormErrors();
    addTransaction(nameVal, parseFloat(amountVal), categoryVal);

    // Reset form fields
    document.getElementById('item-name').value      = '';
    document.getElementById('item-amount').value    = '';
    document.getElementById('item-category').value  = '';
    document.getElementById('item-name').focus();
  }

  /**
   * Handle delete button clicks via event delegation on #transaction-list.
   * @param {Event} e
   */
  function handleListClick(e) {
    const btn = e.target.closest('.delete-btn');
    if (!btn) return;
    const id = btn.dataset.id;
    if (id) deleteTransaction(id);
  }

  /** Handle sort control change. */
  function handleSortChange(e) {
    currentSort = e.target.value;
    render();
  }

  /** Handle dark/light mode toggle. */
  function handleThemeToggle() {
    currentTheme = currentTheme === 'light' ? 'dark' : 'light';
    applyTheme(currentTheme);
    saveTheme(currentTheme);
    // Re-render the chart so Chart.js picks up the new legend/tooltip colors.
    renderChart(transactions);
  }

  /**
   * Apply a theme to the document.
   * @param {'light'|'dark'} theme
   */
  function applyTheme(theme) {
    document.body.classList.toggle('dark',  theme === 'dark');
    document.body.classList.toggle('light', theme === 'light');

    const toggleBtn  = document.getElementById('theme-toggle');
    const themeIcon  = toggleBtn && toggleBtn.querySelector('.theme-icon');
    if (toggleBtn) {
      toggleBtn.setAttribute(
        'aria-label',
        theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'
      );
    }
    if (themeIcon) {
      themeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
    }
  }

  /**
   * Handle budget limit input changes.
   * @param {Event} e
   */
  function handleBudgetLimitInput(e) {
    const input    = e.target;
    const category = input.id.replace('limit-', ''); // 'Food' | 'Transport' | 'Fun'
    if (!CATEGORIES.includes(category)) return;

    const errorSpanId = `error-limit-${category}`;
    const valueStr    = input.value.trim();

    const { valid, error } = validateBudgetLimit(valueStr);

    setFieldError(errorSpanId, error || '');
    setFieldInvalid(input.id, !valid);

    if (!valid) return;

    // Empty string = clear the limit
    budgetLimits[category] = valueStr === '' ? null : parseFloat(valueStr);
    saveBudgetLimits(budgetLimits);
    render();
  }

  /* ================================================================
     APP INIT
  ================================================================ */

  /**
   * Entry point. Called on DOMContentLoaded.
   * 1. Load persisted state
   * 2. Apply theme
   * 3. Populate budget limit inputs
   * 4. Initial render
   * 5. Attach all event listeners
   */
  function init() {
    // 1. Load state from localStorage
    transactions = loadTransactions();
    currentTheme = loadTheme();
    budgetLimits = loadBudgetLimits();

    // 2. Apply saved theme
    applyTheme(currentTheme);

    // 3. Populate budget limit inputs with saved values
    CATEGORIES.forEach((cat) => {
      const input = document.getElementById(`limit-${cat}`);
      if (input && budgetLimits[cat] !== null) {
        input.value = budgetLimits[cat];
      }
    });

    // 4. Set sort control to default
    const sortControl = document.getElementById('sort-control');
    if (sortControl) sortControl.value = currentSort;

    // 5. Initial render
    render();

    // 6. Attach event listeners
    const form = document.getElementById('transaction-form');
    if (form) form.addEventListener('submit', handleFormSubmit);

    const listEl = document.getElementById('transaction-list');
    if (listEl) listEl.addEventListener('click', handleListClick);

    if (sortControl) sortControl.addEventListener('change', handleSortChange);

    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) themeToggle.addEventListener('click', handleThemeToggle);

    // Budget limit inputs — use 'change' so validation fires on blur/enter,
    // and 'input' for live feedback
    CATEGORIES.forEach((cat) => {
      const input = document.getElementById(`limit-${cat}`);
      if (input) {
        input.addEventListener('change', handleBudgetLimitInput);
        input.addEventListener('input',  handleBudgetLimitInput);
      }
    });
  }

  /* ================================================================
     BOOTSTRAP
  ================================================================ */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    // DOM already ready (script loaded with defer or at bottom of body)
    init();
  }

})(); // end IIFE
