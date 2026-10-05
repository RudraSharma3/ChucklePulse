/**
 * ChucklePulse - Clean, Simple Frontend Application Engine
 * Connects directly to backend JSON storage for real company employees and standups.
 */

const App = {
  employees: [],
  standups: [],
  settings: {},
  currentTheme: 'dark',

  async init() {
    this.bindEvents();
    this.displayTodayDate();
    await this.loadSettings();
    await this.loadEmployees();
    await this.loadStandups();
  },

  bindEvents() {
    // Tab Switching
    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        this.switchTab(tab, btn);
      });
    });

    // Theme Toggle
    document.getElementById('theme-toggle-btn').addEventListener('click', () => {
      this.toggleTheme();
    });

    // Send to Google Chat Top Button
    document.getElementById('btn-send-gchat-now').addEventListener('click', () => {
      this.triggerGoogleChatStandup();
    });

    // Add Employee Form
    document.getElementById('btn-open-add-emp').addEventListener('click', () => {
      this.openAddEmployeeModal();
    });

    document.getElementById('form-add-emp').addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleAddEmployee();
    });

    // Quick Log Standup Form
    document.getElementById('btn-open-quick-log').addEventListener('click', () => {
      this.openQuickLogModal();
    });

    document.getElementById('form-quick-log').addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleQuickLogSubmit();
    });

    // Settings Form
    document.getElementById('settings-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleSaveSettings();
    });

    document.getElementById('btn-test-gchat-webhook').addEventListener('click', () => {
      this.triggerGoogleChatStandup();
    });

    // Search & Filters
    document.getElementById('standup-search-input').addEventListener('input', () => {
      this.renderStandupsTable();
    });

    document.getElementById('standup-dept-filter').addEventListener('change', () => {
      this.renderStandupsTable();
    });

    // Export & Copy
    document.getElementById('btn-copy-summary').addEventListener('click', () => {
      this.copyDailySummary();
    });

    document.getElementById('btn-download-csv').addEventListener('click', () => {
      this.downloadCSV();
    });
  },

  displayTodayDate() {
    const el = document.getElementById('today-date-str');
    if (el) {
      const today = new Date();
      el.textContent = today.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    }
  },

  switchTab(tabName, btn) {
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

    btn.classList.add('active');
    const target = document.getElementById(`tab-${tabName}`);
    if (target) target.classList.add('active');
  },

  toggleTheme() {
    const body = document.body;
    const btn = document.getElementById('theme-toggle-btn');
    if (body.classList.contains('dark-theme')) {
      body.classList.remove('dark-theme');
      body.classList.add('light-theme');
      btn.innerHTML = '<i class="fa-solid fa-sun"></i>';
      this.currentTheme = 'light';
    } else {
      body.classList.remove('light-theme');
      body.classList.add('dark-theme');
      btn.innerHTML = '<i class="fa-solid fa-moon"></i>';
      this.currentTheme = 'dark';
    }
    localStorage.setItem('chuckle_theme', this.currentTheme);
  },

  // API Calls
  async loadSettings() {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      this.settings = data;

      document.getElementById('header-company-name').textContent = data.companyName || 'My Company';
      document.getElementById('setting-company-name').value = data.companyName || '';
      document.getElementById('setting-appscript-url').value = data.appsScriptUrl || '';
      document.getElementById('setting-webhook-url').value = data.googleChatWebhookUrl || '';
      document.getElementById('setting-start-time').value = data.standupStartTime || '10:00';
      document.getElementById('setting-end-time').value = data.standupEndTime || '10:30';
      document.getElementById('setting-bot-prompt').value = data.botPrompt || '';

      const savedTheme = localStorage.getItem('chuckle_theme');
      if (savedTheme === 'light') {
        this.toggleTheme();
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    }
  },

  async handleSaveSettings() {
    const payload = {
      companyName: document.getElementById('setting-company-name').value.trim(),
      appsScriptUrl: document.getElementById('setting-appscript-url').value.trim(),
      googleChatWebhookUrl: document.getElementById('setting-webhook-url').value.trim(),
      standupStartTime: document.getElementById('setting-start-time').value,
      standupEndTime: document.getElementById('setting-end-time').value,
      botPrompt: document.getElementById('setting-bot-prompt').value.trim()
    };

    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        this.settings = data.settings;
        document.getElementById('header-company-name').textContent = this.settings.companyName || 'My Company';
        this.showToast('Settings saved successfully!');
      }
    } catch (err) {
      this.showToast('Error saving settings: ' + err.message);
    }
  },

  async loadEmployees() {
    try {
      const res = await fetch('/api/employees');
      this.employees = await res.json();
      this.renderEmployeesTable();
      this.updateKPICards();
      this.populateDepartmentFilters();
    } catch (err) {
      console.error('Failed to load employees:', err);
    }
  },

  async handleAddEmployee() {
    const id = document.getElementById('emp-input-id').value;
    const name = document.getElementById('emp-input-name').value.trim();
    const email = document.getElementById('emp-input-email').value.trim();
    const dept = document.getElementById('emp-input-dept').value.trim();
    const role = document.getElementById('emp-input-role').value.trim();

    try {
      const res = await fetch('/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, name, email, dept, role })
      });

      if (res.ok) {
        this.closeModals();
        document.getElementById('form-add-emp').reset();
        await this.loadEmployees();
        this.showToast(`Employee "${name}" saved!`);
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to save employee');
      }
    } catch (err) {
      this.showToast('Network error saving employee');
    }
  },

  editEmployee(empId) {
    const emp = this.employees.find(e => e.id === empId);
    if (!emp) return;

    document.getElementById('modal-emp-title').innerHTML = `<i class="fa-solid fa-pen-to-square text-primary"></i> Edit Employee`;
    document.getElementById('emp-input-id').value = emp.id;
    document.getElementById('emp-input-name').value = emp.name;
    document.getElementById('emp-input-email').value = emp.email;
    document.getElementById('emp-input-dept').value = emp.dept || '';
    document.getElementById('emp-input-role').value = emp.role || '';
    document.getElementById('modal-add-emp').classList.add('active');
  },

  async deleteEmployee(id, name) {
    if (!confirm(`Are you sure you want to remove ${name}?`)) return;

    try {
      const res = await fetch(`/api/employees/${id}`, { method: 'DELETE' });
      if (res.ok) {
        await this.loadEmployees();
        this.showToast(`Employee "${name}" removed`);
      }
    } catch (err) {
      this.showToast('Failed to remove employee');
    }
  },

  renderEmployeesTable() {
    const tbody = document.getElementById('employees-table-body');
    const emptyState = document.getElementById('employees-empty-state');
    const badge = document.getElementById('emp-count-badge');

    badge.textContent = this.employees.length;

    if (this.employees.length === 0) {
      tbody.innerHTML = '';
      emptyState.style.display = 'block';
      document.getElementById('employees-table').style.display = 'none';
      return;
    }

    emptyState.style.display = 'none';
    document.getElementById('employees-table').style.display = 'table';

    tbody.innerHTML = this.employees.map(emp => {
      return `
        <tr>
          <td><strong>${this.escapeHTML(emp.name)}</strong></td>
          <td><code>${this.escapeHTML(emp.email)}</code></td>
          <td><span class="badge badge-secondary">${this.escapeHTML(emp.dept || 'General')}</span></td>
          <td>${this.escapeHTML(emp.role || 'Team Member')}</td>
          <td>
            <span class="badge badge-success"><i class="fa-solid fa-robot"></i> Google Chat Bot 1:1</span>
          </td>
          <td>
            <div style="display: flex; gap: 6px; flex-wrap: wrap;">
              <button class="btn btn-sm btn-outline" onclick="App.editEmployee('${emp.id}')" title="Edit employee details">
                <i class="fa-solid fa-pen"></i> Edit
              </button>
              <button class="btn btn-danger-outline" onclick="App.deleteEmployee('${emp.id}', '${this.escapeHTML(emp.name)}')">
                <i class="fa-solid fa-trash"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },

  // Standups
  async loadStandups() {
    try {
      const res = await fetch('/api/standups');
      this.standups = await res.json();
      this.renderStandupsTable();
      this.updateKPICards();
    } catch (err) {
      console.error('Failed to load standups:', err);
    }
  },

  async handleQuickLogSubmit() {
    const empSelect = document.getElementById('log-select-emp');
    const empId = empSelect.value;
    const selectedEmp = this.employees.find(e => e.id === empId);

    const payload = {
      name: selectedEmp ? selectedEmp.name : 'Unknown',
      email: selectedEmp ? selectedEmp.email : '',
      dept: selectedEmp ? selectedEmp.dept : 'General',
      tasks: document.getElementById('log-input-tasks').value.trim(),
      hours: parseFloat(document.getElementById('log-input-hours').value) || 7.5,
      project: document.getElementById('log-input-project').value.trim() || 'General Tasks',
      blocker: document.getElementById('log-input-blocker').value.trim() || 'None',
      source: 'Manual Log'
    };

    try {
      const res = await fetch('/api/standups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        this.closeModals();
        document.getElementById('form-quick-log').reset();
        await this.loadStandups();
        this.showToast(`Standup logged for ${payload.name}!`);
      }
    } catch (err) {
      this.showToast('Error saving standup');
    }
  },

  renderStandupsTable() {
    const tbody = document.getElementById('standups-table-body');
    const emptyState = document.getElementById('standups-empty-state');
    const searchVal = document.getElementById('standup-search-input').value.toLowerCase();
    const deptVal = document.getElementById('standup-dept-filter').value;

    const todayDate = new Date().toISOString().slice(0, 10);
    const todayLogs = this.standups.filter(s => s.date === todayDate);

    let filtered = todayLogs.filter(s => {
      const matchSearch = s.name.toLowerCase().includes(searchVal) ||
        (s.tasks && s.tasks.toLowerCase().includes(searchVal)) ||
        (s.project && s.project.toLowerCase().includes(searchVal)) ||
        (s.email && s.email.toLowerCase().includes(searchVal));

      const matchDept = deptVal === 'all' || s.dept === deptVal;
      return matchSearch && matchDept;
    });

    if (filtered.length === 0) {
      tbody.innerHTML = '';
      emptyState.style.display = 'block';
      document.getElementById('standups-table').style.display = 'none';
      return;
    }

    emptyState.style.display = 'none';
    document.getElementById('standups-table').style.display = 'table';

    tbody.innerHTML = filtered.map(s => {
      const hasBlocker = s.blocker && s.blocker !== 'None' && s.blocker.toLowerCase() !== 'no';

      return `
        <tr>
          <td>
            <strong>${this.escapeHTML(s.name)}</strong>
            <br><small class="text-muted">${this.escapeHTML(s.email)}</small>
          </td>
          <td><span class="badge badge-secondary">${this.escapeHTML(s.dept || 'General')}</span></td>
          <td class="text-muted">${s.time || '--:--'}</td>
          <td>${this.escapeHTML(s.tasks)}</td>
          <td><span class="hours-tag">${s.hours} hrs</span></td>
          <td><strong>${this.escapeHTML(s.project || '-')}</strong></td>
          <td>
            ${hasBlocker 
              ? `<span class="badge badge-warning" title="${this.escapeHTML(s.blocker)}"><i class="fa-solid fa-triangle-exclamation"></i> ${this.escapeHTML(s.blocker)}</span>`
              : `<span class="badge badge-success"><i class="fa-solid fa-check"></i> Clear</span>`}
          </td>
          <td>
            <small class="text-dim">${s.source || 'Google Chat'}</small>
          </td>
        </tr>
      `;
    }).join('');
  },

  updateKPICards() {
    const totalEmp = this.employees.length;
    const todayDate = new Date().toISOString().slice(0, 10);
    const todayLogs = this.standups.filter(s => s.date === todayDate);

    const checkedInCount = todayLogs.length;
    const pct = totalEmp > 0 ? Math.round((checkedInCount / totalEmp) * 100) : 0;
    const totalHours = todayLogs.reduce((acc, curr) => acc + (parseFloat(curr.hours) || 0), 0);
    const blockersCount = todayLogs.filter(s => s.blocker && s.blocker !== 'None' && s.blocker.toLowerCase() !== 'no').length;

    document.getElementById('kpi-total-emp').textContent = totalEmp;
    document.getElementById('kpi-checked-in').textContent = `${checkedInCount} / ${totalEmp}`;
    document.getElementById('kpi-checkin-pct').textContent = `${pct}% response rate`;
    document.getElementById('kpi-total-hours').textContent = `${totalHours.toFixed(1)} hrs`;
    document.getElementById('kpi-blockers').textContent = blockersCount;
  },

  populateDepartmentFilters() {
    const depts = new Set(this.employees.map(e => e.dept || 'General').filter(Boolean));
    const select = document.getElementById('standup-dept-filter');
    select.innerHTML = '<option value="all">All Departments</option>';
    depts.forEach(d => {
      const opt = document.createElement('option');
      opt.value = d;
      opt.textContent = d;
      select.appendChild(opt);
    });
  },

  // Trigger Google Chat Message to All
  async triggerGoogleChatStandup() {
    try {
      this.showToast('Sending standup prompt & animated GIFs to all team members...');
      const res = await fetch('/api/trigger-bot', { method: 'POST' });
      const data = await res.json();

      if (res.ok) {
        this.showToast(data.message || '✅ Dispatched to all employee chats!');
      } else {
        alert(data.error || 'Failed to dispatch to Google Chat.');
      }
    } catch (err) {
      this.showToast('Error connecting to server');
    }
  },

  // Modals
  openAddEmployeeModal() {
    document.getElementById('modal-emp-title').innerHTML = `<i class="fa-solid fa-user-plus text-primary"></i> Add Company Employee`;
    document.getElementById('emp-input-id').value = '';
    document.getElementById('form-add-emp').reset();
    document.getElementById('modal-add-emp').classList.add('active');
    document.getElementById('emp-input-name').focus();
  },

  openQuickLogModal() {
    const select = document.getElementById('log-select-emp');
    if (this.employees.length === 0) {
      alert('Please add employees in the "Company Employees" tab first!');
      return;
    }

    select.innerHTML = this.employees.map(e => `
      <option value="${e.id}">${this.escapeHTML(e.name)} (${this.escapeHTML(e.email)})</option>
    `).join('');

    document.getElementById('modal-quick-log').classList.add('active');
  },

  closeModals() {
    document.querySelectorAll('.modal-backdrop').forEach(m => m.classList.remove('active'));
  },

  // Export Tools
  copyDailySummary() {
    const todayDate = new Date().toISOString().slice(0, 10);
    const todayLogs = this.standups.filter(s => s.date === todayDate);

    if (todayLogs.length === 0) {
      this.showToast('No check-ins today to copy yet.');
      return;
    }

    const totalHours = todayLogs.reduce((acc, c) => acc + (parseFloat(c.hours) || 0), 0);
    const company = this.settings.companyName || 'Company';

    let summary = `📊 *${company} Daily Standup Summary* (${new Date().toLocaleDateString()})\n`;
    summary += `Check-ins: ${todayLogs.length}/${this.employees.length} | Total Hours: ${totalHours.toFixed(1)} hrs\n\n`;

    todayLogs.forEach(s => {
      summary += `• *${s.name}* (${s.dept}): ${s.tasks} [${s.hours}h - ${s.project}]\n`;
      if (s.blocker && s.blocker !== 'None' && s.blocker.toLowerCase() !== 'no') {
        summary += `  ⚠️ *Blocker:* ${s.blocker}\n`;
      }
    });

    navigator.clipboard.writeText(summary);
    this.showToast('Summary copied to clipboard!');
  },

  downloadCSV() {
    const todayDate = new Date().toISOString().slice(0, 10);
    const todayLogs = this.standups.filter(s => s.date === todayDate);

    if (todayLogs.length === 0) {
      this.showToast('No logs to export today.');
      return;
    }

    let csv = 'Employee,Email,Department,Time,Tasks,Hours,Project,Blocker\n';
    todayLogs.forEach(s => {
      csv += `"${s.name}","${s.email}","${s.dept}","${s.time}","${s.tasks.replace(/"/g, '""')}",${s.hours},"${s.project}","${s.blocker.replace(/"/g, '""')}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Standups_${todayDate}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    this.showToast('CSV downloaded!');
  },

  showToast(msg) {
    const toast = document.getElementById('toast');
    const toastText = document.getElementById('toast-text');
    toastText.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
    }, 3000);
  },

  escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, 
      tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
  }
};

document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
