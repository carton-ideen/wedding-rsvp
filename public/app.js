(function () {
  'use strict';

  var form = document.getElementById('rsvp-form');
  var formStatus = document.getElementById('form-status');
  var guestsSection = document.getElementById('guests-section');
  var attendingYes = document.getElementById('attending-yes');
  var attendingNo = document.getElementById('attending-no');
  var guestDetailsContainer = document.getElementById('guest-details-container');

  (function sourceCreditOverlay() {
    var overlay = document.getElementById('source-credit-overlay');
    var closeBtn = document.getElementById('source-credit-close');
    if (!overlay) return;

    function show() {
      overlay.classList.add('is-open');
      overlay.setAttribute('aria-hidden', 'false');
    }
    function hide() {
      overlay.classList.remove('is-open');
      overlay.setAttribute('aria-hidden', 'true');
    }

    document.addEventListener('contextmenu', function (e) {
      e.preventDefault();
      show();
    });
    document.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'u') {
        e.preventDefault();
        show();
      }
    });
    if (closeBtn) closeBtn.addEventListener('click', hide);
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) hide();
    });
  })();

  var weddingDate = new Date(2026, 5, 6, 12, 0, 0);
  var countdownEls = {
    days: document.getElementById('countdown-days'),
    hours: document.getElementById('countdown-hours'),
    minutes: document.getElementById('countdown-minutes'),
    seconds: document.getElementById('countdown-seconds')
  };

  function updateCountdown() {
    var now = new Date();
    var diff = weddingDate - now;
    if (diff <= 0) {
      if (countdownEls.days) countdownEls.days.textContent = '0';
      if (countdownEls.hours) countdownEls.hours.textContent = '0';
      if (countdownEls.minutes) countdownEls.minutes.textContent = '0';
      if (countdownEls.seconds) countdownEls.seconds.textContent = '0';
      return;
    }
    var days = Math.floor(diff / (1000 * 60 * 60 * 24));
    var hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    var minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    var seconds = Math.floor((diff % (1000 * 60)) / 1000);
    if (countdownEls.days) countdownEls.days.textContent = days;
    if (countdownEls.hours) countdownEls.hours.textContent = hours;
    if (countdownEls.minutes) countdownEls.minutes.textContent = minutes;
    if (countdownEls.seconds) countdownEls.seconds.textContent = seconds;
  }

  if (countdownEls.days) {
    updateCountdown();
    setInterval(updateCountdown, 1000);
  }

  (function heroParallax() {
    var hero = document.querySelector('.hero');
    var heroBg = document.querySelector('.hero-bg');
    if (!hero || !heroBg) return;
    var ticking = false;
    function updateParallax() {
      var scrollY = window.scrollY || window.pageYOffset;
      var rate = 0.35;
      heroBg.style.transform = 'translate3d(-50%, ' + (scrollY * rate) + 'px, 0)';
      ticking = false;
    }
    function onScroll() {
      if (!ticking) {
        requestAnimationFrame(updateParallax);
        ticking = true;
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    updateParallax();
  })();

  function setStatus(message, type) {
    formStatus.textContent = message;
    formStatus.className = 'form-status' + (type ? ' ' + type : '');
    formStatus.setAttribute('aria-live', 'polite');
  }

  function clearErrors() {
    setStatus('');
    [].forEach.call(document.querySelectorAll('.field-error'), function (el) {
      el.textContent = '';
    });
  }

  function showError(id, msg) {
    var el = document.getElementById('error-' + id);
    if (el) el.textContent = msg;
  }

  function updateGuestDetailsContainer() {
    if (!guestDetailsContainer) return;
    var totalEl = document.getElementById('total_guests');
    var total = totalEl ? parseInt(totalEl.value, 10) : 0;
    if (!attendingYes.checked || Number.isNaN(total) || total < 1) {
      guestDetailsContainer.innerHTML = '';
      return;
    }
    guestDetailsContainer.innerHTML = '';
    for (var i = 0; i < total; i++) {
      var num = i + 1;
      var isFirst = (num === 1);
      var block = document.createElement('fieldset');
      block.className = 'guest-detail-block';
      block.innerHTML =
        '<legend class="guest-detail-legend">Gast ' + num + (isFirst ? ' (Hauptgast)' : '') + '</legend>' +
        (isFirst
          ? '<p class="guest-detail-name-hint">Name: wie oben eingetragen</p>'
          : '<div class="form-group"><label for="gd_name_' + num + '" class="form-label">Name <span class="required">*</span></label>' +
            '<input type="text" id="gd_name_' + num + '" class="form-input" placeholder="z. B. Max Müller" maxlength="200" autocomplete="name"></div>') +
        '<div class="form-group">' +
          '<span class="form-label">Menü <span class="required">*</span></span>' +
          '<div class="guest-menu-radios">' +
            '<label class="guest-menu-option"><input type="radio" name="gd_menu_' + num + '" value="meat" checked> Fleisch</label>' +
            '<label class="guest-menu-option"><input type="radio" name="gd_menu_' + num + '" value="vegi"> Vegetarisch</label>' +
            '<label class="guest-menu-option"><input type="radio" name="gd_menu_' + num + '" value="kids"> Kinder</label>' +
          '</div>' +
        '</div>' +
        '<div class="form-group">' +
          '<label class="form-checkbox-wrap">' +
            '<input type="checkbox" id="gd_allergy_' + num + '" class="form-checkbox gd-allergy-cb" data-num="' + num + '">' +
            '<span class="form-checkbox-label">Allergien / Unverträglichkeiten</span>' +
          '</label>' +
        '</div>' +
        '<div id="gd_allergy_text_wrap_' + num + '" class="form-group gd-allergy-text-wrap hidden">' +
          '<label for="gd_allergy_text_' + num + '" class="form-label">Beschreibung <span class="required">*</span></label>' +
          '<input type="text" id="gd_allergy_text_' + num + '" class="form-input" maxlength="500" placeholder="z. B. Nüsse, Gluten">' +
        '</div>';
      guestDetailsContainer.appendChild(block);
    }
    guestDetailsContainer.querySelectorAll('.gd-allergy-cb').forEach(function (cb) {
      cb.addEventListener('change', function () {
        var n = cb.getAttribute('data-num');
        var wrap = document.getElementById('gd_allergy_text_wrap_' + n);
        if (wrap) wrap.classList.toggle('hidden', !cb.checked);
      });
    });
  }

  function toggleGuests() {
    var show = attendingYes.checked;
    guestsSection.classList.toggle('hidden', !show);
    if (!show) {
      document.getElementById('total_guests').value = '';
      if (guestDetailsContainer) guestDetailsContainer.innerHTML = '';
    } else {
      updateGuestDetailsContainer();
    }
  }

  attendingYes.addEventListener('change', toggleGuests);
  attendingNo.addEventListener('change', toggleGuests);
  if (document.getElementById('total_guests')) {
    document.getElementById('total_guests').addEventListener('input', updateGuestDetailsContainer);
    document.getElementById('total_guests').addEventListener('change', updateGuestDetailsContainer);
  }

  toggleGuests();

  (function declineModal() {
    var btnDecline = document.getElementById('hero-btn-decline');
    var modal = document.getElementById('decline-modal');
    var btnYes = document.getElementById('decline-modal-yes');
    var btnNo = document.getElementById('decline-modal-no');
    var stepConfirm = document.getElementById('decline-step-confirm');
    var stepForm = document.getElementById('decline-step-form');
    var declineForm = document.getElementById('decline-form');
    var declineName = document.getElementById('decline-name');
    var declineFormCancel = document.getElementById('decline-form-cancel');
    var declineFormStatus = document.getElementById('decline-form-status');
    var errorDeclineName = document.getElementById('error-decline-name');

    function openModal() {
      if (!modal) return;
      stepConfirm.classList.remove('hidden');
      stepForm.classList.add('hidden');
      if (declineName) declineName.value = '';
      if (errorDeclineName) errorDeclineName.textContent = '';
      if (declineFormStatus) {
        declineFormStatus.textContent = '';
        declineFormStatus.className = 'modal-status';
      }
      modal.classList.add('is-open');
      modal.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
    }

    function closeModal() {
      if (!modal) return;
      modal.classList.remove('is-open');
      modal.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    }

    function showStepForm() {
      if (stepConfirm) stepConfirm.classList.add('hidden');
      if (stepForm) stepForm.classList.remove('hidden');
      if (declineName) declineName.focus();
    }

    function showStepConfirm() {
      if (stepForm) stepForm.classList.add('hidden');
      if (stepConfirm) stepConfirm.classList.remove('hidden');
    }

    if (btnDecline) {
      btnDecline.addEventListener('click', openModal);
    }
    if (btnNo) {
      btnNo.addEventListener('click', closeModal);
    }
    if (btnYes) {
      btnYes.addEventListener('click', showStepForm);
    }
    if (declineFormCancel) {
      declineFormCancel.addEventListener('click', function () {
        showStepConfirm();
      });
    }
    if (modal) {
      modal.addEventListener('click', function (e) {
        if (e.target === modal) closeModal();
      });
    }

    if (declineForm && declineName && declineFormStatus) {
      declineForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var name = (declineName.value || '').trim();
        if (errorDeclineName) errorDeclineName.textContent = '';
        declineFormStatus.textContent = '';
        declineFormStatus.className = 'modal-status';
        if (!name) {
          if (errorDeclineName) errorDeclineName.textContent = 'Bitte gib einen Namen ein.';
          return;
        }
        var btn = declineForm.querySelector('button[type="submit"]');
        btn.disabled = true;
        declineFormStatus.textContent = 'Wird gesendet …';
        fetch('/api/rsvp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: name, attending: 'no' })
        })
          .then(function (res) {
            return res.json().then(function (body) {
              return { status: res.status, body: body };
            });
          })
          .then(function (result) {
            if (result.body.ok) {
              declineFormStatus.textContent = 'Danke, deine Absage wurde gespeichert.';
              declineFormStatus.className = 'modal-status success';
              setTimeout(function () {
                closeModal();
                showStepConfirm();
              }, 1500);
            } else {
              declineFormStatus.textContent = result.body.error || 'Ein Fehler ist aufgetreten.';
              declineFormStatus.className = 'modal-status error';
            }
          })
          .catch(function () {
            declineFormStatus.textContent = 'Verbindungsfehler. Bitte später erneut versuchen.';
            declineFormStatus.className = 'modal-status error';
          })
          .finally(function () {
            btn.disabled = false;
          });
      });
    }
  })();

  function validate() {
    clearErrors();
    var name = (form.name.value || '').trim();
    if (!name) {
      showError('name', 'Bitte gib einen Namen ein.');
      return false;
    }
    var attending = form.attending.value;
    if (attending !== 'yes' && attending !== 'no') {
      showError('attending', 'Bitte wähle, ob du kommst oder nicht.');
      return false;
    }
    if (attending === 'yes') {
      var total = parseInt(form.total_guests.value, 10);
      if (Number.isNaN(total) || total < 1 || total > 20) {
        showError('total_guests', 'Anzahl Gäste muss zwischen 1 und 20 liegen.');
        return false;
      }
      for (var i = 1; i <= total; i++) {
        var nameVal = (i === 1) ? name : ((document.getElementById('gd_name_' + i) && document.getElementById('gd_name_' + i).value) || '').trim();
        if (!nameVal.length) {
          showError('guest_details', 'Bitte für jeden Gast einen Namen eintragen.');
          return false;
        }
        var menuChecked = form.querySelector('input[name="gd_menu_' + i + '"]:checked');
        if (!menuChecked) {
          showError('guest_details', 'Bitte für jeden Gast ein Menü wählen.');
          return false;
        }
        var allergyCb = document.getElementById('gd_allergy_' + i);
        var allergyText = document.getElementById('gd_allergy_text_' + i);
        if (allergyCb && allergyCb.checked && allergyText && (allergyText.value || '').trim().length < 2) {
          showError('guest_details', 'Bitte Allergien beschreiben (mind. 2 Zeichen), wenn angegeben.');
          return false;
        }
      }
    }
    return true;
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    clearErrors();
    if (!validate()) {
      setStatus('Bitte korrigiere die angezeigten Felder.', 'error');
      return;
    }

    var data = {
      name: (form.name.value || '').trim(),
      contact: (form.contact.value || '').trim(),
      attending: form.attending.value
    };
    if (data.attending === 'yes') {
      var total = parseInt(form.total_guests.value, 10);
      data.guest_details = [];
      for (var g = 1; g <= total; g++) {
        var gName = (g === 1) ? data.name : ((document.getElementById('gd_name_' + g) && document.getElementById('gd_name_' + g).value) || '').trim();
        var gMenu = form.querySelector('input[name="gd_menu_' + g + '"]:checked');
        var gAllergyCb = document.getElementById('gd_allergy_' + g);
        var gAllergyText = document.getElementById('gd_allergy_text_' + g);
        data.guest_details.push({
          name: gName,
          menu_type: gMenu ? gMenu.value : 'meat',
          allergies_has: (gAllergyCb && gAllergyCb.checked) ? 1 : 0,
          allergies_text: (gAllergyCb && gAllergyCb.checked && gAllergyText) ? (gAllergyText.value || '').trim() : ''
        });
      }
    }

    var btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    setStatus('Wird gesendet …');

    fetch('/api/rsvp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
      .then(function (res) {
        return res.json().then(function (body) {
          return { status: res.status, body: body };
        });
      })
      .then(function (result) {
        if (result.body.ok) {
          setStatus('Vielen Dank! Deine Rückmeldung wurde gespeichert.', 'success');
          form.reset();
          toggleGuests();
          updateGuestDetailsContainer();
        } else {
          setStatus(result.body.error || 'Ein Fehler ist aufgetreten.', 'error');
        }
      })
      .catch(function () {
        setStatus('Verbindungsfehler. Bitte später erneut versuchen.', 'error');
      })
      .finally(function () {
        btn.disabled = false;
      });
  });
})();
