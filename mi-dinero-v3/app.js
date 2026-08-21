/* ===========================================================
   Mi Dinero — lógica de la app
   App personal de finanzas: 100% local, sin servidor, sin cuentas.
   =========================================================== */
(function () {
  'use strict';

  var STORAGE_KEY = 'midinero.v1';
  var APP_VERSION = '1.0.0';

  var SERIES = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#4fae4f', '#9085e9'];
  var SERIES_OTHER = '#64796f';
  var COLOR_INCOME = '#22c08a';
  var COLOR_EXPENSE = '#e66767';

  var AMOUNT_LABEL = { expense: '¿Cuánto gastaste?', income: '¿Cuánto recibiste?', transfer: '¿Cuánto quieres transferir?' };
  var SAVE_LABEL = { expense: 'Guardar gasto', income: 'Guardar ingreso', transfer: 'Guardar transferencia' };
  var NEW_LABEL = { expense: 'Nuevo gasto', income: 'Nuevo ingreso', transfer: 'Nueva transferencia' };
  var EDIT_LABEL = { expense: 'Editar gasto', income: 'Editar ingreso', transfer: 'Editar transferencia' };

  var WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  var MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  var MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

  // ---------- tiny DOM helpers ----------

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function el(html) {
    var t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }

  function escapeHTML(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  function uid(prefix) {
    return (prefix || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  // ---------- default data ----------

  function defaultCategories() {
    return {
      expense: [
        { id: 'comida', name: 'Comida', icon: '🍔', color: SERIES[0] },
        { id: 'transporte', name: 'Transporte', icon: '🚌', color: SERIES[1] },
        { id: 'hogar', name: 'Hogar / Renta', icon: '🏠', color: SERIES[2] },
        { id: 'entretenimiento', name: 'Entretenimiento', icon: '🎬', color: SERIES[3] },
        { id: 'salud', name: 'Salud', icon: '🏥', color: SERIES[4] },
        { id: 'servicios', name: 'Servicios', icon: '💡', color: SERIES[5] },
        { id: 'compras', name: 'Compras', icon: '🛍️', color: SERIES[6] },
        { id: 'deuda', name: 'Pago de deuda', icon: '💳', color: COLOR_EXPENSE },
        { id: 'otros_g', name: 'Otros', icon: '✨', color: SERIES_OTHER }
      ],
      income: [
        { id: 'salario', name: 'Salario', icon: '💼', color: SERIES[0] },
        { id: 'freelance', name: 'Freelance', icon: '💻', color: SERIES[1] },
        { id: 'inversion', name: 'Inversión', icon: '📈', color: SERIES[2] },
        { id: 'regalo', name: 'Regalo', icon: '🎁', color: SERIES[3] },
        { id: 'otros_i', name: 'Otros', icon: '✨', color: SERIES_OTHER }
      ]
    };
  }

  function defaultAccounts() {
    return [
      { id: 'efectivo', name: 'Efectivo', icon: '💵', startBalance: 0 },
      { id: 'debito', name: 'Débito', icon: '💳', startBalance: 0 },
      { id: 'ahorros', name: 'Ahorros', icon: '🏦', startBalance: 0 }
    ];
  }

  function defaultState() {
    return {
      profile: { name: 'Jaime', currency: 'MXN' },
      accounts: defaultAccounts(),
      categories: defaultCategories(),
      transactions: [],
      goals: [],
      debts: [],
      recurring: [],
      settings: { hideAmounts: false }
    };
  }

  // ---------- persistence ----------

  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      var parsed = JSON.parse(raw);
      var base = defaultState();
      var categories = parsed.categories && parsed.categories.expense && parsed.categories.income ? parsed.categories : base.categories;
      if (!categories.expense.some(function (c) { return c.id === 'deuda'; })) {
        var otrosIdx = categories.expense.findIndex(function (c) { return c.id === 'otros_g'; });
        var deudaCategory = { id: 'deuda', name: 'Pago de deuda', icon: '💳', color: COLOR_EXPENSE };
        if (otrosIdx === -1) categories.expense.push(deudaCategory);
        else categories.expense.splice(otrosIdx, 0, deudaCategory);
      }
      return {
        profile: Object.assign({}, base.profile, parsed.profile),
        accounts: Array.isArray(parsed.accounts) && parsed.accounts.length ? parsed.accounts : base.accounts,
        categories: categories,
        transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
        goals: Array.isArray(parsed.goals) ? parsed.goals : [],
        debts: Array.isArray(parsed.debts) ? parsed.debts : [],
        recurring: Array.isArray(parsed.recurring) ? parsed.recurring : [],
        settings: Object.assign({}, base.settings, parsed.settings)
      };
    } catch (err) {
      console.error('No se pudo leer el almacenamiento local, se usan valores por defecto.', err);
      return defaultState();
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (err) {
      console.error('No se pudo guardar en el almacenamiento local.', err);
      toast('No se pudo guardar. Revisa el espacio disponible en tu teléfono.');
    }
  }

  var state = loadState();

  // ---------- formatting ----------

  function formatMoney(amount) {
    var n = Number(amount) || 0;
    try {
      return new Intl.NumberFormat('es-MX', { style: 'currency', currency: state.profile.currency || 'MXN' }).format(n);
    } catch (err) {
      return '$' + n.toFixed(2);
    }
  }

  function initialsFrom(name) {
    var parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '🙂';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  function pad2(n) { return String(n).padStart(2, '0'); }

  function toLocalISO(date) {
    return date.getFullYear() + '-' + pad2(date.getMonth() + 1) + '-' + pad2(date.getDate());
  }

  function parseLocalISO(iso) {
    var parts = String(iso).split('-').map(Number);
    return new Date(parts[0], (parts[1] || 1) - 1, parts[2] || 1);
  }

  function todayISO() { return toLocalISO(new Date()); }

  function formatLongDate(date) {
    return capitalize(WEEKDAYS[date.getDay()]) + ', ' + date.getDate() + ' de ' + MONTHS[date.getMonth()];
  }

  function formatShortDate(date) {
    return date.getDate() + ' ' + MONTHS_SHORT[date.getMonth()] + ' ' + date.getFullYear();
  }

  function formatDayHeading(iso) {
    var d = parseLocalISO(iso);
    var t = parseLocalISO(todayISO());
    var diffDays = Math.round((t - d) / 86400000);
    if (diffDays === 0) return 'Hoy';
    if (diffDays === 1) return 'Ayer';
    return capitalize(WEEKDAYS[d.getDay()]) + ' ' + d.getDate() + ' de ' + MONTHS[d.getMonth()];
  }

  function monthLabel(year, month) { return capitalize(MONTHS[month]) + ' ' + year; }

  function parseAmountInput(v) {
    var n = parseFloat(String(v).replace(/,/g, '.').replace(/[^0-9.]/g, ''));
    return isFinite(n) ? n : NaN;
  }

  // ---------- domain calculations ----------

  function accountBalance(accountId) {
    var acc = state.accounts.find(function (a) { return a.id === accountId; });
    var bal = acc ? Number(acc.startBalance) || 0 : 0;
    state.transactions.forEach(function (tx) {
      if (tx.type === 'income' && tx.accountId === accountId) bal += tx.amount;
      else if (tx.type === 'expense' && tx.accountId === accountId) bal -= tx.amount;
      else if (tx.type === 'transfer') {
        if (tx.accountId === accountId) bal -= tx.amount;
        if (tx.toAccountId === accountId) bal += tx.amount;
      }
    });
    return bal;
  }

  function totalBalance() {
    return state.accounts.reduce(function (sum, a) { return sum + accountBalance(a.id); }, 0);
  }

  function txInRange(tx, start, end) {
    var d = parseLocalISO(tx.date);
    return d >= start && d <= end;
  }

  function monthRange(year, month) {
    return { start: new Date(year, month, 1), end: new Date(year, month + 1, 0, 23, 59, 59, 999) };
  }

  function monthTotals(year, month) {
    var range = monthRange(year, month);
    var income = 0, expense = 0;
    state.transactions.forEach(function (tx) {
      if (!txInRange(tx, range.start, range.end)) return;
      if (tx.type === 'income') income += tx.amount;
      else if (tx.type === 'expense') expense += tx.amount;
    });
    return { income: income, expense: expense, net: income - expense };
  }

  function categoryTotalsForRange(type, start, end) {
    var map = {};
    state.transactions.forEach(function (tx) {
      if (tx.type !== type) return;
      if (!txInRange(tx, start, end)) return;
      map[tx.categoryId] = (map[tx.categoryId] || 0) + tx.amount;
    });
    var cats = state.categories[type] || [];
    var entries = Object.keys(map).map(function (catId) {
      var cat = cats.find(function (c) { return c.id === catId; }) || { id: catId, name: 'Otros', icon: '✨', color: SERIES_OTHER };
      return { id: cat.id, name: cat.name, icon: cat.icon, color: cat.color, amount: map[catId] };
    });
    entries.sort(function (a, b) { return b.amount - a.amount; });
    return entries;
  }

  function foldOthers(entries, cap) {
    if (entries.length <= cap) return entries;
    var top = entries.slice(0, cap - 1);
    var restSum = entries.slice(cap - 1).reduce(function (s, e) { return s + e.amount; }, 0);
    top.push({ id: 'otros_fold', name: 'Otros', icon: '✨', color: SERIES_OTHER, amount: restSum });
    return top;
  }

  function categoryById(type, id) {
    return (state.categories[type] || []).find(function (c) { return c.id === id; });
  }

  function accountById(id) {
    return state.accounts.find(function (a) { return a.id === id; });
  }

  function byDateDesc(a, b) {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return (b.createdAt || 0) - (a.createdAt || 0);
  }

  function nextColor(existingCount) { return SERIES[existingCount % SERIES.length]; }

  // ---------- metas / deudas / recurrentes: fechas y cálculos ----------

  function clampDay(day, year, month) {
    var lastDay = new Date(year, month + 1, 0).getDate();
    return Math.max(1, Math.min(day, lastDay));
  }

  function addMonths(date, n) {
    var total = date.getFullYear() * 12 + date.getMonth() + n;
    var y = Math.floor(total / 12);
    var m = ((total % 12) + 12) % 12;
    var d = clampDay(date.getDate(), y, m);
    return new Date(y, m, d);
  }

  function monthKeyOf(date) { return date.getFullYear() + '-' + pad2(date.getMonth() + 1); }
  function monthKeyOfISO(iso) { return monthKeyOf(parseLocalISO(iso)); }
  function currentMonthKey() { return monthKeyOf(new Date()); }

  function daysBetween(a, b) { return Math.round((b - a) / 86400000); }

  function relativeDateLabel(date) {
    var diff = daysBetween(parseLocalISO(todayISO()), date);
    if (diff === 0) return 'Hoy';
    if (diff === 1) return 'Mañana';
    if (diff === -1) return 'Ayer';
    if (diff > 1) return 'En ' + diff + ' días';
    return 'Hace ' + Math.abs(diff) + ' días';
  }

  // próxima ocurrencia de un día del mes (1-31): este mes si aún no pasa, si no el siguiente
  function nextOccurrence(day) {
    var now = new Date();
    var y = now.getFullYear(), m = now.getMonth();
    var thisMonth = new Date(y, m, clampDay(day, y, m));
    if (toLocalISO(thisMonth) >= todayISO()) return thisMonth;
    var ny = m === 11 ? y + 1 : y;
    var nm = (m + 1) % 12;
    return new Date(ny, nm, clampDay(day, ny, nm));
  }

  // ---------- metas ----------

  function goalProgress(goal) {
    var saved = (goal.contributions || []).reduce(function (s, c) { return s + c.amount; }, 0);
    var target = Number(goal.targetAmount) || 0;
    var remaining = Math.max(0, target - saved);
    var pct = target > 0 ? Math.min(100, Math.round((saved / target) * 100)) : 0;
    return { saved: saved, target: target, remaining: remaining, pct: pct, done: target > 0 && saved >= target };
  }

  function goalById(id) { return state.goals.find(function (g) { return g.id === id; }); }

  // ---------- deudas ----------

  function debtPayments(debtId) {
    return state.transactions.filter(function (t) { return t.debtId === debtId; }).sort(byDateDesc);
  }

  function debtStats(debt) {
    var paid = debtPayments(debt.id).reduce(function (s, t) { return s + t.amount; }, 0);
    var starting = Number(debt.startingBalance) || 0;
    var balance = Math.max(0, starting - paid);
    var nextPaymentDate = nextOccurrence(debt.paymentDay);
    var paymentAmount = Number(debt.paymentAmount) || 0;
    var remainingPayments = balance > 0 && paymentAmount > 0 ? Math.ceil(balance / paymentAmount) : 0;
    var payoffDate = balance > 0 && remainingPayments > 0 ? addMonths(nextPaymentDate, remainingPayments - 1) : null;
    var pct = starting > 0 ? Math.min(100, Math.round((paid / starting) * 100)) : 0;
    return { paid: paid, starting: starting, balance: balance, nextPaymentDate: nextPaymentDate, remainingPayments: remainingPayments, payoffDate: payoffDate, pct: pct, done: starting > 0 && balance <= 0 };
  }

  function debtById(id) { return state.debts.find(function (d) { return d.id === id; }); }

  // ---------- gastos recurrentes ----------

  function recurringPayments(recurringId) {
    return state.transactions.filter(function (t) { return t.recurringId === recurringId; }).sort(byDateDesc);
  }

  function recurringStatus(item) {
    var paidThisMonth = state.transactions.some(function (t) { return t.recurringId === item.id && monthKeyOfISO(t.date) === currentMonthKey(); });
    var now = new Date();
    var dueThisMonth = new Date(now.getFullYear(), now.getMonth(), clampDay(item.day, now.getFullYear(), now.getMonth()));
    if (paidThisMonth) {
      var ny = now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear();
      var nm = (now.getMonth() + 1) % 12;
      var dueDate = new Date(ny, nm, clampDay(item.day, ny, nm));
      return { status: 'pagado', dueDate: dueDate };
    }
    if (toLocalISO(dueThisMonth) < todayISO()) return { status: 'vencido', dueDate: dueThisMonth };
    return { status: 'pendiente', dueDate: dueThisMonth };
  }

  function recurringById(id) { return state.recurring.find(function (r) { return r.id === id; }); }

  // combina deudas y recurrentes pendientes/vencidos, ordenados por fecha, para "Próximos pagos"
  function upcomingPayments(limit) {
    var items = [];
    state.debts.forEach(function (d) {
      var st = debtStats(d);
      if (st.done) return;
      items.push({ kind: 'debt', id: d.id, name: d.name, icon: d.icon || '💳', amount: Number(d.paymentAmount) || 0, date: st.nextPaymentDate, overdue: false });
    });
    state.recurring.forEach(function (r) {
      if (r.active === false) return;
      var st = recurringStatus(r);
      if (st.status === 'pagado') return;
      items.push({ kind: 'recurring', id: r.id, name: r.name, icon: r.icon || '📌', amount: Number(r.amount) || 0, date: st.dueDate, overdue: st.status === 'vencido' });
    });
    items.sort(function (a, b) { return a.date - b.date; });
    return typeof limit === 'number' ? items.slice(0, limit) : items;
  }

  // ---------- toast ----------

  var toastTimer = null;
  function toast(msg) {
    var t = $('#toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('visible'); }, 2400);
  }

  // ---------- navigation / topbar ----------

  var currentView = 'home';

  function switchView(view) {
    currentView = view;
    $$('.nav-item').forEach(function (btn) { btn.classList.toggle('active', btn.dataset.view === view); });
    render();
    var content = $('#app-content');
    if (content) content.scrollTop = 0;
    window.scrollTo(0, 0);
  }

  function updateTopbar() {
    var todayLabel = $('#today-label');
    if (todayLabel) todayLabel.textContent = formatLongDate(new Date());
    var titles = {
      home: 'Hola, ' + (state.profile.name || 'Jaime').split(' ')[0],
      activity: 'Movimientos',
      analysis: 'Análisis',
      more: 'Más',
      goals: 'Metas',
      debts: 'Deudas',
      recurring: 'Gastos recurrentes'
    };
    var pageTitle = $('#page-title');
    if (pageTitle) pageTitle.textContent = titles[currentView] || 'Mi Dinero';
    var avatar = $('#avatar-button');
    if (avatar) avatar.textContent = initialsFrom(state.profile.name);
  }

  function render() {
    updateTopbar();
    var container = $('#app-content');
    if (!container) return;
    container.innerHTML = '';
    var view = el('<div class="view"></div>');
    if (currentView === 'activity') view.appendChild(renderActivity());
    else if (currentView === 'analysis') view.appendChild(renderAnalysis());
    else if (currentView === 'more') view.appendChild(renderMore());
    else if (currentView === 'goals') view.appendChild(renderGoals());
    else if (currentView === 'debts') view.appendChild(renderDebts());
    else if (currentView === 'recurring') view.appendChild(renderRecurring());
    else view.appendChild(renderHome());
    container.appendChild(view);
  }

  // ---------- transaction rows ----------

  function renderTxRow(tx) {
    var isExpense = tx.type === 'expense', isTransfer = tx.type === 'transfer';
    var icon, title, sub, amountText, amountClass;
    if (isTransfer) {
      var from = accountById(tx.accountId), to = accountById(tx.toAccountId);
      icon = '↔️';
      title = 'Transferencia';
      sub = (from ? from.name : '—') + ' → ' + (to ? to.name : '—');
      amountText = formatMoney(tx.amount);
      amountClass = 'transfer';
    } else {
      var cat = categoryById(tx.type, tx.categoryId) || { name: 'Otros', icon: '✨' };
      icon = cat.icon;
      title = cat.name;
      var acc = accountById(tx.accountId);
      sub = (acc ? acc.name : '—') + (tx.note ? ' · ' + tx.note : '');
      amountText = (isExpense ? '-' : '+') + formatMoney(tx.amount);
      amountClass = isExpense ? 'expense' : 'income';
    }
    var row = el(
      '<button type="button" class="tx-row">' +
        '<span class="tx-icon ' + tx.type + '">' + icon + '</span>' +
        '<span class="tx-info"><span class="tx-title">' + escapeHTML(title) + '</span>' +
        '<span class="tx-sub">' + escapeHTML(sub) + '</span></span>' +
        '<span class="tx-amount ' + amountClass + '">' + amountText + '</span>' +
      '</button>'
    );
    row.addEventListener('click', function () { openSheetFor(tx); });
    return row;
  }

  // ---------- HOME ----------

  function renderHome() {
    var root = el('<div></div>');
    var total = totalBalance();
    var now = new Date();
    var totals = monthTotals(now.getFullYear(), now.getMonth());
    var prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    var prevTotals = monthTotals(prev.getFullYear(), prev.getMonth());
    var net = totals.net, prevNet = prevTotals.net;
    var deltaClass = 'flat', deltaText = 'Sin cambios vs. mes pasado';
    if (net > prevNet) { deltaClass = 'up'; deltaText = '▲ ' + formatMoney(net - prevNet) + ' vs. mes pasado'; }
    else if (net < prevNet) { deltaClass = 'down'; deltaText = '▼ ' + formatMoney(prevNet - net) + ' vs. mes pasado'; }
    var upcoming = upcomingPayments(5);

    root.innerHTML =
      '<div class="balance-card">' +
        '<div class="card-head"><p class="label">Saldo total</p>' +
        '<button class="eye-toggle" type="button" id="eye-toggle" aria-label="Ocultar saldo">' + (state.settings.hideAmounts ? '🙈' : '👁') + '</button></div>' +
        '<p class="hero-figure' + (state.settings.hideAmounts ? ' hide-amounts' : '') + '" id="hero-figure">' + formatMoney(total) + '</p>' +
        '<span class="balance-delta ' + deltaClass + '">' + deltaText + '</span>' +
      '</div>' +
      '<div class="stat-row">' +
        '<div class="stat-tile"><p class="stat-label"><span class="stat-dot" style="background:' + COLOR_INCOME + '"></span>Ingresos · ' + capitalize(MONTHS[now.getMonth()]) + '</p><p class="stat-value">' + formatMoney(totals.income) + '</p></div>' +
        '<div class="stat-tile"><p class="stat-label"><span class="stat-dot" style="background:' + COLOR_EXPENSE + '"></span>Gastos · ' + capitalize(MONTHS[now.getMonth()]) + '</p><p class="stat-value">' + formatMoney(totals.expense) + '</p></div>' +
      '</div>' +
      '<p class="section-title">Cuentas</p>' +
      '<div class="accounts-scroll" id="accounts-scroll"></div>' +
      (state.goals.length ? '<p class="section-title">Metas <button type="button" class="link-button" id="see-goals">Ver todas</button></p><div class="accounts-scroll" id="goals-scroll"></div>' : '') +
      (upcoming.length ? '<p class="section-title">Próximos pagos</p><div class="list-block" id="upcoming-list"></div>' : '') +
      '<p class="section-title">Movimientos recientes <button type="button" class="link-button" id="see-all">Ver todos</button></p>' +
      '<div class="tx-list" id="recent-list"></div>';

    var accWrap = $('#accounts-scroll', root);
    state.accounts.forEach(function (acc) {
      var chip = el('<button type="button" class="account-chip"><p class="acc-name">' + acc.icon + ' ' + escapeHTML(acc.name) + '</p><p class="acc-balance">' + formatMoney(accountBalance(acc.id)) + '</p></button>');
      chip.addEventListener('click', function () { openAccountEditor(acc); });
      accWrap.appendChild(chip);
    });
    var addChip = el('<button type="button" class="account-chip add-account">+ Cuenta</button>');
    addChip.addEventListener('click', function () { openAccountEditor(null); });
    accWrap.appendChild(addChip);

    if (state.goals.length) {
      var goalsWrap = $('#goals-scroll', root);
      state.goals.forEach(function (g) {
        var p = goalProgress(g);
        var chip = el(
          '<button type="button" class="account-chip goal-chip"><p class="acc-name">' + g.icon + ' ' + escapeHTML(g.name) + '</p>' +
          '<p class="acc-balance">' + p.pct + '%</p>' +
          '<div class="bar-track" style="margin-top:6px;"><div class="bar-fill" style="width:' + Math.max(3, p.pct) + '%;background:' + (p.done ? COLOR_INCOME : 'var(--accent)') + '"></div></div></button>'
        );
        chip.addEventListener('click', function () { openGoalDetail(g.id); });
        goalsWrap.appendChild(chip);
      });
      $('#see-goals', root).addEventListener('click', function () { switchView('goals'); });
    }

    if (upcoming.length) {
      var upcomingWrap = $('#upcoming-list', root);
      upcoming.forEach(function (u) {
        var badgeClass = u.overdue ? 'badge-danger' : 'badge-neutral';
        var row = el(
          '<button type="button" class="list-row"><span class="row-icon">' + u.icon + '</span>' +
          '<span class="row-text"><span class="row-title">' + escapeHTML(u.name) + '</span><span class="row-sub">' + formatMoney(u.amount) + '</span></span>' +
          '<span class="badge ' + badgeClass + '">' + (u.overdue ? 'Vencido' : relativeDateLabel(u.date)) + '</span></button>'
        );
        row.addEventListener('click', function () { switchView(u.kind === 'debt' ? 'debts' : 'recurring'); });
        upcomingWrap.appendChild(row);
      });
    }

    var recentList = $('#recent-list', root);
    var recent = state.transactions.slice().sort(byDateDesc).slice(0, 5);
    if (!recent.length) {
      recentList.appendChild(el('<div class="empty-state"><span class="emoji">🌱</span><p>Aún no registras movimientos.<br>Toca "Registrar" para anotar tu primer gasto o ingreso.</p></div>'));
    } else {
      recent.forEach(function (tx) { recentList.appendChild(renderTxRow(tx)); });
    }

    $('#eye-toggle', root).addEventListener('click', function () {
      state.settings.hideAmounts = !state.settings.hideAmounts;
      saveState();
      render();
    });
    $('#see-all', root).addEventListener('click', function () { switchView('activity'); });

    return root;
  }

  // ---------- ACTIVITY ----------

  var activityFilter = 'all';
  var activitySearch = '';

  function filteredSortedTransactions() {
    var q = activitySearch.trim().toLowerCase();
    return state.transactions.filter(function (tx) {
      if (activityFilter !== 'all' && tx.type !== activityFilter) return false;
      if (!q) return true;
      var cat = tx.type !== 'transfer' ? categoryById(tx.type, tx.categoryId) : null;
      var acc = accountById(tx.accountId);
      var toAcc = accountById(tx.toAccountId);
      var hay = [tx.note, cat && cat.name, acc && acc.name, toAcc && toAcc.name].filter(Boolean).join(' ').toLowerCase();
      return hay.indexOf(q) !== -1;
    }).sort(byDateDesc);
  }

  function renderActivity() {
    var root = el('<div></div>');
    root.innerHTML =
      '<div class="search-field"><span>🔎</span><input type="search" id="search-input" placeholder="Buscar por nota, categoría o cuenta"/></div>' +
      '<div class="filter-row" id="filter-row">' +
        '<button type="button" class="chip" data-f="all">Todos</button>' +
        '<button type="button" class="chip" data-f="expense">Gastos</button>' +
        '<button type="button" class="chip" data-f="income">Ingresos</button>' +
        '<button type="button" class="chip" data-f="transfer">Transferencias</button>' +
      '</div>' +
      '<div id="activity-list"></div>';

    var searchInput = $('#search-input', root);
    searchInput.value = activitySearch;
    var listEl = $('#activity-list', root);

    function updateList() {
      listEl.innerHTML = '';
      var items = filteredSortedTransactions();
      if (!items.length) {
        var msg = state.transactions.length ? 'No hay movimientos que coincidan con tu búsqueda.' : 'Aún no registras movimientos.';
        listEl.appendChild(el('<div class="empty-state"><span class="emoji">🧾</span><p>' + msg + '</p></div>'));
        return;
      }
      var lastDay = null;
      items.forEach(function (tx) {
        if (tx.date !== lastDay) {
          lastDay = tx.date;
          listEl.appendChild(el('<p class="day-heading">' + formatDayHeading(tx.date) + '</p>'));
        }
        listEl.appendChild(renderTxRow(tx));
      });
    }

    $$('.chip', root).forEach(function (chip) {
      chip.classList.toggle('selected', chip.dataset.f === activityFilter);
      chip.addEventListener('click', function () {
        activityFilter = chip.dataset.f;
        $$('.chip', root).forEach(function (c) { c.classList.toggle('selected', c === chip); });
        updateList();
      });
    });

    searchInput.addEventListener('input', function (e) {
      activitySearch = e.target.value;
      updateList();
    });

    updateList();
    return root;
  }

  // ---------- ANALYSIS ----------

  var analysisPeriod = 'this';

  function last6Months() {
    var arr = [];
    var now = new Date();
    for (var i = 5; i >= 0; i--) arr.push(new Date(now.getFullYear(), now.getMonth() - i, 1));
    return arr;
  }

  function renderTrendChart(container) {
    var months = last6Months();
    var data = months.map(function (d) {
      var t = monthTotals(d.getFullYear(), d.getMonth());
      return { date: d, income: t.income, expense: t.expense };
    });
    var max = Math.max(1, Math.max.apply(null, data.map(function (d) { return Math.max(d.income, d.expense); })));
    var W = 320, H = 168, padL = 8, padR = 8, padTop = 14, padBottom = 28;
    var groupW = (W - padL - padR) / data.length;
    var barW = Math.min(16, groupW / 2 - 6);
    var maxBarH = H - padTop - padBottom;
    var baseline = H - padBottom;

    var bars = '';
    data.forEach(function (d, i) {
      var gx = padL + i * groupW + groupW / 2;
      var incH = d.income > 0 ? Math.max(2, (d.income / max) * maxBarH) : 0;
      var expH = d.expense > 0 ? Math.max(2, (d.expense / max) * maxBarH) : 0;
      var incX = gx - barW - 2;
      var expX = gx + 2;
      var label = escapeHTML(monthLabel(d.date.getFullYear(), d.date.getMonth()));
      bars += '<rect class="bar-touch" data-label="' + label + '" data-income="' + d.income + '" data-expense="' + d.expense + '" x="' + (gx - groupW / 2 + 2) + '" y="' + padTop + '" width="' + (groupW - 4) + '" height="' + maxBarH + '"></rect>';
      if (incH > 0) bars += '<rect x="' + incX + '" y="' + (baseline - incH) + '" width="' + barW + '" height="' + incH + '" rx="3" fill="' + COLOR_INCOME + '"></rect>';
      if (expH > 0) bars += '<rect x="' + expX + '" y="' + (baseline - expH) + '" width="' + barW + '" height="' + expH + '" rx="3" fill="' + COLOR_EXPENSE + '"></rect>';
      bars += '<text x="' + gx + '" y="' + (H - 8) + '" text-anchor="middle" font-size="9" fill="#82988f">' + MONTHS_SHORT[d.date.getMonth()] + '</text>';
    });

    var svg = '<svg class="trend-chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Ingresos y gastos de los últimos 6 meses">' +
      '<line x1="' + padL + '" y1="' + baseline + '" x2="' + (W - padR) + '" y2="' + baseline + '" stroke="rgba(255,255,255,0.16)" stroke-width="1"></line>' +
      bars + '</svg>';
    container.innerHTML = svg;

    var tooltip = el('<div class="chart-tooltip" id="chart-tooltip"></div>');
    container.appendChild(tooltip);

    $$('.bar-touch', container).forEach(function (rect) {
      rect.addEventListener('click', function (e) {
        var wrapBox = container.getBoundingClientRect();
        var targetBox = e.target.getBoundingClientRect();
        tooltip.style.left = (targetBox.left - wrapBox.left + targetBox.width / 2) + 'px';
        tooltip.style.top = (targetBox.top - wrapBox.top) + 'px';
        var d = e.target.dataset;
        tooltip.innerHTML = d.label + '<br>Ingresos: ' + formatMoney(d.income) + '<br>Gastos: ' + formatMoney(d.expense);
        tooltip.classList.add('visible');
        clearTimeout(tooltip._t);
        tooltip._t = setTimeout(function () { tooltip.classList.remove('visible'); }, 2600);
      });
    });
  }

  function renderAnalysis() {
    var root = el('<div></div>');
    var now = new Date();
    var targetDate = analysisPeriod === 'this' ? now : new Date(now.getFullYear(), now.getMonth() - 1, 1);
    var range = monthRange(targetDate.getFullYear(), targetDate.getMonth());
    var totals = monthTotals(targetDate.getFullYear(), targetDate.getMonth());
    var expenseCats = foldOthers(categoryTotalsForRange('expense', range.start, range.end), 6);

    root.innerHTML =
      '<div class="period-switch" id="period-switch">' +
        '<button type="button" data-p="this" class="' + (analysisPeriod === 'this' ? 'selected' : '') + '">Este mes</button>' +
        '<button type="button" data-p="last" class="' + (analysisPeriod === 'last' ? 'selected' : '') + '">Mes pasado</button>' +
      '</div>' +
      '<div class="stat-row">' +
        '<div class="stat-tile"><p class="stat-label"><span class="stat-dot" style="background:' + COLOR_INCOME + '"></span>Ingresos</p><p class="stat-value">' + formatMoney(totals.income) + '</p></div>' +
        '<div class="stat-tile"><p class="stat-label"><span class="stat-dot" style="background:' + COLOR_EXPENSE + '"></span>Gastos</p><p class="stat-value">' + formatMoney(totals.expense) + '</p></div>' +
      '</div>' +
      '<p class="section-title">Balance neto</p>' +
      '<div class="card"><p class="hero-figure" style="font-size:26px;color:' + (totals.net >= 0 ? COLOR_INCOME : COLOR_EXPENSE) + '">' + (totals.net >= 0 ? '+' : '') + formatMoney(totals.net) + '</p></div>' +
      '<p class="section-title">Gastos por categoría</p>' +
      '<div id="category-bars"></div>' +
      '<p class="section-title">Ingresos vs. gastos · últimos 6 meses</p>' +
      '<div class="legend-row">' +
        '<span class="legend-item"><span class="legend-swatch" style="background:' + COLOR_INCOME + '"></span>Ingresos</span>' +
        '<span class="legend-item"><span class="legend-swatch" style="background:' + COLOR_EXPENSE + '"></span>Gastos</span>' +
      '</div>' +
      '<div class="card chart-wrap" id="trend-wrap"></div>';

    var barsWrap = $('#category-bars', root);
    if (!expenseCats.length) {
      barsWrap.appendChild(el('<div class="empty-state"><span class="emoji">📊</span><p>No hay gastos registrados en este periodo.</p></div>'));
    } else {
      var max = Math.max.apply(null, expenseCats.map(function (c) { return c.amount; }));
      var list = el('<div class="bar-list"></div>');
      expenseCats.forEach(function (c) {
        var pct = Math.max(4, Math.round((c.amount / max) * 100));
        list.appendChild(el(
          '<div><div class="bar-row-label"><span class="name">' + c.icon + ' ' + escapeHTML(c.name) + '</span>' +
          '<span class="value">' + formatMoney(c.amount) + '</span></div>' +
          '<div class="bar-track"><div class="bar-fill" style="width:' + pct + '%;background:' + c.color + '"></div></div></div>'
        ));
      });
      barsWrap.appendChild(list);
    }

    $$('#period-switch button', root).forEach(function (btn) {
      btn.addEventListener('click', function () { analysisPeriod = btn.dataset.p; render(); });
    });

    renderTrendChart($('#trend-wrap', root));

    return root;
  }

  // ---------- MORE ----------

  var deferredPrompt = null;

  function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  }

  function renderInstallSlot(container) {
    if (isStandalone()) { container.innerHTML = ''; return; }
    if (deferredPrompt) {
      container.innerHTML =
        '<div class="install-banner"><span class="row-icon">📲</span>' +
        '<div class="row-text"><p class="row-title">Instala Mi Dinero</p><p class="row-sub">Úsala como app, incluso sin internet</p></div>' +
        '<button type="button" class="install-cta" id="install-cta">Instalar</button></div>';
      $('#install-cta', container).addEventListener('click', function () {
        deferredPrompt.prompt();
        Promise.resolve(deferredPrompt.userChoice).catch(function () {}).then(function () {
          deferredPrompt = null;
          render();
        });
      });
    } else {
      container.innerHTML =
        '<div class="install-banner"><span class="row-icon">📲</span>' +
        '<div class="row-text"><p class="row-title">Instálala en tu teléfono</p>' +
        '<p class="row-sub">Menú ⋮ de Chrome → "Instalar app" o "Añadir a pantalla de inicio"</p></div></div>';
    }
  }

  function renderMore() {
    var root = el('<div></div>');
    root.innerHTML =
      '<button type="button" class="list-block profile-card" id="profile-row" style="margin-top:4px;width:100%;">' +
        '<span class="row-icon">' + escapeHTML(initialsFrom(state.profile.name)) + '</span>' +
        '<span class="row-text"><span class="row-title">' + escapeHTML(state.profile.name || 'Tu nombre') + '</span><span class="row-sub">Toca para editar tu perfil</span></span>' +
        '<span class="chevron">›</span>' +
      '</button>' +
      '<div id="install-slot"></div>' +
      '<p class="section-title">Planeación</p>' +
      '<div class="list-block">' +
        '<button type="button" class="list-row" id="goals-row"><span class="row-icon">🎯</span><span class="row-text"><span class="row-title">Metas</span><span class="row-sub">' + state.goals.length + ' meta' + (state.goals.length === 1 ? '' : 's') + '</span></span><span class="chevron">›</span></button>' +
        '<button type="button" class="list-row" id="debts-row"><span class="row-icon">💳</span><span class="row-text"><span class="row-title">Deudas</span><span class="row-sub">' + state.debts.length + ' deuda' + (state.debts.length === 1 ? '' : 's') + '</span></span><span class="chevron">›</span></button>' +
        '<button type="button" class="list-row" id="recurring-row"><span class="row-icon">📌</span><span class="row-text"><span class="row-title">Gastos recurrentes</span><span class="row-sub">' + state.recurring.length + ' registrado' + (state.recurring.length === 1 ? '' : 's') + '</span></span><span class="chevron">›</span></button>' +
      '</div>' +
      '<p class="section-title">Cuentas</p>' +
      '<div class="list-block" id="accounts-block"></div>' +
      '<p class="section-title">Categorías</p>' +
      '<div class="list-block">' +
        '<button type="button" class="list-row" id="cat-expense-row"><span class="row-icon">🧾</span><span class="row-text"><span class="row-title">Categorías de gasto</span><span class="row-sub">' + state.categories.expense.length + ' categorías</span></span><span class="chevron">›</span></button>' +
        '<button type="button" class="list-row" id="cat-income-row"><span class="row-icon">🧾</span><span class="row-text"><span class="row-title">Categorías de ingreso</span><span class="row-sub">' + state.categories.income.length + ' categorías</span></span><span class="chevron">›</span></button>' +
      '</div>' +
      '<p class="section-title">Datos y respaldo</p>' +
      '<div class="list-block">' +
        '<button type="button" class="list-row" id="export-row"><span class="row-icon">⬇️</span><span class="row-text"><span class="row-title">Exportar copia de seguridad</span><span class="row-sub">Descarga un archivo .json</span></span><span class="chevron">›</span></button>' +
        '<button type="button" class="list-row" id="import-row"><span class="row-icon">⬆️</span><span class="row-text"><span class="row-title">Importar copia de seguridad</span><span class="row-sub">Restaura desde un archivo .json</span></span><span class="chevron">›</span></button>' +
        '<input type="file" accept="application/json" id="import-input" class="hidden"/>' +
        '<button type="button" class="list-row danger" id="wipe-row"><span class="row-icon">🗑</span><span class="row-text"><span class="row-title">Borrar todos los datos</span><span class="row-sub">' + state.transactions.length + ' movimientos guardados</span></span><span class="chevron">›</span></button>' +
      '</div>' +
      '<p class="section-title">Acerca de</p>' +
      '<div class="list-block">' +
        '<div class="list-row"><span class="row-icon">🔒</span><span class="row-text"><span class="row-title">Privacidad</span><span class="row-sub">Tus datos se guardan solo en este teléfono</span></span></div>' +
        '<div class="list-row"><span class="row-icon">ℹ️</span><span class="row-text"><span class="row-title">Mi Dinero</span><span class="row-sub">Versión ' + APP_VERSION + '</span></span></div>' +
      '</div>';

    $('#profile-row', root).addEventListener('click', openProfileEditor);
    $('#goals-row', root).addEventListener('click', function () { switchView('goals'); });
    $('#debts-row', root).addEventListener('click', function () { switchView('debts'); });
    $('#recurring-row', root).addEventListener('click', function () { switchView('recurring'); });

    var accBlock = $('#accounts-block', root);
    state.accounts.forEach(function (acc) {
      var row = el(
        '<button type="button" class="list-row"><span class="row-icon">' + acc.icon + '</span>' +
        '<span class="row-text"><span class="row-title">' + escapeHTML(acc.name) + '</span><span class="row-sub">Saldo inicial ' + formatMoney(acc.startBalance) + '</span></span>' +
        '<span class="row-value">' + formatMoney(accountBalance(acc.id)) + '</span></button>'
      );
      row.addEventListener('click', function () { openAccountEditor(acc); });
      accBlock.appendChild(row);
    });
    var addAccRow = el('<button type="button" class="list-row"><span class="row-icon">➕</span><span class="row-text"><span class="row-title">Agregar cuenta</span></span></button>');
    addAccRow.addEventListener('click', function () { openAccountEditor(null); });
    accBlock.appendChild(addAccRow);

    $('#cat-expense-row', root).addEventListener('click', function () { openCategoryManager('expense'); });
    $('#cat-income-row', root).addEventListener('click', function () { openCategoryManager('income'); });
    $('#export-row', root).addEventListener('click', exportData);

    var importInput = $('#import-input', root);
    $('#import-row', root).addEventListener('click', function () { importInput.click(); });
    importInput.addEventListener('change', function (e) { if (e.target.files[0]) importData(e.target.files[0]); });

    $('#wipe-row', root).addEventListener('click', confirmWipe);

    renderInstallSlot($('#install-slot', root));

    return root;
  }

  // ---------- back button (sub-vistas de Más) ----------

  function appendBackBar(root, label) {
    var bar = el('<button type="button" class="back-button">‹ ' + escapeHTML(label || 'Más') + '</button>');
    bar.addEventListener('click', function () { switchView('more'); });
    root.appendChild(bar);
  }

  // ---------- METAS ----------

  var GOAL_ICONS = ['🎯', '🚗', '🏠', '✈️', '🎓', '💍', '📱', '💻', '🎁', '🏝️'];

  function renderGoals() {
    var root = el('<div></div>');
    appendBackBar(root, 'Más');
    root.appendChild(el('<h2 style="font-size:20px;font-weight:800;margin:6px 2px 16px;">Metas</h2>'));

    var addBtn = el('<button type="button" class="primary-button" style="margin-bottom:16px;">+ Nueva meta</button>');
    addBtn.addEventListener('click', function () { openGoalEditor(null); });
    root.appendChild(addBtn);

    if (!state.goals.length) {
      root.appendChild(el('<div class="empty-state"><span class="emoji">🎯</span><p>Aún no tienes metas. Crea una para ir llevando el control, por ejemplo "Auto" o "Vacaciones".</p></div>'));
      return root;
    }

    var list = el('<div style="display:flex;flex-direction:column;gap:12px;"></div>');
    state.goals.forEach(function (g) {
      var p = goalProgress(g);
      var card = el(
        '<button type="button" class="goal-card">' +
          '<div class="goal-card-head"><span class="goal-icon">' + g.icon + '</span>' +
          '<div class="goal-card-info"><p class="goal-name">' + escapeHTML(g.name) + '</p>' +
          '<p class="goal-sub">' + (p.done ? '¡Meta alcanzada! 🎉' : formatMoney(p.saved) + ' de ' + formatMoney(p.target)) + '</p></div>' +
          '<p class="goal-pct">' + p.pct + '%</p></div>' +
          '<div class="bar-track"><div class="bar-fill" style="width:' + Math.max(3, p.pct) + '%;background:' + (p.done ? COLOR_INCOME : 'var(--accent)') + '"></div></div>' +
          (!p.done ? '<p class="goal-remaining">Faltan ' + formatMoney(p.remaining) + (g.targetDate ? ' · meta: ' + formatShortDate(parseLocalISO(g.targetDate)) : '') + '</p>' : '') +
        '</button>'
      );
      card.addEventListener('click', function () { openGoalDetail(g.id); });
      list.appendChild(card);
    });
    root.appendChild(list);
    return root;
  }

  function openGoalEditor(goal) {
    var isNew = !goal;
    var chosenIcon = goal ? goal.icon : '🎯';
    var body = openMini(isNew ? 'Nueva meta' : 'Editar meta',
      '<div class="field-group"><span class="field-label">Ícono</span><div class="category-grid" id="goal-icon-grid">' +
        GOAL_ICONS.map(function (ic) { return '<button type="button" class="category-chip' + (chosenIcon === ic ? ' selected' : '') + '" data-icon="' + ic + '"><span class="emoji">' + ic + '</span></button>'; }).join('') +
      '</div></div>' +
      '<div class="field-group"><span class="field-label">Nombre</span><input type="text" class="text-field" id="goal-name" maxlength="30" placeholder="Ej. Auto" value="' + (goal ? escapeHTML(goal.name) : '') + '"/></div>' +
      '<div class="field-group"><span class="field-label">Monto meta</span><input type="text" inputmode="decimal" class="text-field" id="goal-target" placeholder="0" value="' + (goal ? goal.targetAmount : '') + '"/></div>' +
      '<div class="field-group"><span class="field-label">Fecha meta (opcional)</span><input type="date" class="text-field" id="goal-date" value="' + (goal && goal.targetDate ? goal.targetDate : '') + '"/></div>' +
      '<button type="button" class="primary-button" id="save-goal">' + (isNew ? 'Crear meta' : 'Guardar cambios') + '</button>' +
      (!isNew ? '<button type="button" class="secondary-button danger" id="delete-goal">Eliminar meta</button>' : '')
    );

    $$('#goal-icon-grid .category-chip', body).forEach(function (chip) {
      chip.addEventListener('click', function () {
        chosenIcon = chip.dataset.icon;
        $$('#goal-icon-grid .category-chip', body).forEach(function (c) { c.classList.toggle('selected', c === chip); });
      });
    });

    $('#save-goal', body).addEventListener('click', function () {
      var name = $('#goal-name', body).value.trim();
      var target = parseAmountInput($('#goal-target', body).value);
      if (!name) { toast('Ponle un nombre a tu meta.'); return; }
      if (!target || target <= 0) { toast('Ingresa un monto meta válido.'); return; }
      var dateVal = $('#goal-date', body).value || null;
      if (isNew) {
        state.goals.push({ id: uid('goal'), name: name, icon: chosenIcon, targetAmount: target, targetDate: dateVal, createdAt: Date.now(), contributions: [] });
      } else {
        goal.name = name; goal.icon = chosenIcon; goal.targetAmount = target; goal.targetDate = dateVal;
      }
      saveState();
      closeMiniUI();
      render();
      toast(isNew ? 'Meta creada.' : 'Meta actualizada.');
    });

    if (!isNew) {
      $('#delete-goal', body).addEventListener('click', function () {
        openMini('Eliminar meta',
          '<p class="helper-text" style="margin-top:0">Se eliminará "' + escapeHTML(goal.name) + '" y su historial de aportaciones. Esta acción no se puede deshacer.</p>' +
          '<button type="button" class="primary-button danger-fill" id="confirm-del-goal">Sí, eliminar</button>' +
          '<button type="button" class="secondary-button" id="cancel-del-goal">Cancelar</button>'
        );
        $('#confirm-del-goal').addEventListener('click', function () {
          state.goals = state.goals.filter(function (g) { return g.id !== goal.id; });
          saveState(); closeMiniUI(); render();
          toast('Meta eliminada.');
        });
        $('#cancel-del-goal').addEventListener('click', function () { openGoalEditor(goal); });
      });
    }
  }

  function openGoalDetail(goalId) {
    paintGoalDetail();

    function paintGoalDetail() {
      var goal = goalById(goalId);
      if (!goal) { closeMiniUI(); return; }
      var p = goalProgress(goal);
      var body = openMini(goal.icon + ' ' + goal.name,
        '<p class="hero-figure" style="font-size:26px;margin-bottom:4px;">' + formatMoney(p.saved) + '<span style="font-size:14px;color:var(--text-muted);font-weight:600;"> de ' + formatMoney(p.target) + '</span></p>' +
        '<div class="bar-track" style="margin-bottom:6px;"><div class="bar-fill" style="width:' + Math.max(3, p.pct) + '%;background:' + (p.done ? COLOR_INCOME : 'var(--accent)') + '"></div></div>' +
        '<p class="helper-text" style="margin-top:0;text-align:left;">' + (p.done ? '¡Ya la lograste! 🎉' : 'Faltan ' + formatMoney(p.remaining) + (goal.targetDate ? ' · meta: ' + formatShortDate(parseLocalISO(goal.targetDate)) : '')) + '</p>' +
        '<button type="button" class="primary-button" id="add-contribution">+ Agregar aportación</button>' +
        '<p class="field-label" style="margin-top:20px;">Historial</p>' +
        '<div id="goal-contrib-list" class="tx-list"></div>' +
        '<button type="button" class="secondary-button" id="edit-goal-btn">Editar meta</button>'
      );

      var list = $('#goal-contrib-list', body);
      var contribs = (goal.contributions || []).slice().sort(function (a, b) { return a.date < b.date ? 1 : (a.date > b.date ? -1 : 0); });
      if (!contribs.length) {
        list.appendChild(el('<div class="empty-state" style="padding:20px 8px;"><p>Aún no registras aportaciones.</p></div>'));
      } else {
        contribs.forEach(function (c) {
          var row = el(
            '<button type="button" class="tx-row"><span class="tx-icon income">💰</span>' +
            '<span class="tx-info"><span class="tx-title">' + formatMoney(c.amount) + '</span><span class="tx-sub">' + formatDayHeading(c.date) + (c.note ? ' · ' + escapeHTML(c.note) : '') + '</span></span>' +
            '<span class="tx-amount" style="color:var(--text-muted);">🗑</span></button>'
          );
          row.addEventListener('click', function () {
            openMini('Eliminar aportación',
              '<p class="helper-text" style="margin-top:0">Se quitará ' + formatMoney(c.amount) + ' de tu progreso. ¿Continuar?</p>' +
              '<button type="button" class="primary-button danger-fill" id="confirm-del-contrib">Sí, eliminar</button>' +
              '<button type="button" class="secondary-button" id="cancel-del-contrib">Cancelar</button>'
            );
            $('#confirm-del-contrib').addEventListener('click', function () {
              goal.contributions = goal.contributions.filter(function (x) { return x.id !== c.id; });
              saveState(); paintGoalDetail(); render();
              toast('Aportación eliminada.');
            });
            $('#cancel-del-contrib').addEventListener('click', function () { paintGoalDetail(); });
          });
          list.appendChild(row);
        });
      }

      $('#add-contribution', body).addEventListener('click', function () {
        var body2 = openMini('Agregar aportación',
          '<div class="field-group"><span class="field-label">Monto</span><input type="text" inputmode="decimal" class="text-field" id="contrib-amount" placeholder="0"/></div>' +
          '<div class="field-group"><span class="field-label">Fecha</span><input type="date" class="text-field" id="contrib-date" value="' + todayISO() + '" max="' + todayISO() + '"/></div>' +
          '<div class="field-group"><span class="field-label">Nota (opcional)</span><input type="text" class="text-field" id="contrib-note" maxlength="80" placeholder="Agregar nota"/></div>' +
          '<button type="button" class="primary-button" id="save-contrib">Guardar</button>'
        );
        $('#save-contrib', body2).addEventListener('click', function () {
          var amount = parseAmountInput($('#contrib-amount', body2).value);
          if (!amount || amount <= 0) { toast('Ingresa un monto válido.'); return; }
          goal.contributions = goal.contributions || [];
          goal.contributions.push({ id: uid('contrib'), amount: amount, date: $('#contrib-date', body2).value || todayISO(), note: $('#contrib-note', body2).value.trim().slice(0, 80) });
          saveState();
          paintGoalDetail();
          render();
          toast('Aportación registrada.');
        });
      });

      $('#edit-goal-btn', body).addEventListener('click', function () { openGoalEditor(goal); });
    }
  }

  // ---------- DEUDAS ----------

  var DEBT_ICONS = ['💳', '🏦', '🚗', '🏠', '📱', '🎓', '👤', '📄'];

  function renderDebts() {
    var root = el('<div></div>');
    appendBackBar(root, 'Más');
    root.appendChild(el('<h2 style="font-size:20px;font-weight:800;margin:6px 2px 16px;">Deudas</h2>'));

    if (state.debts.length) {
      var totalBalance = state.debts.reduce(function (s, d) { return s + debtStats(d).balance; }, 0);
      root.appendChild(el('<div class="card" style="margin-bottom:16px;"><p class="label" style="color:var(--text-secondary);font-size:13px;margin-bottom:4px;">Debes en total</p><p class="hero-figure" style="font-size:28px;color:' + COLOR_EXPENSE + '">' + formatMoney(totalBalance) + '</p></div>'));
    }

    var addBtn = el('<button type="button" class="primary-button" style="margin-bottom:16px;">+ Nueva deuda</button>');
    addBtn.addEventListener('click', function () { openDebtEditor(null); });
    root.appendChild(addBtn);

    if (!state.debts.length) {
      root.appendChild(el('<div class="empty-state"><span class="emoji">💳</span><p>No tienes deudas registradas. Agrega una para llevar el control de tus pagos.</p></div>'));
      return root;
    }

    var list = el('<div style="display:flex;flex-direction:column;gap:12px;"></div>');
    state.debts.forEach(function (d) {
      var st = debtStats(d);
      var card = el(
        '<button type="button" class="goal-card">' +
          '<div class="goal-card-head"><span class="goal-icon">' + d.icon + '</span>' +
          '<div class="goal-card-info"><p class="goal-name">' + escapeHTML(d.name) + '</p>' +
          '<p class="goal-sub">' + (st.done ? '¡Liquidada! 🎉' : 'Saldo: ' + formatMoney(st.balance)) + '</p></div>' +
          '<p class="goal-pct">' + st.pct + '%</p></div>' +
          '<div class="bar-track"><div class="bar-fill" style="width:' + Math.max(3, st.pct) + '%;background:' + (st.done ? COLOR_INCOME : COLOR_EXPENSE) + '"></div></div>' +
          (!st.done ? '<p class="goal-remaining">Próximo pago: ' + formatShortDate(st.nextPaymentDate) + ' · ' + formatMoney(Number(d.paymentAmount) || 0) + (st.payoffDate ? ' · Termina: ' + formatShortDate(st.payoffDate) : '') + '</p>' : '') +
        '</button>'
      );
      card.addEventListener('click', function () { openDebtDetail(d.id); });
      list.appendChild(card);
    });
    root.appendChild(list);
    return root;
  }

  function openDebtEditor(debt) {
    var isNew = !debt;
    var chosenIcon = debt ? debt.icon : '💳';
    var currentStats = debt ? debtStats(debt) : null;
    var body = openMini(isNew ? 'Nueva deuda' : 'Editar deuda',
      '<div class="field-group"><span class="field-label">Ícono</span><div class="category-grid" id="debt-icon-grid">' +
        DEBT_ICONS.map(function (ic) { return '<button type="button" class="category-chip' + (chosenIcon === ic ? ' selected' : '') + '" data-icon="' + ic + '"><span class="emoji">' + ic + '</span></button>'; }).join('') +
      '</div></div>' +
      '<div class="field-group"><span class="field-label">Nombre</span><input type="text" class="text-field" id="debt-name" maxlength="30" placeholder="Ej. Tarjeta BBVA" value="' + (debt ? escapeHTML(debt.name) : '') + '"/></div>' +
      '<div class="field-group"><span class="field-label">' + (isNew ? 'Cuánto debes' : 'Saldo actual que debes') + '</span><input type="text" inputmode="decimal" class="text-field" id="debt-balance" placeholder="0" value="' + (debt ? currentStats.balance : '') + '"/></div>' +
      '<div class="field-group two-col"><div><span class="field-label">Pago recurrente</span><input type="text" inputmode="decimal" class="text-field" id="debt-payment" placeholder="0" value="' + (debt ? debt.paymentAmount : '') + '"/></div>' +
      '<div><span class="field-label">Día de pago</span><input type="number" min="1" max="31" class="text-field" id="debt-day" placeholder="15" value="' + (debt ? debt.paymentDay : '') + '"/></div></div>' +
      '<div class="field-group"><span class="field-label">Se paga desde</span><select class="select-field" id="debt-account">' + accountOptions(debt ? debt.accountId : (state.accounts[0] && state.accounts[0].id)) + '</select></div>' +
      '<button type="button" class="primary-button" id="save-debt">' + (isNew ? 'Agregar deuda' : 'Guardar cambios') + '</button>' +
      (!isNew ? '<button type="button" class="secondary-button danger" id="delete-debt">Eliminar deuda</button>' : '')
    );

    $$('#debt-icon-grid .category-chip', body).forEach(function (chip) {
      chip.addEventListener('click', function () {
        chosenIcon = chip.dataset.icon;
        $$('#debt-icon-grid .category-chip', body).forEach(function (c) { c.classList.toggle('selected', c === chip); });
      });
    });

    $('#save-debt', body).addEventListener('click', function () {
      var name = $('#debt-name', body).value.trim();
      var balanceInput = parseAmountInput($('#debt-balance', body).value);
      var payment = parseAmountInput($('#debt-payment', body).value);
      var day = parseInt($('#debt-day', body).value, 10);
      var accId = $('#debt-account', body).value;
      if (!name) { toast('Ponle un nombre a la deuda.'); return; }
      if (!balanceInput || balanceInput <= 0) { toast('Ingresa cuánto debes.'); return; }
      if (!payment || payment <= 0) { toast('Ingresa el monto de tu pago recurrente.'); return; }
      if (!day || day < 1 || day > 31) { toast('Ingresa un día de pago válido (1-31).'); return; }
      if (isNew) {
        state.debts.push({ id: uid('debt'), name: name, icon: chosenIcon, startingBalance: balanceInput, paymentAmount: payment, paymentDay: day, accountId: accId, createdAt: Date.now() });
      } else {
        debt.name = name; debt.icon = chosenIcon; debt.paymentAmount = payment; debt.paymentDay = day; debt.accountId = accId;
        debt.startingBalance = balanceInput + currentStats.paid;
      }
      saveState(); closeMiniUI(); render();
      toast(isNew ? 'Deuda agregada.' : 'Deuda actualizada.');
    });

    if (!isNew) {
      $('#delete-debt', body).addEventListener('click', function () {
        openMini('Eliminar deuda',
          '<p class="helper-text" style="margin-top:0">Se eliminará "' + escapeHTML(debt.name) + '". Los pagos que ya registraste se quedan en tu historial de movimientos. Esta acción no se puede deshacer.</p>' +
          '<button type="button" class="primary-button danger-fill" id="confirm-del-debt">Sí, eliminar</button>' +
          '<button type="button" class="secondary-button" id="cancel-del-debt">Cancelar</button>'
        );
        $('#confirm-del-debt').addEventListener('click', function () {
          state.debts = state.debts.filter(function (d) { return d.id !== debt.id; });
          saveState(); closeMiniUI(); render();
          toast('Deuda eliminada.');
        });
        $('#cancel-del-debt').addEventListener('click', function () { openDebtEditor(debt); });
      });
    }
  }

  function openDebtDetail(debtId) {
    paintDebtDetail();

    function paintDebtDetail() {
      var debt = debtById(debtId);
      if (!debt) { closeMiniUI(); return; }
      var st = debtStats(debt);
      var body = openMini(debt.icon + ' ' + debt.name,
        '<p class="hero-figure" style="font-size:26px;color:' + (st.done ? COLOR_INCOME : COLOR_EXPENSE) + ';margin-bottom:4px;">' + formatMoney(st.balance) + '<span style="font-size:13px;color:var(--text-muted);font-weight:600;"> pendiente</span></p>' +
        '<div class="bar-track" style="margin-bottom:6px;"><div class="bar-fill" style="width:' + Math.max(3, st.pct) + '%;background:' + (st.done ? COLOR_INCOME : COLOR_EXPENSE) + '"></div></div>' +
        '<p class="helper-text" style="margin-top:0;text-align:left;">' + (st.done ? '¡Deuda liquidada! 🎉' : 'Pagado hasta ahora: ' + formatMoney(st.paid) + ' · Próximo pago: ' + formatShortDate(st.nextPaymentDate) + (st.payoffDate ? ' · Termina aprox.: ' + formatShortDate(st.payoffDate) : '')) + '</p>' +
        (!st.done ? '<button type="button" class="primary-button" id="add-payment">+ Registrar pago</button>' : '') +
        '<p class="field-label" style="margin-top:20px;">Historial de pagos</p>' +
        '<div id="debt-pay-list" class="tx-list"></div>' +
        '<button type="button" class="secondary-button" id="edit-debt-btn">Editar deuda</button>'
      );

      var list = $('#debt-pay-list', body);
      var payments = debtPayments(debt.id);
      if (!payments.length) {
        list.appendChild(el('<div class="empty-state" style="padding:20px 8px;"><p>Aún no registras pagos.</p></div>'));
      } else {
        payments.forEach(function (t) {
          var acc = accountById(t.accountId);
          list.appendChild(el(
            '<div class="tx-row"><span class="tx-icon expense">💳</span>' +
            '<span class="tx-info"><span class="tx-title">' + formatMoney(t.amount) + '</span><span class="tx-sub">' + formatDayHeading(t.date) + ' · ' + (acc ? escapeHTML(acc.name) : '—') + '</span></span></div>'
          ));
        });
      }

      if (!st.done) {
        $('#add-payment', body).addEventListener('click', function () {
          var body2 = openMini('Registrar pago',
            '<div class="field-group"><span class="field-label">Monto</span><input type="text" inputmode="decimal" class="text-field" id="pay-amount" value="' + (Number(debt.paymentAmount) || '') + '"/></div>' +
            '<div class="field-group"><span class="field-label">Cuenta</span><select class="select-field" id="pay-account">' + accountOptions(debt.accountId) + '</select></div>' +
            '<div class="field-group"><span class="field-label">Fecha</span><input type="date" class="text-field" id="pay-date" value="' + todayISO() + '" max="' + todayISO() + '"/></div>' +
            '<div class="field-group"><span class="field-label">Nota (opcional)</span><input type="text" class="text-field" id="pay-note" maxlength="80" placeholder="Agregar nota"/></div>' +
            '<button type="button" class="primary-button" id="save-payment">Guardar pago</button>'
          );
          $('#save-payment', body2).addEventListener('click', function () {
            var amount = parseAmountInput($('#pay-amount', body2).value);
            if (!amount || amount <= 0) { toast('Ingresa un monto válido.'); return; }
            var noteVal = $('#pay-note', body2).value.trim();
            state.transactions.push({
              id: uid('tx'), type: 'expense', amount: amount,
              accountId: $('#pay-account', body2).value,
              categoryId: 'deuda', debtId: debt.id,
              date: $('#pay-date', body2).value || todayISO(),
              note: (noteVal || ('Pago: ' + debt.name)).slice(0, 120),
              createdAt: Date.now()
            });
            saveState();
            paintDebtDetail();
            render();
            toast('Pago registrado.');
          });
        });
      }

      $('#edit-debt-btn', body).addEventListener('click', function () { openDebtEditor(debt); });
    }
  }

  // ---------- GASTOS RECURRENTES ----------

  var RECURRING_ICONS = ['📌', '🏠', '💡', '📶', '🎬', '📺', '🎵', '🏋️', '🚗', '📱', '🛡️', '☎️'];

  function renderRecurring() {
    var root = el('<div></div>');
    appendBackBar(root, 'Más');
    root.appendChild(el('<h2 style="font-size:20px;font-weight:800;margin:6px 2px 16px;">Gastos recurrentes</h2>'));

    var active = state.recurring.filter(function (r) { return r.active !== false; });
    if (active.length) {
      var totalMonthly = active.reduce(function (s, r) { return s + (Number(r.amount) || 0); }, 0);
      root.appendChild(el('<div class="card" style="margin-bottom:16px;"><p class="label" style="color:var(--text-secondary);font-size:13px;margin-bottom:4px;">Necesitas cada mes</p><p class="hero-figure" style="font-size:28px;">' + formatMoney(totalMonthly) + '</p></div>'));
    }

    var addBtn = el('<button type="button" class="primary-button" style="margin-bottom:16px;">+ Nuevo gasto recurrente</button>');
    addBtn.addEventListener('click', function () { openRecurringEditor(null); });
    root.appendChild(addBtn);

    if (!state.recurring.length) {
      root.appendChild(el('<div class="empty-state"><span class="emoji">📌</span><p>No tienes gastos fijos registrados. Agrega renta, suscripciones, servicios, etc.</p></div>'));
      return root;
    }

    var list = el('<div class="list-block"></div>');
    state.recurring.slice().sort(function (a, b) { return recurringStatus(a).dueDate - recurringStatus(b).dueDate; }).forEach(function (r) {
      var st = recurringStatus(r);
      var badgeClass = st.status === 'pagado' ? 'badge-good' : (st.status === 'vencido' ? 'badge-danger' : 'badge-neutral');
      var badgeText = st.status === 'pagado' ? 'Pagado' : (st.status === 'vencido' ? 'Vencido' : relativeDateLabel(st.dueDate));
      var row = el(
        '<button type="button" class="list-row"><span class="row-icon">' + r.icon + '</span>' +
        '<span class="row-text"><span class="row-title">' + escapeHTML(r.name) + '</span><span class="row-sub">Día ' + r.day + ' · ' + formatMoney(r.amount) + '</span></span>' +
        '<span class="badge ' + badgeClass + '">' + badgeText + '</span></button>'
      );
      row.addEventListener('click', function () { openRecurringDetail(r.id); });
      list.appendChild(row);
    });
    root.appendChild(list);
    return root;
  }

  function openRecurringEditor(item) {
    var isNew = !item;
    var chosenIcon = item ? item.icon : '📌';
    var expenseCats = state.categories.expense;
    var body = openMini(isNew ? 'Nuevo gasto recurrente' : 'Editar gasto recurrente',
      '<div class="field-group"><span class="field-label">Ícono</span><div class="category-grid" id="rec-icon-grid">' +
        RECURRING_ICONS.map(function (ic) { return '<button type="button" class="category-chip' + (chosenIcon === ic ? ' selected' : '') + '" data-icon="' + ic + '"><span class="emoji">' + ic + '</span></button>'; }).join('') +
      '</div></div>' +
      '<div class="field-group"><span class="field-label">Nombre</span><input type="text" class="text-field" id="rec-name" maxlength="30" placeholder="Ej. Renta" value="' + (item ? escapeHTML(item.name) : '') + '"/></div>' +
      '<div class="field-group two-col"><div><span class="field-label">Monto</span><input type="text" inputmode="decimal" class="text-field" id="rec-amount" placeholder="0" value="' + (item ? item.amount : '') + '"/></div>' +
      '<div><span class="field-label">Día del mes</span><input type="number" min="1" max="31" class="text-field" id="rec-day" placeholder="5" value="' + (item ? item.day : '') + '"/></div></div>' +
      '<div class="field-group"><span class="field-label">Categoría</span><select class="select-field" id="rec-category">' + expenseCats.map(function (c) { return '<option value="' + c.id + '"' + (item ? (item.categoryId === c.id ? ' selected' : '') : (c.id === 'servicios' ? ' selected' : '')) + '>' + c.icon + ' ' + escapeHTML(c.name) + '</option>'; }).join('') + '</select></div>' +
      '<div class="field-group"><span class="field-label">Cuenta</span><select class="select-field" id="rec-account">' + accountOptions(item ? item.accountId : (state.accounts[0] && state.accounts[0].id)) + '</select></div>' +
      '<button type="button" class="primary-button" id="save-rec">' + (isNew ? 'Agregar' : 'Guardar cambios') + '</button>' +
      (!isNew ? '<button type="button" class="secondary-button danger" id="delete-rec">Eliminar</button>' : '')
    );

    $$('#rec-icon-grid .category-chip', body).forEach(function (chip) {
      chip.addEventListener('click', function () {
        chosenIcon = chip.dataset.icon;
        $$('#rec-icon-grid .category-chip', body).forEach(function (c) { c.classList.toggle('selected', c === chip); });
      });
    });

    $('#save-rec', body).addEventListener('click', function () {
      var name = $('#rec-name', body).value.trim();
      var amount = parseAmountInput($('#rec-amount', body).value);
      var day = parseInt($('#rec-day', body).value, 10);
      var categoryId = $('#rec-category', body).value;
      var accId = $('#rec-account', body).value;
      if (!name) { toast('Ponle un nombre.'); return; }
      if (!amount || amount <= 0) { toast('Ingresa un monto válido.'); return; }
      if (!day || day < 1 || day > 31) { toast('Ingresa un día válido (1-31).'); return; }
      if (isNew) {
        state.recurring.push({ id: uid('rec'), name: name, icon: chosenIcon, amount: amount, day: day, categoryId: categoryId, accountId: accId, active: true, createdAt: Date.now() });
      } else {
        item.name = name; item.icon = chosenIcon; item.amount = amount; item.day = day; item.categoryId = categoryId; item.accountId = accId;
      }
      saveState(); closeMiniUI(); render();
      toast(isNew ? 'Gasto recurrente agregado.' : 'Gasto recurrente actualizado.');
    });

    if (!isNew) {
      $('#delete-rec', body).addEventListener('click', function () {
        openMini('Eliminar gasto recurrente',
          '<p class="helper-text" style="margin-top:0">Se eliminará "' + escapeHTML(item.name) + '". Los pagos que ya registraste se quedan en tu historial. Esta acción no se puede deshacer.</p>' +
          '<button type="button" class="primary-button danger-fill" id="confirm-del-rec">Sí, eliminar</button>' +
          '<button type="button" class="secondary-button" id="cancel-del-rec">Cancelar</button>'
        );
        $('#confirm-del-rec').addEventListener('click', function () {
          state.recurring = state.recurring.filter(function (r) { return r.id !== item.id; });
          saveState(); closeMiniUI(); render();
          toast('Gasto recurrente eliminado.');
        });
        $('#cancel-del-rec').addEventListener('click', function () { openRecurringEditor(item); });
      });
    }
  }

  function openRecurringDetail(id) {
    paintRecDetail();

    function paintRecDetail() {
      var item = recurringById(id);
      if (!item) { closeMiniUI(); return; }
      var st = recurringStatus(item);
      var cat = categoryById('expense', item.categoryId);
      var badgeClass = st.status === 'pagado' ? 'badge-good' : (st.status === 'vencido' ? 'badge-danger' : 'badge-neutral');
      var badgeText = st.status === 'pagado' ? 'Pagado este mes' : (st.status === 'vencido' ? 'Vencido' : 'Próximo: ' + formatShortDate(st.dueDate));
      var body = openMini(item.icon + ' ' + item.name,
        '<p class="hero-figure" style="font-size:26px;margin-bottom:6px;">' + formatMoney(item.amount) + '</p>' +
        '<span class="badge ' + badgeClass + '" style="margin-bottom:14px;display:inline-block;">' + badgeText + '</span>' +
        '<p class="helper-text" style="margin-top:0;text-align:left;">Día ' + item.day + ' de cada mes' + (cat ? ' · ' + cat.icon + ' ' + escapeHTML(cat.name) : '') + '</p>' +
        (st.status !== 'pagado' ? '<button type="button" class="primary-button" id="mark-paid">Marcar como pagado</button>' : '') +
        '<p class="field-label" style="margin-top:20px;">Historial</p>' +
        '<div id="rec-pay-list" class="tx-list"></div>' +
        '<button type="button" class="secondary-button" id="edit-rec-btn">Editar</button>'
      );

      var list = $('#rec-pay-list', body);
      var payments = recurringPayments(item.id);
      if (!payments.length) {
        list.appendChild(el('<div class="empty-state" style="padding:20px 8px;"><p>Aún no hay pagos registrados.</p></div>'));
      } else {
        payments.forEach(function (t) {
          var acc = accountById(t.accountId);
          list.appendChild(el(
            '<div class="tx-row"><span class="tx-icon expense">' + item.icon + '</span>' +
            '<span class="tx-info"><span class="tx-title">' + formatMoney(t.amount) + '</span><span class="tx-sub">' + formatDayHeading(t.date) + ' · ' + (acc ? escapeHTML(acc.name) : '—') + '</span></span></div>'
          ));
        });
      }

      if (st.status !== 'pagado') {
        $('#mark-paid', body).addEventListener('click', function () {
          var body2 = openMini('Marcar como pagado',
            '<div class="field-group"><span class="field-label">Monto</span><input type="text" inputmode="decimal" class="text-field" id="mp-amount" value="' + (Number(item.amount) || '') + '"/></div>' +
            '<div class="field-group"><span class="field-label">Cuenta</span><select class="select-field" id="mp-account">' + accountOptions(item.accountId) + '</select></div>' +
            '<div class="field-group"><span class="field-label">Fecha</span><input type="date" class="text-field" id="mp-date" value="' + todayISO() + '" max="' + todayISO() + '"/></div>' +
            '<button type="button" class="primary-button" id="save-mp">Guardar</button>'
          );
          $('#save-mp', body2).addEventListener('click', function () {
            var amount = parseAmountInput($('#mp-amount', body2).value);
            if (!amount || amount <= 0) { toast('Ingresa un monto válido.'); return; }
            state.transactions.push({
              id: uid('tx'), type: 'expense', amount: amount,
              accountId: $('#mp-account', body2).value,
              categoryId: item.categoryId, recurringId: item.id,
              date: $('#mp-date', body2).value || todayISO(),
              note: 'Gasto recurrente: ' + item.name,
              createdAt: Date.now()
            });
            saveState();
            paintRecDetail();
            render();
            toast('Marcado como pagado.');
          });
        });
      }

      $('#edit-rec-btn', body).addEventListener('click', function () { openRecurringEditor(item); });
    }
  }

  // ---------- mini sheet (generic bottom sheet) ----------

  function openMini(title, bodyHTML) {
    var backdrop = $('#mini-backdrop'), sheet = $('#mini-sheet');
    $('#mini-title').textContent = title;
    var body = $('#mini-body');
    body.innerHTML = bodyHTML;
    backdrop.hidden = false;
    sheet.hidden = false;
    requestAnimationFrame(function () { backdrop.classList.add('visible'); sheet.classList.add('open'); });
    return body;
  }

  function closeMiniUI() {
    var backdrop = $('#mini-backdrop'), sheet = $('#mini-sheet');
    backdrop.classList.remove('visible');
    sheet.classList.remove('open');
    setTimeout(function () { backdrop.hidden = true; sheet.hidden = true; }, 220);
  }

  // ---------- profile editor ----------

  function openProfileEditor() {
    var body = openMini('Editar perfil',
      '<div class="field-group"><span class="field-label">Tu nombre</span><input type="text" class="text-field" id="profile-name" maxlength="40" value="' + escapeHTML(state.profile.name) + '"/></div>' +
      '<div class="field-group"><span class="field-label">Moneda</span><select class="select-field" id="profile-currency">' +
        '<option value="MXN"' + (state.profile.currency === 'MXN' ? ' selected' : '') + '>Peso mexicano (MXN)</option>' +
        '<option value="USD"' + (state.profile.currency === 'USD' ? ' selected' : '') + '>Dólar (USD)</option>' +
        '<option value="EUR"' + (state.profile.currency === 'EUR' ? ' selected' : '') + '>Euro (EUR)</option>' +
      '</select></div>' +
      '<button type="button" class="primary-button" id="save-profile">Guardar</button>'
    );
    $('#save-profile', body).addEventListener('click', function () {
      state.profile.name = $('#profile-name', body).value.trim() || 'Tú';
      state.profile.currency = $('#profile-currency', body).value;
      saveState();
      closeMiniUI();
      render();
      toast('Perfil actualizado.');
    });
  }

  // ---------- account editor ----------

  var ACCOUNT_ICONS = ['💵', '💳', '🏦', '👛', '📱', '💰', '🏧', '🪙'];

  function openAccountEditor(acc) {
    var isNew = !acc;
    var chosenIcon = acc ? acc.icon : '💵';
    // netTx = cuánto han movido las transacciones el saldo desde el saldo inicial guardado.
    // Al editar mostramos y capturamos el SALDO ACTUAL (no el inicial histórico), para que
    // coincida con lo que el usuario ve en Inicio/Cuentas, y luego recalculamos el saldo
    // inicial internamente para que la cuenta siga cuadrando con su historial de movimientos.
    var currentBal = acc ? accountBalance(acc.id) : 0;
    var netTx = acc ? currentBal - (Number(acc.startBalance) || 0) : 0;
    var body = openMini(isNew ? 'Nueva cuenta' : 'Editar cuenta',
      '<div class="field-group"><span class="field-label">Ícono</span><div class="category-grid" id="icon-grid">' +
        ACCOUNT_ICONS.map(function (ic) { return '<button type="button" class="category-chip' + (chosenIcon === ic ? ' selected' : '') + '" data-icon="' + ic + '"><span class="emoji">' + ic + '</span></button>'; }).join('') +
      '</div></div>' +
      '<div class="field-group"><span class="field-label">Nombre</span><input type="text" class="text-field" id="acc-name" maxlength="30" value="' + (acc ? escapeHTML(acc.name) : '') + '" placeholder="Ej. Tarjeta BBVA"/></div>' +
      '<div class="field-group"><span class="field-label">' + (isNew ? 'Saldo inicial' : 'Saldo actual') + '</span><input type="text" inputmode="decimal" class="text-field" id="acc-balance" value="' + (acc ? currentBal : '0') + '"/></div>' +
      (!isNew ? '<p class="helper-text" style="margin-top:-10px;text-align:left;">Este es tu saldo de hoy en esta cuenta (ya incluye tus movimientos). Cámbialo solo si no coincide con la realidad; no borra tu historial.</p>' : '') +
      '<button type="button" class="primary-button" id="save-account">' + (isNew ? 'Agregar cuenta' : 'Guardar cambios') + '</button>' +
      (!isNew ? '<button type="button" class="secondary-button danger" id="delete-account">Eliminar cuenta</button>' : '')
    );

    $$('#icon-grid .category-chip', body).forEach(function (chip) {
      chip.addEventListener('click', function () {
        chosenIcon = chip.dataset.icon;
        $$('#icon-grid .category-chip', body).forEach(function (c) { c.classList.toggle('selected', c === chip); });
      });
    });

    $('#save-account', body).addEventListener('click', function () {
      var name = $('#acc-name', body).value.trim();
      if (!name) { toast('Ponle un nombre a la cuenta.'); return; }
      var bal = parseAmountInput($('#acc-balance', body).value);
      if (isNaN(bal)) bal = 0;
      if (isNew) {
        state.accounts.push({ id: uid('acc'), name: name, icon: chosenIcon, startBalance: bal });
      } else {
        acc.name = name; acc.icon = chosenIcon;
        acc.startBalance = bal - netTx;
      }
      saveState();
      closeMiniUI();
      render();
      toast(isNew ? 'Cuenta agregada.' : 'Cuenta actualizada.');
    });

    if (!isNew) {
      $('#delete-account', body).addEventListener('click', function () {
        if (state.accounts.length <= 1) { toast('Debes tener al menos una cuenta.'); return; }
        var used = state.transactions.some(function (t) { return t.accountId === acc.id || t.toAccountId === acc.id; });
        openMini('Eliminar cuenta',
          '<p class="helper-text" style="margin-top:0">' + (used ? 'Esta cuenta tiene movimientos asociados; se reasignarán a tu primera cuenta disponible. ' : '') + 'Esta acción no se puede deshacer.</p>' +
          '<button type="button" class="primary-button danger-fill" id="confirm-del-acc">Sí, eliminar</button>' +
          '<button type="button" class="secondary-button" id="cancel-del-acc">Cancelar</button>'
        );
        $('#confirm-del-acc').addEventListener('click', function () {
          state.accounts = state.accounts.filter(function (a) { return a.id !== acc.id; });
          var fallback = state.accounts[0] ? state.accounts[0].id : null;
          state.transactions.forEach(function (t) {
            if (t.accountId === acc.id) t.accountId = fallback;
            if (t.toAccountId === acc.id) t.toAccountId = fallback;
          });
          saveState();
          closeMiniUI();
          render();
          toast('Cuenta eliminada.');
        });
        $('#cancel-del-acc').addEventListener('click', function () { openAccountEditor(acc); });
      });
    }
  }

  // ---------- category manager ----------

  function openCategoryManager(type) {
    var body = openMini(type === 'expense' ? 'Categorías de gasto' : 'Categorías de ingreso',
      '<div class="category-grid" id="cat-manage-grid" style="margin-bottom:14px;"></div>' +
      '<div class="field-group two-col">' +
        '<input type="text" class="text-field" id="new-cat-icon" maxlength="4" placeholder="Emoji" style="text-align:center;"/>' +
        '<input type="text" class="text-field" id="new-cat-name" maxlength="24" placeholder="Nombre"/>' +
      '</div>' +
      '<button type="button" class="primary-button" id="add-cat-btn">Agregar categoría</button>' +
      '<p class="helper-text">Toca una categoría para eliminarla. Las categorías ya usadas en movimientos existentes se mostrarán como "Otros".</p>'
    );

    function paint() {
      var grid = $('#cat-manage-grid', body);
      grid.innerHTML = '';
      state.categories[type].forEach(function (c) {
        var chip = el('<button type="button" class="category-chip"><span class="emoji">' + c.icon + '</span><span class="label">' + escapeHTML(c.name) + '</span></button>');
        if (c.id !== 'otros_g' && c.id !== 'otros_i') {
          chip.addEventListener('click', function () {
            openMini('Eliminar categoría',
              '<p class="helper-text" style="margin-top:0">Se eliminará "' + escapeHTML(c.name) + '". Los movimientos ya registrados con ella se mostrarán como "Otros".</p>' +
              '<button type="button" class="primary-button danger-fill" id="confirm-del-cat">Sí, eliminar</button>' +
              '<button type="button" class="secondary-button" id="cancel-del-cat">Cancelar</button>'
            );
            $('#confirm-del-cat').addEventListener('click', function () {
              state.categories[type] = state.categories[type].filter(function (x) { return x.id !== c.id; });
              saveState();
              closeMiniUI();
              openCategoryManager(type);
            });
            $('#cancel-del-cat').addEventListener('click', function () { openCategoryManager(type); });
          });
        }
        grid.appendChild(chip);
      });
    }
    paint();

    $('#add-cat-btn', body).addEventListener('click', function () {
      var icon = ($('#new-cat-icon', body).value || '✨').trim().slice(0, 4) || '✨';
      var name = $('#new-cat-name', body).value.trim();
      if (!name) { toast('Escribe un nombre.'); return; }
      var list = state.categories[type];
      var insertAt = Math.max(0, list.length - 1);
      var color = nextColor(insertAt);
      list.splice(insertAt, 0, { id: uid('cat'), name: name, icon: icon, color: color });
      saveState();
      openCategoryManager(type);
    });
  }

  // ---------- backup / restore ----------

  function exportData() {
    var payload = { app: 'mi-dinero', version: APP_VERSION, exportedAt: new Date().toISOString(), data: state };
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'mi-dinero-respaldo-' + todayISO() + '.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    toast('Copia de seguridad descargada.');
  }

  function importData(file) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var parsed = JSON.parse(String(reader.result));
        var incoming = parsed && parsed.data ? parsed.data : parsed;
        if (!incoming || !Array.isArray(incoming.transactions)) throw new Error('Formato inválido');
        openMini('Importar copia de seguridad',
          '<p class="helper-text" style="margin-top:0">Esto reemplazará tus datos actuales (' + state.transactions.length + ' movimientos) por los del archivo (' + incoming.transactions.length + ' movimientos). ¿Continuar?</p>' +
          '<button type="button" class="primary-button" id="confirm-import">Sí, importar</button>' +
          '<button type="button" class="secondary-button" id="cancel-import">Cancelar</button>'
        );
        $('#confirm-import').addEventListener('click', function () {
          var base = defaultState();
          state = {
            profile: Object.assign({}, base.profile, incoming.profile),
            accounts: Array.isArray(incoming.accounts) && incoming.accounts.length ? incoming.accounts : base.accounts,
            categories: incoming.categories && incoming.categories.expense ? incoming.categories : base.categories,
            transactions: incoming.transactions,
            settings: Object.assign({}, base.settings, incoming.settings)
          };
          saveState();
          closeMiniUI();
          render();
          toast('Datos importados correctamente.');
        });
        $('#cancel-import').addEventListener('click', closeMiniUI);
      } catch (err) {
        toast('El archivo no es una copia de seguridad válida.');
      }
    };
    reader.readAsText(file);
  }

  function confirmWipe() {
    openMini('Borrar todos los datos',
      '<p class="helper-text" style="margin-top:0">Se eliminarán permanentemente tus ' + state.transactions.length + ' movimientos, cuentas y categorías personalizadas. Esta acción no se puede deshacer.</p>' +
      '<button type="button" class="primary-button danger-fill" id="confirm-wipe">Sí, borrar todo</button>' +
      '<button type="button" class="secondary-button" id="cancel-wipe">Cancelar</button>'
    );
    $('#confirm-wipe').addEventListener('click', function () {
      state = defaultState();
      saveState();
      closeMiniUI();
      render();
      toast('Se borraron todos los datos.');
    });
    $('#cancel-wipe').addEventListener('click', closeMiniUI);
  }

  // ---------- transaction sheet ----------

  var sheetType = 'expense';
  var editingTxId = null;
  var selectedCategoryId = null;

  function accountOptions(selectedId) {
    return state.accounts.map(function (a) {
      return '<option value="' + a.id + '"' + (a.id === selectedId ? ' selected' : '') + '>' + a.icon + ' ' + escapeHTML(a.name) + '</option>';
    }).join('');
  }

  function renderTransactionFields(tx) {
    var wrap = $('#transaction-fields');
    if (sheetType === 'transfer') {
      var fromId = tx ? tx.accountId : (state.accounts[0] ? state.accounts[0].id : null);
      var toId = tx ? tx.toAccountId : (state.accounts[1] ? state.accounts[1].id : fromId);
      wrap.innerHTML =
        '<div class="field-group two-col">' +
          '<div><span class="field-label">De</span><select class="select-field" id="field-from">' + accountOptions(fromId) + '</select></div>' +
          '<div><span class="field-label">Para</span><select class="select-field" id="field-to">' + accountOptions(toId) + '</select></div>' +
        '</div>' +
        '<div class="field-group"><span class="field-label">Fecha</span><input type="date" class="text-field" id="field-date" value="' + (tx ? tx.date : todayISO()) + '" max="' + todayISO() + '"/></div>' +
        '<div class="field-group"><span class="field-label">Nota (opcional)</span><input type="text" class="text-field" id="field-note" placeholder="Agregar nota" maxlength="80" value="' + (tx && tx.note ? escapeHTML(tx.note) : '') + '"/></div>';
    } else {
      var cats = state.categories[sheetType];
      if (!selectedCategoryId || !categoryById(sheetType, selectedCategoryId)) {
        selectedCategoryId = (tx && tx.categoryId) || (cats[0] && cats[0].id) || null;
      }
      var accId = tx ? tx.accountId : (state.accounts[0] ? state.accounts[0].id : null);
      wrap.innerHTML =
        '<div class="field-group"><span class="field-label">Categoría</span><div class="category-grid" id="category-grid">' +
          cats.map(function (c) {
            return '<button type="button" class="category-chip' + (c.id === selectedCategoryId ? ' selected' : '') + '" data-cat="' + c.id + '"><span class="emoji">' + c.icon + '</span><span class="label">' + escapeHTML(c.name) + '</span></button>';
          }).join('') +
        '</div></div>' +
        '<div class="field-group two-col">' +
          '<div><span class="field-label">Cuenta</span><select class="select-field" id="field-account">' + accountOptions(accId) + '</select></div>' +
          '<div><span class="field-label">Fecha</span><input type="date" class="text-field" id="field-date" value="' + (tx ? tx.date : todayISO()) + '" max="' + todayISO() + '"/></div>' +
        '</div>' +
        '<div class="field-group"><span class="field-label">Nota (opcional)</span><input type="text" class="text-field" id="field-note" placeholder="Agregar nota" maxlength="80" value="' + (tx && tx.note ? escapeHTML(tx.note) : '') + '"/></div>';

      $$('.category-chip', wrap).forEach(function (chip) {
        chip.addEventListener('click', function () {
          selectedCategoryId = chip.dataset.cat;
          $$('.category-chip', wrap).forEach(function (c) { c.classList.toggle('selected', c === chip); });
        });
      });
    }
  }

  function syncTypeSwitch() {
    $$('#transaction-form .type-switch button').forEach(function (b) { b.classList.toggle('selected', b.dataset.type === sheetType); });
  }

  function openSheetFor(tx) {
    editingTxId = tx ? tx.id : null;
    sheetType = tx ? tx.type : 'expense';
    selectedCategoryId = tx && tx.type !== 'transfer' ? tx.categoryId : null;

    syncTypeSwitch();
    $('#amount-label').textContent = AMOUNT_LABEL[sheetType];
    $('#tx-amount').value = tx ? String(tx.amount) : '';
    renderTransactionFields(tx);

    var deleteBtn = $('#delete-transaction');
    deleteBtn.hidden = !tx;
    $('#sheet-title').textContent = (editingTxId ? EDIT_LABEL : NEW_LABEL)[sheetType];
    $('#save-transaction').textContent = editingTxId ? 'Guardar cambios' : SAVE_LABEL[sheetType];

    openSheetUI();
  }

  function openSheetUI() {
    var backdrop = $('#sheet-backdrop'), sheet = $('#transaction-sheet');
    backdrop.hidden = false;
    sheet.hidden = false;
    requestAnimationFrame(function () { backdrop.classList.add('visible'); sheet.classList.add('open'); });
    setTimeout(function () { $('#tx-amount').focus(); }, 260);
  }

  function closeSheetUI() {
    var backdrop = $('#sheet-backdrop'), sheet = $('#transaction-sheet');
    backdrop.classList.remove('visible');
    sheet.classList.remove('open');
    setTimeout(function () { backdrop.hidden = true; sheet.hidden = true; }, 220);
  }

  function handleDeleteTransaction() {
    if (!editingTxId) return;
    var idToDelete = editingTxId;
    openMini('Eliminar movimiento',
      '<p class="helper-text" style="margin-top:0">Esta acción no se puede deshacer.</p>' +
      '<button type="button" class="primary-button danger-fill" id="confirm-delete-tx">Sí, eliminar</button>' +
      '<button type="button" class="secondary-button" id="cancel-delete-tx">Cancelar</button>'
    );
    $('#confirm-delete-tx').addEventListener('click', function () {
      state.transactions = state.transactions.filter(function (t) { return t.id !== idToDelete; });
      saveState();
      closeMiniUI();
      closeSheetUI();
      render();
      toast('Movimiento eliminado.');
    });
    $('#cancel-delete-tx').addEventListener('click', closeMiniUI);
  }

  function handleTransactionSubmit(e) {
    e.preventDefault();
    var amount = parseAmountInput($('#tx-amount').value);
    if (!amount || amount <= 0) { toast('Ingresa un monto válido.'); $('#tx-amount').focus(); return; }

    var dateField = $('#field-date');
    var noteField = $('#field-note');
    var dateVal = (dateField && dateField.value) || todayISO();
    var noteVal = noteField ? noteField.value.trim().slice(0, 120) : '';

    var payload;
    if (sheetType === 'transfer') {
      var fromId = $('#field-from').value;
      var toId = $('#field-to').value;
      if (fromId === toId) { toast('Elige dos cuentas diferentes.'); return; }
      payload = { type: 'transfer', amount: amount, accountId: fromId, toAccountId: toId, date: dateVal, note: noteVal };
    } else {
      var accId = $('#field-account').value;
      if (!selectedCategoryId) { toast('Elige una categoría.'); return; }
      payload = { type: sheetType, amount: amount, accountId: accId, categoryId: selectedCategoryId, date: dateVal, note: noteVal };
    }

    if (editingTxId) {
      var idx = state.transactions.findIndex(function (t) { return t.id === editingTxId; });
      if (idx > -1) state.transactions[idx] = Object.assign({}, state.transactions[idx], payload);
      toast('Movimiento actualizado.');
    } else {
      payload.id = uid('tx');
      payload.createdAt = Date.now();
      state.transactions.push(payload);
      toast(sheetType === 'expense' ? 'Gasto registrado.' : sheetType === 'income' ? 'Ingreso registrado.' : 'Transferencia registrada.');
    }

    saveState();
    closeSheetUI();
    render();
  }

  // ---------- static wiring ----------

  function wireStaticHandlers() {
    $$('.nav-item').forEach(function (btn) { btn.addEventListener('click', function () { switchView(btn.dataset.view); }); });
    $('#add-button').addEventListener('click', function () { openSheetFor(null); });
    $('#avatar-button').addEventListener('click', openProfileEditor);

    $('#close-sheet').addEventListener('click', closeSheetUI);
    $('#sheet-backdrop').addEventListener('click', closeSheetUI);
    $('#delete-transaction').addEventListener('click', handleDeleteTransaction);

    $$('#transaction-form .type-switch button').forEach(function (btn) {
      btn.addEventListener('click', function () {
        sheetType = btn.dataset.type;
        selectedCategoryId = null;
        syncTypeSwitch();
        $('#amount-label').textContent = AMOUNT_LABEL[sheetType];
        var current = editingTxId ? state.transactions.find(function (t) { return t.id === editingTxId; }) : null;
        renderTransactionFields(current && current.type === sheetType ? current : null);
        $('#save-transaction').textContent = editingTxId ? 'Guardar cambios' : SAVE_LABEL[sheetType];
      });
    });

    $('#tx-amount').addEventListener('input', function (e) {
      e.target.value = e.target.value.replace(/[^0-9.,]/g, '');
    });

    $('#transaction-form').addEventListener('submit', handleTransactionSubmit);

    $('#close-mini').addEventListener('click', closeMiniUI);
    $('#mini-backdrop').addEventListener('click', closeMiniUI);

    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      if (!$('#transaction-sheet').hidden) closeSheetUI();
      if (!$('#mini-sheet').hidden) closeMiniUI();
    });

    window.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault();
      deferredPrompt = e;
      if (currentView === 'more') render();
    });
    window.addEventListener('appinstalled', function () {
      deferredPrompt = null;
      toast('¡Mi Dinero instalada! Búscala en tu pantalla de inicio.');
      if (currentView === 'more') render();
    });
  }

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    if (!(location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) return;
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function (err) {
        console.warn('No se pudo registrar el service worker.', err);
      });
    });
  }

  // ---------- init ----------

  function init() {
    wireStaticHandlers();
    registerServiceWorker();
    render();
  }

  init();
})();
