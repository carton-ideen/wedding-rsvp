(function () {
  'use strict';

  var STORAGE_KEY = 'admin_token';

  var passwordInput = document.getElementById('admin-password');
  var loginBtn = document.getElementById('admin-login-btn');
  var tokenStatus = document.getElementById('admin-token-status');
  var pdfLink = document.getElementById('pdf-download');
  var xlsxLink = document.getElementById('xlsx-download');
  var sumYes = document.getElementById('sum-yes');
  var sumNo = document.getElementById('sum-no');
  var sumGuests = document.getElementById('sum-guests');
  var sumMeat = document.getElementById('sum-meat');
  var sumVegi = document.getElementById('sum-vegi');
  var sumKids = document.getElementById('sum-kids');
  var filterStatus = document.getElementById('filter-status');
  var filterAllergies = document.getElementById('filter-allergies');
  var filterSearch = document.getElementById('filter-search');
  var tbody = document.getElementById('admin-tbody');
  var tableEmpty = document.getElementById('admin-table-empty');
  var tableWrap = document.getElementById('table-wrap');
  var adminCards = document.getElementById('admin-cards');
  var adminContent = document.getElementById('admin-content');
  var tabRsvp = document.getElementById('tab-rsvp');
  var tabTischplan = document.getElementById('tab-tischplan');
  var panelRsvp = document.getElementById('panel-rsvp');
  var panelTischplan = document.getElementById('panel-tischplan');
  var adminLoginSection = document.getElementById('admin-login-section');

  var allRsvps = [];
  var currentToken = '';
  var tischplanPlan = { tables: [], assignments: {} };

  function getStoredToken() {
    try {
      return localStorage.getItem(STORAGE_KEY) || '';
    } catch (e) {
      return '';
    }
  }

  function setStoredToken(token) {
    try {
      if (token) localStorage.setItem(STORAGE_KEY, token);
      else localStorage.removeItem(STORAGE_KEY);
    } catch (e) {}
  }

  function setStatus(msg, type) {
    tokenStatus.textContent = msg;
    tokenStatus.className = 'admin-status' + (type ? ' ' + type : '');
  }

  function formatDate(createdAt) {
    if (!createdAt) return '—';
    var d = new Date(createdAt);
    return isNaN(d.getTime()) ? createdAt : d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  function escapeHtml(str) {
    if (str == null || str === '') return '';
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function updateDownloadLinks() {
    var q = currentToken ? '?token=' + encodeURIComponent(currentToken) : '';
    if (currentToken) {
      xlsxLink.href = '/api/admin/rsvps.xlsx' + q;
      pdfLink.href = '/api/admin/rsvps.pdf' + q;
      xlsxLink.removeAttribute('aria-disabled');
      pdfLink.removeAttribute('aria-disabled');
    } else {
      xlsxLink.href = '#';
      pdfLink.href = '#';
      xlsxLink.setAttribute('aria-disabled', 'true');
      pdfLink.setAttribute('aria-disabled', 'true');
    }
  }

  function computeSums(rows) {
    var yes = 0, no = 0, guests = 0, meat = 0, vegi = 0, kids = 0;
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      if (r.attending === 'yes') {
        yes++;
        guests += r.total_guests || 0;
        meat += r.menu_meat || 0;
        vegi += r.menu_vegi || 0;
        kids += r.menu_kids || 0;
      } else {
        no++;
      }
    }
    sumYes.textContent = yes;
    sumNo.textContent = no;
    sumGuests.textContent = guests;
    sumMeat.textContent = meat;
    sumVegi.textContent = vegi;
    sumKids.textContent = kids;
  }

  function filterRows() {
    var statusVal = filterStatus.value;
    var onlyAllergies = filterAllergies.checked;
    var q = (filterSearch.value || '').trim().toLowerCase();
    var out = [];
    for (var i = 0; i < allRsvps.length; i++) {
      var r = allRsvps[i];
      if (statusVal === 'yes' && r.attending !== 'yes') continue;
      if (statusVal === 'no' && r.attending !== 'no') continue;
      if (onlyAllergies && !r.allergies_has) continue;
      if (q) {
        var name = (r.name || '').toLowerCase();
        var contact = (r.contact || '').toLowerCase();
        if (name.indexOf(q) === -1 && contact.indexOf(q) === -1) continue;
      }
      out.push(r);
    }
    return out;
  }

  function deleteRsvp(id, btn) {
    if (!currentToken || !confirm('Diese Anmeldung wirklich löschen?')) return;
    btn.disabled = true;
    var url = '/api/admin/rsvps/' + id + '?token=' + encodeURIComponent(currentToken);
    fetch(url, { method: 'DELETE' })
      .then(function (res) {
        return res.json().then(function (data) {
          if (res.ok && data.ok) {
            allRsvps = allRsvps.filter(function (r) { return r.id !== id; });
            applyFiltersAndRender();
          }
        });
      })
      .catch(function () {})
      .finally(function () { btn.disabled = false; });
  }

  function renderTable(rows) {
    tbody.innerHTML = '';
    if (adminCards) adminCards.innerHTML = '';
    if (rows.length === 0) {
      if (tableWrap) tableWrap.classList.add('hidden');
      if (adminCards) adminCards.classList.add('hidden');
      tableEmpty.classList.remove('hidden');
      return;
    }
    if (tableWrap) tableWrap.classList.remove('hidden');
    if (adminCards) {
      adminCards.classList.remove('hidden');
      adminCards.setAttribute('aria-hidden', 'false');
    }
    tableEmpty.classList.add('hidden');
    var dash = '—';
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      var isYes = r.attending === 'yes';
      var delBtn = '<button type="button" class="admin-btn-delete btn-delete" data-id="' + escapeHtml(String(r.id)) + '" title="Anmeldung löschen">Löschen</button>';
      var tr = document.createElement('tr');
      tr.innerHTML =
        '<td>' + escapeHtml(formatDate(r.created_at)) + '</td>' +
        '<td>' + escapeHtml(r.name || '') + '</td>' +
        '<td>' + escapeHtml(r.contact || '') + '</td>' +
        '<td>' + (isYes ? 'Ja' : 'Nein') + '</td>' +
        '<td>' + (isYes ? (r.total_guests != null ? r.total_guests : dash) : dash) + '</td>' +
        '<td>' + (isYes ? (r.menu_meat != null ? r.menu_meat : dash) : dash) + '</td>' +
        '<td>' + (isYes ? (r.menu_vegi != null ? r.menu_vegi : dash) : dash) + '</td>' +
        '<td>' + (isYes ? (r.menu_kids != null ? r.menu_kids : dash) : dash) + '</td>' +
        '<td>' + (r.allergies_has ? 'ja' : 'nein') + '</td>' +
        '<td>' + escapeHtml(r.allergies_text || '') + '</td>' +
        '<td class="admin-td-action td-action">' + delBtn + '</td>';
      tbody.appendChild(tr);
      if (adminCards) {
        var card = document.createElement('div');
        card.className = 'admin-card-item' + (isYes ? ' admin-card-yes' : ' admin-card-no');
        card.innerHTML =
          '<div class="admin-card-name">' + escapeHtml(r.name || '') + '</div>' +
          '<div class="admin-card-row"><span class="admin-card-label">Datum</span><span class="admin-card-value">' + escapeHtml(formatDate(r.created_at)) + '</span></div>' +
          '<div class="admin-card-row"><span class="admin-card-label">Status</span><span class="admin-card-value">' + (isYes ? 'Ja' : 'Nein') + '</span></div>' +
          (r.contact ? '<div class="admin-card-row"><span class="admin-card-label">Kontakt</span><span class="admin-card-value">' + escapeHtml(r.contact) + '</span></div>' : '') +
          (isYes ? '<div class="admin-card-row"><span class="admin-card-label">Gäste</span><span class="admin-card-value">' + (r.total_guests != null ? r.total_guests : dash) + '</span></div>' : '') +
          (isYes ? '<div class="admin-card-row"><span class="admin-card-label">Fleisch / Vegi / Kinder</span><span class="admin-card-value">' + (r.menu_meat != null ? r.menu_meat : dash) + ' / ' + (r.menu_vegi != null ? r.menu_vegi : dash) + ' / ' + (r.menu_kids != null ? r.menu_kids : dash) + '</span></div>' : '') +
          (r.allergies_has && r.allergies_text ? '<div class="admin-card-row"><span class="admin-card-label">Allergien</span><span class="admin-card-value">' + escapeHtml(r.allergies_text) + '</span></div>' : '') +
          '<div class="admin-card-actions">' + delBtn + '</div>';
        adminCards.appendChild(card);
      }
    }
    tbody.querySelectorAll('.btn-delete').forEach(function (btn) {
      btn.addEventListener('click', function () { deleteRsvp(parseInt(btn.getAttribute('data-id'), 10), btn); });
    });
    if (adminCards) {
      adminCards.querySelectorAll('.btn-delete').forEach(function (btn) {
        btn.addEventListener('click', function () { deleteRsvp(parseInt(btn.getAttribute('data-id'), 10), btn); });
      });
    }
  }

  function applyFiltersAndRender() {
    computeSums(allRsvps);
    var filtered = filterRows();
    renderTable(filtered);
  }

  function doLoadWithToken(token) {
    if (!token) return;
    currentToken = token;
    setStoredToken(token);
    updateDownloadLinks();
    loginBtn.disabled = true;
    setStatus('Lade…');

    var url = '/api/admin/rsvps?token=' + encodeURIComponent(token);
    fetch(url)
      .then(function (res) {
        if (res.status === 401) {
          setStatus('Sitzung abgelaufen. Bitte erneut anmelden.', 'error');
          currentToken = '';
          setStoredToken('');
          updateDownloadLinks();
          if (adminLoginSection) adminLoginSection.classList.remove('hidden');
          if (adminContent) adminContent.classList.add('hidden');
          return null;
        }
        return res.json();
      })
      .then(function (data) {
        loginBtn.disabled = false;
        if (!data) return;
        if (data.ok && Array.isArray(data.rsvps)) {
          allRsvps = data.rsvps;
          setStatus('');
          if (adminLoginSection) adminLoginSection.classList.add('hidden');
          if (adminContent) {
            adminContent.classList.remove('hidden');
            adminContent.setAttribute('aria-hidden', 'false');
          }
          applyFiltersAndRender();
          loadTischplan();
        } else {
          setStatus('Ungültige Antwort vom Server.', 'error');
        }
      })
      .catch(function () {
        loginBtn.disabled = false;
        setStatus('Server nicht erreichbar.', 'error');
      });
  }

  function doLogin() {
    var password = (passwordInput.value || '').trim();
    if (!password) {
      setStatus('Bitte Passwort eingeben.', 'error');
      return;
    }
    loginBtn.disabled = true;
    setStatus('Anmelden…');

    fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: password })
    })
      .then(function (res) {
        if (res.status === 401) {
          setStatus('Falsches Passwort.', 'error');
          loginBtn.disabled = false;
          return null;
        }
        return res.json();
      })
      .then(function (data) {
        if (!data) return;
        if (data.ok && data.token) {
          setStatus('Angemeldet.');
          doLoadWithToken(data.token);
        } else {
          setStatus('Anmeldung fehlgeschlagen.', 'error');
          loginBtn.disabled = false;
        }
      })
      .catch(function () {
        setStatus('Server nicht erreichbar.', 'error');
        loginBtn.disabled = false;
      });
  }

  /* Kein Auto-Load: Inhalt nur nach Passworteingabe anzeigen, keine Session aus localStorage */
  currentToken = '';
  setStoredToken('');
  updateDownloadLinks();

  loginBtn.addEventListener('click', doLogin);
  passwordInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      doLogin();
    }
  });

  filterStatus.addEventListener('change', applyFiltersAndRender);
  filterAllergies.addEventListener('change', applyFiltersAndRender);
  filterSearch.addEventListener('input', applyFiltersAndRender);

  pdfLink.addEventListener('click', function (e) {
    if (pdfLink.getAttribute('aria-disabled') === 'true') e.preventDefault();
  });

  /* ========== Tabs ========== */
  var adminWrap = document.querySelector('.admin-wrap');
  function showPanel(name) {
    if (name === 'rsvp') {
      tabRsvp.classList.add('active');
      tabRsvp.setAttribute('aria-selected', 'true');
      tabTischplan.classList.remove('active');
      tabTischplan.setAttribute('aria-selected', 'false');
      if (panelRsvp) panelRsvp.classList.remove('hidden');
      if (panelTischplan) panelTischplan.classList.add('hidden');
      if (adminWrap) adminWrap.classList.remove('tischplan-fullwidth');
    } else {
      tabTischplan.classList.add('active');
      tabTischplan.setAttribute('aria-selected', 'true');
      tabRsvp.classList.remove('active');
      tabRsvp.setAttribute('aria-selected', 'false');
      if (panelTischplan) panelTischplan.classList.remove('hidden');
      if (panelRsvp) panelRsvp.classList.add('hidden');
      if (adminWrap) adminWrap.classList.add('tischplan-fullwidth');
      loadTischplan();
      renderTischplan();
    }
  }
  if (tabRsvp) tabRsvp.addEventListener('click', function () { showPanel('rsvp'); });
  if (tabTischplan) tabTischplan.addEventListener('click', function () { showPanel('tischplan'); });

  /* ========== Tischplan ========== */
  var tischplanSaveBtn = document.getElementById('tischplan-save');
  var tischplanSaveStatus = document.getElementById('tischplan-save-status');
  var tischplanTableName = document.getElementById('tischplan-table-name');
  var tischplanTableCapacity = document.getElementById('tischplan-table-capacity');
  var tischplanAddBtn = document.getElementById('tischplan-add-btn');
  var tischplanTablesContainer = document.getElementById('tischplan-tables-container');
  var tischplanFloorInner = document.getElementById('tischplan-floor-inner');
  var tischplanGuestsList = document.getElementById('tischplan-guests-list');
  var tischplanFloor = document.getElementById('tischplan-floor');
  var tischplanCateringGlobal = document.getElementById('tischplan-catering-global');
  var tischplanPrintBtn = document.getElementById('tischplan-print-catering');
  var tischplanHighlightVegi = document.getElementById('tischplan-highlight-vegi');
  var tischplanHighlightKind = document.getElementById('tischplan-highlight-kind');
  var tischplanHighlightAllergy = document.getElementById('tischplan-highlight-allergy');
  var tischplanAllergyPopover = document.getElementById('tischplan-allergy-popover');

  function getGuestCatering(r) {
    var meat = typeof r.menu_meat === 'number' ? r.menu_meat : (parseInt(r.menu_meat, 10) || 0);
    var vegi = typeof r.menu_vegi === 'number' ? r.menu_vegi : (parseInt(r.menu_vegi, 10) || 0);
    var kids = typeof r.menu_kids === 'number' ? r.menu_kids : (parseInt(r.menu_kids, 10) || 0);
    var hasAllergy = !!(r.allergies_has === 1 || r.allergies_has === true);
    var allergiesText = (r.allergies_text != null && String(r.allergies_text).trim()) ? String(r.allergies_text).trim() : '';
    return {
      menu_meat: meat,
      menu_vegi: vegi,
      menu_kids: kids,
      hasKids: kids > 0,
      hasVegi: vegi > 0,
      hasAllergy: hasAllergy,
      allergies_text: allergiesText
    };
  }

  function getPersonCatering(person) {
    if (person.menu_type != null || person.menu_meat !== undefined) {
      var meat = person.menu_meat != null ? (Number(person.menu_meat) || 0) : (person.menu_type === 'meat' ? 1 : 0);
      var vegi = person.menu_vegi != null ? (Number(person.menu_vegi) || 0) : (person.menu_type === 'vegi' ? 1 : 0);
      var kids = person.menu_kids != null ? (Number(person.menu_kids) || 0) : (person.menu_type === 'kids' ? 1 : 0);
      var hasAllergy = !!(person.allergies_has === 1 || person.allergies_has === true);
      var allergiesText = (person.allergies_text != null && String(person.allergies_text).trim()) ? String(person.allergies_text).trim() : '';
      return {
        menu_meat: meat,
        menu_vegi: vegi,
        menu_kids: kids,
        hasKids: kids > 0,
        hasVegi: vegi > 0,
        hasAllergy: hasAllergy,
        allergies_text: allergiesText
      };
    }
    return getGuestCatering(person.rsvp);
  }

  function getCateringSumsForTable(tableId) {
    var persons = getTischplanPersons();
    var meat = 0, vegi = 0, kids = 0, allergyCount = 0;
    for (var i = 0; i < persons.length; i++) {
      if (getAssignment(persons[i].rsvpId, persons[i].guestIndex) !== tableId) continue;
      var c = getPersonCatering(persons[i]);
      meat += c.menu_meat;
      vegi += c.menu_vegi;
      kids += c.menu_kids;
      if (c.hasAllergy) allergyCount++;
    }
    return { meat: meat, vegi: vegi, kids: kids, allergyCount: allergyCount };
  }

  function getCateringTotals() {
    var yesGuests = getYesGuests();
    var persons = getTischplanPersons();
    var zusagen = yesGuests.length;
    var totalGuests = persons.length;
    var meat = 0, vegi = 0, kids = 0, allergyCount = 0;
    for (var i = 0; i < persons.length; i++) {
      var c = getPersonCatering(persons[i]);
      meat += c.menu_meat;
      vegi += c.menu_vegi;
      kids += c.menu_kids;
      if (c.hasAllergy) allergyCount++;
    }
    var assignedPersonCount = 0;
    var a = tischplanPlan.assignments;
    for (var k in a) if (a[k]) assignedPersonCount++;
    return {
      zusagen: zusagen,
      totalGuests: totalGuests,
      meat: meat,
      vegi: vegi,
      kids: kids,
      allergyCount: allergyCount,
      assigned: assignedPersonCount,
      unassigned: persons.length - assignedPersonCount
    };
  }

  function getHighlightState() {
    return {
      vegi: tischplanHighlightVegi && tischplanHighlightVegi.checked,
      kind: tischplanHighlightKind && tischplanHighlightKind.checked,
      allergy: tischplanHighlightAllergy && tischplanHighlightAllergy.checked
    };
  }

  function buildPersonChipHtml(person, opts) {
    opts = opts || {};
    var label = escapeHtml(person.displayName);
    var chipClasses = 'tischplan-chip tischplan-chip-person';
    var badgesHtml = '';
    var c = person.rsvp ? getPersonCatering(person) : null;
    if (opts.sidebar && person.rsvp && c) {
      var hl = getHighlightState();
      if (hl.vegi && c.hasVegi) chipClasses += ' highlight-vegi';
      if (hl.kind && c.hasKids) chipClasses += ' highlight-kind';
      if (hl.allergy && c.hasAllergy) chipClasses += ' highlight-allergy';
      var badges = [];
      if (c.menu_meat > 0) badges.push('<span class="badge badge-meat">F ' + c.menu_meat + '</span>');
      if (c.menu_vegi > 0) badges.push('<span class="badge badge-vegi">V ' + c.menu_vegi + '</span>');
      if (c.menu_kids > 0) badges.push('<span class="badge badge-kids">K ' + c.menu_kids + '</span>');
      if (c.hasAllergy) {
        var allergyTitle = c.allergies_text ? escapeHtml(c.allergies_text) : 'Allergie';
        badges.push('<span class="badge badge-allergy" title="' + allergyTitle + '" data-allergy-text="' + escapeHtml(c.allergies_text) + '" role="button" tabindex="0">!</span>');
      }
      if (badges.length) badgesHtml = '<span class="tischplan-chip-badges">' + badges.join('') + '</span>';
    }
    var printInfoHtml = '';
    if (c) {
      var menuLabel = '';
      if (c.menu_meat > 0) menuLabel = 'Fleisch';
      else if (c.menu_vegi > 0) menuLabel = 'Vegetarisch';
      else if (c.menu_kids > 0) menuLabel = 'Kinder';
      else menuLabel = '—';
      var allergyPart = c.hasAllergy && c.allergies_text ? ' – Allergie: ' + escapeHtml(c.allergies_text) : '';
      printInfoHtml = '<span class="tischplan-chip-print-info"> (' + menuLabel + ')' + allergyPart + '</span>';
    }
    var btnHtml = '';
    if (opts.umsetzen) {
      btnHtml = '<button type="button" class="tischplan-guest-umsetzen chip-remove" data-rsvp-id="' + escapeHtml(person.rsvpId) + '" data-guest-index="' + person.guestIndex + '" title="Zurück in die Liste">×</button>';
    } else if (opts.floor) {
      btnHtml = '<button type="button" class="tischplan-floor-unassign chip-remove" data-rsvp-id="' + escapeHtml(person.rsvpId) + '" data-guest-index="' + person.guestIndex + '" title="Zurück in die Liste" aria-label="Umsetzen">×</button>';
    }
    return '<span class="' + chipClasses + '">' +
      '<span class="tischplan-chip-name">' + label + '</span>' +
      printInfoHtml +
      badgesHtml +
      btnHtml +
    '</span>';
  }

  function buildChipHtml(guest, opts) {
    opts = opts || {};
    var c = getGuestCatering(guest);
    var nameLabel = escapeHtml(guest.name || '') + (guest.total_guests > 1 ? ' (' + guest.total_guests + ')' : '');
    var hl = getHighlightState();
    var chipClasses = 'tischplan-chip';
    if (hl.vegi && c.hasVegi) chipClasses += ' highlight-vegi';
    if (hl.kind && c.hasKids) chipClasses += ' highlight-kind';
    if (hl.allergy && c.hasAllergy) chipClasses += ' highlight-allergy';
    var badges = [];
    if (c.menu_meat > 0) badges.push('<span class="badge badge-meat">F ' + c.menu_meat + '</span>');
    if (c.menu_vegi > 0) badges.push('<span class="badge badge-vegi">V ' + c.menu_vegi + '</span>');
    if (c.menu_kids > 0) badges.push('<span class="badge badge-kids">K ' + c.menu_kids + '</span>');
    if (c.hasAllergy) {
      var allergyTitle = c.allergies_text ? escapeHtml(c.allergies_text) : 'Allergie';
      badges.push('<span class="badge badge-allergy" title="' + allergyTitle + '" data-allergy-text="' + escapeHtml(c.allergies_text) + '" role="button" tabindex="0">!</span>');
    }
    var badgesHtml = badges.length ? '<span class="tischplan-chip-badges">' + badges.join('') + '</span>' : '';
    var btnHtml = '';
    if (opts.umsetzen) {
      btnHtml = '<button type="button" class="tischplan-guest-umsetzen chip-remove" data-rsvp-id="' + escapeHtml(String(guest.id)) + '" data-guest-index="0" title="Zurück in die Liste setzen">×</button>';
    } else if (opts.floor) {
      btnHtml = '<button type="button" class="tischplan-floor-unassign chip-remove" data-rsvp-id="' + escapeHtml(String(guest.id)) + '" data-guest-index="0" title="Zurück in die Liste" aria-label="Umsetzen">×</button>';
    }
    return '<span class="' + chipClasses + '">' +
      '<span class="tischplan-chip-name">' + nameLabel + '</span>' +
      badgesHtml +
      btnHtml +
    '</span>';
  }

  function renderCateringGlobal() {
    if (!tischplanCateringGlobal) return;
    var tot = getCateringTotals();
    var warn = tot.unassigned > 0 ? '<p class="tischplan-catering-warn">Noch ' + tot.unassigned + ' Person(en) ohne Tischzuweisung.</p>' : '';
    tischplanCateringGlobal.innerHTML =
      '<div class="tischplan-catering-global-inner">' +
        '<h4 class="tischplan-catering-global-title">Catering Gesamt</h4>' +
        '<div class="tischplan-catering-global-row">' +
          '<span>Zusagen: ' + tot.zusagen + '</span>' +
          '<span>Gäste gesamt: ' + tot.totalGuests + '</span>' +
          '<span>F ' + tot.meat + ' · V ' + tot.vegi + ' · K ' + tot.kids + '</span>' +
          '<span>Allergien: ' + tot.allergyCount + '</span>' +
        '</div>' +
        '<div class="tischplan-catering-global-row tischplan-catering-assigned">' +
          'Im Plan zugewiesen: ' + tot.assigned + ' / ' + (tot.assigned + tot.unassigned) + ' Person(en)' +
          (tot.unassigned > 0 ? '' : '') +
        '</div>' +
        warn +
      '</div>';
  }

  function showAllergyPopover(text, anchorEl) {
    if (!tischplanAllergyPopover) return;
    var textEl = tischplanAllergyPopover.querySelector('.tischplan-allergy-popover-text');
    if (textEl) textEl.textContent = text || 'Allergie vermerkt';
    tischplanAllergyPopover.classList.remove('hidden');
    var rect = anchorEl ? anchorEl.getBoundingClientRect() : null;
    if (rect) {
      tischplanAllergyPopover.style.left = rect.left + 'px';
      tischplanAllergyPopover.style.top = (rect.bottom + 4) + 'px';
    }
  }

  function hideAllergyPopover() {
    if (tischplanAllergyPopover) tischplanAllergyPopover.classList.add('hidden');
  }

  function loadTischplan() {
    if (!currentToken) return;
    fetch('/api/admin/tischplan?token=' + encodeURIComponent(currentToken))
      .then(function (res) {
        if (res.status === 401) return null;
        return res.json();
      })
      .then(function (data) {
        if (data && data.ok && data.plan) {
          tischplanPlan.tables = Array.isArray(data.plan.tables) ? data.plan.tables : [];
          tischplanPlan.assignments = typeof data.plan.assignments === 'object' && data.plan.assignments ? data.plan.assignments : {};
        }
      })
      .catch(function () {});
  }

  function getYesGuests() {
    return allRsvps.filter(function (r) { return r.attending === 'yes'; });
  }

  function toInitials(name) {
    if (!name || !String(name).trim()) return '?';
    return String(name).trim().split(/\s+/).map(function (w) { return (w.charAt(0) || '').toUpperCase() + '.'; }).join(' ');
  }

  function getTischplanPersons() {
    var yesGuests = getYesGuests();
    var out = [];
    for (var i = 0; i < yesGuests.length; i++) {
      var r = yesGuests[i];
      if (Array.isArray(r.guest_details) && r.guest_details.length > 0) {
        for (var j = 0; j < r.guest_details.length; j++) {
          var g = r.guest_details[j];
          var mt = (g.menu_type || 'meat').toLowerCase();
          out.push({
            rsvp: r,
            rsvpId: String(r.id),
            guestIndex: j,
            displayName: (g.name || '').trim() || ('Gast ' + (j + 1)),
            initials: toInitials(g.name || ('Gast ' + (j + 1))),
            menu_type: mt,
            menu_meat: mt === 'meat' ? 1 : 0,
            menu_vegi: mt === 'vegi' ? 1 : 0,
            menu_kids: mt === 'kids' ? 1 : 0,
            allergies_has: (g.allergies_has === 1 || g.allergies_has === true) ? 1 : 0,
            allergies_text: (g.allergies_text != null) ? String(g.allergies_text).trim() : ''
          });
        }
      } else {
        var total = r.total_guests || 1;
        var names = [r.name || ''];
        if (Array.isArray(r.guest_names) && r.guest_names.length > 0) {
          names = names.concat(r.guest_names);
        }
        names = names.slice(0, total);
        while (names.length < total) names.push('Gast ' + (names.length + 1));
        for (var j = 0; j < names.length; j++) {
          out.push({
            rsvp: r,
            rsvpId: String(r.id),
            guestIndex: j,
            displayName: (names[j] || '').trim() || ('Gast ' + (j + 1)),
            initials: toInitials(names[j] || ('Gast ' + (j + 1)))
          });
        }
      }
    }
    return out;
  }

  function personKey(rsvpId, guestIndex) {
    return String(rsvpId) + ':' + Number(guestIndex);
  }

  function getAssignment(rsvpId, guestIndex) {
    var key = personKey(rsvpId, guestIndex);
    if (tischplanPlan.assignments[key] !== undefined) return tischplanPlan.assignments[key];
    if (Number(guestIndex) === 0 && tischplanPlan.assignments[String(rsvpId)] !== undefined) return tischplanPlan.assignments[String(rsvpId)];
    return undefined;
  }

  function setAssignment(rsvpId, guestIndex, tableId) {
    var key = personKey(rsvpId, guestIndex);
    tischplanPlan.assignments[key] = tableId;
    if (Number(guestIndex) === 0 && tischplanPlan.assignments[String(rsvpId)] !== undefined) delete tischplanPlan.assignments[String(rsvpId)];
  }

  function clearAssignment(rsvpId, guestIndex) {
    var key = personKey(rsvpId, guestIndex);
    delete tischplanPlan.assignments[key];
  }

  function getTableById(id) {
    for (var i = 0; i < tischplanPlan.tables.length; i++) {
      if (tischplanPlan.tables[i].id === id) return tischplanPlan.tables[i];
    }
    return null;
  }

  function getAssignedCount(tableId) {
    var count = 0;
    var a = tischplanPlan.assignments;
    for (var k in a) { if (a[k] === tableId) count++; }
    return count;
  }

  function renderTischplan() {
    if (!tischplanTablesContainer || !tischplanFloorInner || !tischplanGuestsList) return;

    renderCateringGlobal();
    tischplanTablesContainer.innerHTML = '';
    tischplanFloorInner.innerHTML = '';
    tischplanGuestsList.innerHTML = '';

    var tables = tischplanPlan.tables;
    var persons = getTischplanPersons();

    for (var i = 0; i < tables.length; i++) {
      var t = tables[i];
      if (t.shape === undefined) t.shape = 'rect';
      if (t.rotation === undefined) t.rotation = 0;
      var belegt = getAssignedCount(t.id);
      var catering = getCateringSumsForTable(t.id);
      var cateringLineClass = 'tischplan-table-catering';
      if (catering.meat === 0 && catering.vegi === 0 && catering.kids === 0 && catering.allergyCount === 0) cateringLineClass += ' tischplan-table-catering-empty';
      var cateringLineHtml = '<div class="' + cateringLineClass + '">' +
        'F ' + catering.meat + ' · V ' + catering.vegi + ' · K ' + catering.kids + ' · Allergien ' + catering.allergyCount +
        '</div>';
      var guestItemsHtml = [];
      for (var p = 0; p < persons.length; p++) {
        if (getAssignment(persons[p].rsvpId, persons[p].guestIndex) === t.id) {
          guestItemsHtml.push(
            '<div class="tischplan-table-guest-item">' +
              buildPersonChipHtml(persons[p], { umsetzen: true }) +
            '</div>'
          );
        }
      }
      var card = document.createElement('div');
      card.className = 'tischplan-table-card';
      card.innerHTML =
        '<div class="tischplan-table-card-header">' +
          '<span class="tischplan-table-name">' + escapeHtml(t.name) + '</span>' +
          '<button type="button" class="tischplan-table-delete" data-table-id="' + escapeHtml(t.id) + '" title="Tisch löschen">Löschen</button>' +
        '</div>' +
        '<div class="tischplan-table-meta">' + belegt + ' / ' + t.capacity + ' Plätze</div>' +
        cateringLineHtml +
        '<div class="tischplan-table-options">' +
          '<label class="tischplan-opt-label">Form</label>' +
          '<select class="tischplan-shape-select" data-table-id="' + escapeHtml(t.id) + '" aria-label="Tischform">' +
            '<option value="rect"' + (t.shape === 'rect' ? ' selected' : '') + '>Eckig</option>' +
            '<option value="round"' + (t.shape === 'round' ? ' selected' : '') + '>Rund</option>' +
          '</select>' +
          '<label class="tischplan-opt-label">Drehung</label>' +
          '<div class="tischplan-rotate-wrap">' +
            '<input type="number" class="tischplan-rotate-input" data-table-id="' + escapeHtml(t.id) + '" min="0" max="360" value="' + (t.rotation || 0) + '" aria-label="Drehung in Grad">' +
            '<span class="tischplan-rotate-unit">°</span>' +
          '</div>' +
        '</div>' +
        (guestItemsHtml.length ? '<div class="tischplan-table-guests">' + guestItemsHtml.join('') + '</div>' : '');
      tischplanTablesContainer.appendChild(card);
    }

    tischplanTablesContainer.querySelectorAll('.tischplan-guest-umsetzen').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var rsvpId = btn.getAttribute('data-rsvp-id');
        var gi = btn.getAttribute('data-guest-index');
        if (rsvpId != null) { clearAssignment(rsvpId, gi != null ? gi : 0); renderTischplan(); }
      });
    });

    tischplanTablesContainer.querySelectorAll('.tischplan-table-delete').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-table-id');
        tischplanPlan.tables = tischplanPlan.tables.filter(function (x) { return x.id !== id; });
        for (var k in tischplanPlan.assignments) {
          if (tischplanPlan.assignments[k] === id) delete tischplanPlan.assignments[k];
        }
        renderTischplan();
      });
    });
    tischplanTablesContainer.querySelectorAll('.tischplan-shape-select').forEach(function (sel) {
      sel.addEventListener('change', function () {
        var id = this.getAttribute('data-table-id');
        var tbl = getTableById(id);
        if (tbl) { tbl.shape = this.value; renderTischplan(); }
      });
    });
    tischplanTablesContainer.querySelectorAll('.tischplan-rotate-input').forEach(function (inp) {
      inp.addEventListener('change', function () {
        var id = this.getAttribute('data-table-id');
        var tbl = getTableById(id);
        var val = parseInt(this.value, 10);
        if (tbl && !Number.isNaN(val)) {
          tbl.rotation = Math.max(0, Math.min(360, val));
          this.value = tbl.rotation;
          renderTischplan();
        }
      });
    });

    for (var j = 0; j < tables.length; j++) {
      var tbl = tables[j];
      var box = document.createElement('div');
      box.className = 'tischplan-floor-table' + (tbl.shape === 'round' ? ' tischplan-floor-table-round' : '');
      box.setAttribute('data-table-id', tbl.id);
      box.style.left = (tbl.x || 0) + '%';
      box.style.top = (tbl.y || 0) + '%';
      box.style.transform = 'rotate(' + (tbl.rotation || 0) + 'deg)';
      var floorChipsHtml = [];
      for (var fp = 0; fp < persons.length; fp++) {
        if (getAssignment(persons[fp].rsvpId, persons[fp].guestIndex) === tbl.id) {
          floorChipsHtml.push(
            '<span class="tischplan-floor-name-chip">' + buildPersonChipHtml(persons[fp], { floor: true }) + '</span>'
          );
        }
      }
      box.innerHTML =
        '<span class="tischplan-floor-table-title">' + escapeHtml(tbl.name) + '</span>' +
        '<span class="tischplan-floor-table-capacity">' + tbl.capacity + ' Plätze</span>' +
        (floorChipsHtml.length ? '<div class="tischplan-floor-table-names">' + floorChipsHtml.join('') + '</div>' : '');
      tischplanFloorInner.appendChild(box);
      box.querySelectorAll('.tischplan-floor-unassign').forEach(function (btn) {
        btn.addEventListener('click', function (e) {
          e.preventDefault();
          e.stopPropagation();
          var rsvpId = btn.getAttribute('data-rsvp-id');
          var gi = btn.getAttribute('data-guest-index');
          if (rsvpId != null) { clearAssignment(rsvpId, gi != null ? gi : 0); renderTischplan(); }
        });
      });
      makeDraggable(box, tbl);
    }

    var unassignedPersons = persons.filter(function (p) { return !getAssignment(p.rsvpId, p.guestIndex); });
    if (unassignedPersons.length === 0 && persons.length > 0) {
      var allDone = document.createElement('p');
      allDone.className = 'tischplan-all-done';
      allDone.textContent = 'Alle Gäste sind einem Tisch zugewiesen.';
      tischplanGuestsList.appendChild(allDone);
    }
    for (var k = 0; k < unassignedPersons.length; k++) {
      var person = unassignedPersons[k];
      var row = document.createElement('div');
      row.className = 'tischplan-guest-row';
      var select = document.createElement('select');
      select.className = 'tischplan-guest-select';
      select.setAttribute('data-rsvp-id', person.rsvpId);
      select.setAttribute('data-guest-index', String(person.guestIndex));
      var opt0 = document.createElement('option');
      opt0.value = '';
      opt0.textContent = '— Tisch wählen —';
      select.appendChild(opt0);
      for (var ti = 0; ti < tables.length; ti++) {
        var o = document.createElement('option');
        o.value = tables[ti].id;
        o.textContent = tables[ti].name + ' (' + tables[ti].capacity + ' Plätze)';
        if (getAssignment(person.rsvpId, person.guestIndex) === tables[ti].id) o.selected = true;
        select.appendChild(o);
      }
      select.addEventListener('change', function () {
        var rsvpId = this.getAttribute('data-rsvp-id');
        var gi = this.getAttribute('data-guest-index');
        var val = this.value;
        if (val) setAssignment(rsvpId, gi != null ? gi : 0, val);
        else clearAssignment(rsvpId, gi != null ? gi : 0);
        renderTischplan();
      });
      row.innerHTML = '<span class="tischplan-guest-row-chip">' + buildPersonChipHtml(person, { sidebar: true }) + '</span>';
      row.appendChild(select);
      tischplanGuestsList.appendChild(row);
    }
  }

  function makeDraggable(el, table, floorRect) {
    var dragging = false;
    var startX, startY, startLeft, startTop;

    function pxToPct(px, total) {
      return Math.max(0, Math.min(100, (px / total) * 100));
    }

    function onMove(clientX, clientY) {
      if (!dragging || !tischplanFloor) return;
      var rect = tischplanFloor.getBoundingClientRect();
      var leftPx = startLeft + (clientX - startX);
      var topPx = startTop + (clientY - startY);
      var leftPct = pxToPct(leftPx, rect.width);
      var topPct = pxToPct(topPx, rect.height);
      el.style.left = leftPct + '%';
      el.style.top = topPct + '%';
      el.style.transform = 'rotate(' + (table.rotation || 0) + 'deg)';
      table.x = leftPct;
      table.y = topPct;
    }

    el.addEventListener('mousedown', function (e) {
      if (e.button !== 0) return;
      if (e.target.closest('button, .tischplan-chip-badges, .badge-allergy')) return;
      e.preventDefault();
      dragging = true;
      var rect = tischplanFloor.getBoundingClientRect();
      startX = e.clientX;
      startY = e.clientY;
      var leftPct = parseFloat(el.style.left) || 0;
      var topPct = parseFloat(el.style.top) || 0;
      startLeft = (leftPct / 100) * rect.width;
      startTop = (topPct / 100) * rect.height;
    });
    el.addEventListener('touchstart', function (e) {
      if (e.touches.length !== 1) return;
      if (e.target.closest('button, .tischplan-chip-badges, .badge-allergy')) return;
      e.preventDefault();
      dragging = true;
      var rect = tischplanFloor.getBoundingClientRect();
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      var leftPct = parseFloat(el.style.left) || 0;
      var topPct = parseFloat(el.style.top) || 0;
      startLeft = (leftPct / 100) * rect.width;
      startTop = (topPct / 100) * rect.height;
    }, { passive: false });

    document.addEventListener('mousemove', function (e) {
      if (dragging) onMove(e.clientX, e.clientY);
    });
    document.addEventListener('touchmove', function (e) {
      if (dragging && e.touches.length === 1) {
        e.preventDefault();
        onMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: false });
    document.addEventListener('mouseup', function () { dragging = false; });
    document.addEventListener('touchend', function () { dragging = false; });
  }

  if (tischplanAddBtn && tischplanTableName && tischplanTableCapacity) {
    tischplanAddBtn.addEventListener('click', function () {
      var name = (tischplanTableName.value || '').trim() || 'Tisch ' + (tischplanPlan.tables.length + 1);
      var cap = parseInt(tischplanTableCapacity.value, 10);
      if (Number.isNaN(cap) || cap < 1) cap = 8;
      var id = 't' + Date.now();
      tischplanPlan.tables.push({ id: id, name: name, capacity: cap, x: 10 + (tischplanPlan.tables.length * 12), y: 15, shape: 'rect', rotation: 0 });
      tischplanTableName.value = '';
      tischplanTableCapacity.value = '8';
      renderTischplan();
    });
  }

  if (tischplanSaveBtn && tischplanSaveStatus) {
    tischplanSaveBtn.addEventListener('click', function () {
      if (!currentToken) return;
      tischplanSaveBtn.disabled = true;
      tischplanSaveStatus.textContent = 'Speichern…';
      tischplanSaveStatus.className = 'tischplan-status';
      var assignmentsToSave = {};
      for (var key in tischplanPlan.assignments) {
        var tid = tischplanPlan.assignments[key];
        if (!tid) continue;
        var k = String(key).indexOf(':') >= 0 ? key : key + ':0';
        assignmentsToSave[k] = tid;
      }
      fetch('/api/admin/tischplan?token=' + encodeURIComponent(currentToken), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tables: tischplanPlan.tables, assignments: assignmentsToSave })
      })
        .then(function (res) {
          return res.json().then(function (data) {
            return { status: res.status, data: data };
          });
        })
        .then(function (result) {
          if (result.status === 200 && result.data.ok) {
            tischplanSaveStatus.textContent = 'Gespeichert.';
            tischplanSaveStatus.className = 'tischplan-status success';
          } else {
            tischplanSaveStatus.textContent = result.data.error || 'Fehler beim Speichern.';
            tischplanSaveStatus.className = 'tischplan-status error';
          }
        })
        .catch(function () {
          tischplanSaveStatus.textContent = 'Verbindungsfehler.';
          tischplanSaveStatus.className = 'tischplan-status error';
        })
        .finally(function () {
          tischplanSaveBtn.disabled = false;
        });
    });
  }

  if (panelTischplan) {
    panelTischplan.addEventListener('click', function (e) {
      var badge = e.target.closest('.badge-allergy');
      if (badge) {
        e.preventDefault();
        e.stopPropagation();
        var text = badge.getAttribute('data-allergy-text') || 'Allergie vermerkt';
        showAllergyPopover(text, badge);
      }
    });
    panelTischplan.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      var badge = e.target.closest('.badge-allergy');
      if (badge) {
        e.preventDefault();
        e.stopPropagation();
        var text = badge.getAttribute('data-allergy-text') || 'Allergie vermerkt';
        showAllergyPopover(text, badge);
      }
    });
  }

  if (tischplanHighlightVegi) tischplanHighlightVegi.addEventListener('change', renderTischplan);
  if (tischplanHighlightKind) tischplanHighlightKind.addEventListener('change', renderTischplan);
  if (tischplanHighlightAllergy) tischplanHighlightAllergy.addEventListener('change', renderTischplan);

  if (tischplanPrintBtn) {
    tischplanPrintBtn.addEventListener('click', function () {
      var wrap = document.querySelector('.admin-wrap');
      var body = document.body;
      if (wrap) wrap.classList.add('print-catering');
      if (body) body.classList.add('print-catering');
      window.print();
      if (wrap) wrap.classList.remove('print-catering');
      if (body) body.classList.remove('print-catering');
    });
  }

  if (tischplanAllergyPopover) {
    var closeBtn = tischplanAllergyPopover.querySelector('.tischplan-allergy-popover-close');
    if (closeBtn) closeBtn.addEventListener('click', hideAllergyPopover);
    document.addEventListener('click', function (e) {
      if (tischplanAllergyPopover && !tischplanAllergyPopover.classList.contains('hidden') &&
          !tischplanAllergyPopover.contains(e.target) && !e.target.closest('.badge-allergy')) {
        hideAllergyPopover();
      }
    });
  }

})();
