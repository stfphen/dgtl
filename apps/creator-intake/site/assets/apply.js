/* DGTL Creator & Brand Intake — apply.html state machine.
   One application object ↔ localStorage ↔ POST /api/draft.php on step change.
   Uploads go browser → R2 via presigned PUT; magic-link resume rehydrates
   server-side state (server wins over localStorage when a token is present). */
(function () {
  'use strict';

  const API = {
    draft: 'api/draft.php',
    magic: 'api/magic-link.php',
    resume: 'api/resume.php',
    presign: 'api/presign.php',
    confirm: 'api/confirm-upload.php',
    removeMedia: 'api/delete-media.php',
    submit: 'api/submit.php',
  };
  const LS_KEY = 'dgtl_intake_draft_v1';
  const MAX_FILE = 200 * 1024 * 1024;
  const CATEGORIES = ['music', 'fashion', 'sport', 'food', 'tech', 'lifestyle', 'comedy', 'other'];
  const LOOKING_FOR = {
    brand_deals: 'Brand deals', editorial_coverage: 'Editorial coverage',
    podcast_guest: 'Podcast guest', broadcast: 'Broadcast', campaign_work: 'Campaign work',
    distribution: 'Distribution',
  };

  const state = {
    publicId: null,
    draftToken: null,
    payloadRev: 0,
    step: 1,
    app: { applicant_type: 'creator' },
    files: [],   // {mediaId, kind, name, size, mime, status, progress, meta:{}}
    dirty: false,
  };

  const $ = (sel, el) => (el || document).querySelector(sel);
  const $$ = (sel, el) => Array.prototype.slice.call((el || document).querySelectorAll(sel));
  const form = $('#apply-form');

  // ── step config ───────────────────────────────────────────────────────────
  const STEPS = [
    { n: 1, label: 'You', title: 'Who you are' },
    { n: 2, label: 'Work', title: 'What you do' },
    { n: 3, label: 'Socials', title: 'Socials & audience' },
    { n: 4, label: 'Media & rights', title: 'Media & rights' },
    { n: 5, label: 'Finish', title: 'Rates & closing' },
  ];
  const isCreator = () => state.app.applicant_type !== 'brand';

  // ── server I/O ────────────────────────────────────────────────────────────
  async function post(url, body) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    let data = null;
    try { data = await res.json(); } catch (e) { /* non-JSON error page */ }
    return { status: res.status, data: data || { ok: false, error: 'network' } };
  }

  function authBody(extra) {
    return Object.assign({ public_id: state.publicId, draft_token: state.draftToken }, extra);
  }

  // ── persistence ───────────────────────────────────────────────────────────
  let saveTimer = null;
  function persistLocal() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({
        publicId: state.publicId, draftToken: state.draftToken,
        payloadRev: state.payloadRev, step: state.step, app: state.app,
      }));
    } catch (e) { /* private mode */ }
  }
  function markDirty() {
    state.dirty = true;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(persistLocal, 300);
    setSaveNote('');
  }
  function setSaveNote(text, ok) {
    const el = $('#save-note');
    el.textContent = text;
    el.classList.toggle('saved', !!ok);
  }

  async function saveStep(step) {
    collectStep(step);
    persistLocal();
    const fields = fieldsForStep(step);
    if (!state.publicId) {
      const { status, data } = await post(API.draft, {
        step: step, hp_website: $('#hp-website').value, fields: fields,
      });
      if (status === 201 && data.ok) {
        state.publicId = data.public_id;
        state.draftToken = data.draft_token;
        state.payloadRev = data.payload_rev;
        persistLocal();
        setSaveNote('Saved — resume any time via email link', true);
        return { ok: true };
      }
      return { ok: false, status: status, data: data };
    }
    const { status, data } = await post(API.draft, authBody({
      step: step, base_rev: state.payloadRev, fields: fields,
    }));
    if (data.ok) {
      state.payloadRev = data.payload_rev;
      state.dirty = false;
      persistLocal();
      setSaveNote('Saved · just now', true);
      return { ok: true };
    }
    if (status === 409 && data.error === 'conflict') {
      // Edited elsewhere — server wins; rebase our unsaved step on top.
      state.payloadRev = data.server_rev;
      state.app = Object.assign({}, data.payload, fieldsForStep(step));
      renderAll();
      return saveStep(step);
    }
    return { ok: false, status: status, data: data };
  }

  // ── field collection (DOM → state) ────────────────────────────────────────
  function stepEl(n) { return $('.step[data-step="' + n + '"]'); }

  function collectStep(n) {
    const el = stepEl(n);
    $$('input[name], select[name], textarea[name]', el).forEach(function (input) {
      const name = input.name;
      if (name === 'hp_website' || name === 'social_primary') return;
      if (input.type === 'radio') {
        if (input.checked) {
          state.app[name] = input.value === 'yes' ? true
            : input.value === 'no' ? false : input.value;
        }
        return;
      }
      if (input.type === 'checkbox') { state.app[name] = input.checked; return; }
      if (input.type === 'number') {
        state.app[name] = input.value === '' ? null : Number(input.value);
        return;
      }
      state.app[name] = input.value;
    });

    if (n === 2) {
      state.app.secondary_categories = $$('#secondary-cats input:checked').map(i => i.value);
      state.app.looking_for = $$('#looking-for input:checked').map(i => i.value);
      state.app.career_highlights = collectRows('#highlights-list', r => r.value).filter(Boolean);
      state.app.notable_press = collectRows('#press-list', r => r).filter(r => r.url || r.outlet);
    }
    if (n === 3) {
      state.app.socials = $$('#socials-list .repeat-row').map(function (row) {
        return {
          platform: $('[data-k=platform]', row).value,
          handle: $('[data-k=handle]', row).value.trim(),
          profile_url: $('[data-k=profile_url]', row).value.trim(),
          follower_count: Number($('[data-k=follower_count]', row).value) || 0,
          verified: $('[data-k=verified]', row).checked,
          is_primary: $('[data-k=is_primary]', row).checked,
        };
      }).filter(r => r.handle || r.profile_url);
    }
    if (n === 4) {
      state.app.media_links = collectRows('#medialinks-list', r => r).filter(r => r.url);
    }
    if (n === 5 && isCreator()) {
      state.app.exclusivity_conflicts = collectRows('#conflicts-list', r => r.value).filter(Boolean);
    }
  }

  function collectRows(listSel, map) {
    return $$(listSel + ' .repeat-row').map(function (row) {
      const out = {};
      $$('[data-k]', row).forEach(function (input) {
        out[input.dataset.k] = input.type === 'checkbox' ? input.checked : input.value.trim();
      });
      return map(out);
    });
  }

  // Only the registry fields that belong to this step (and applicant type).
  const STEP_FIELDS = {
    1: ['applicant_type', 'legal_name', 'public_name', 'email', 'phone', 'city', 'country',
        'pronouns', 'entity_type', 'hst_gst_number'],
    2: ['primary_category', 'secondary_categories', 'bio_short', 'bio_long',
        'career_highlights', 'notable_press', 'looking_for'],
    3: ['socials', 'website_url', 'preferred_anchor_text', 'reciprocal_link_agreed',
        'epk_url', 'press_kit_url', 'avg_views_30d', 'avg_engagement_rate',
        'audience_top_geo', 'audience_age_bracket', 'audience_gender_split',
        'analytics_connect_later'],
    4: ['media_links', 'rights_confirmation', 'derivative_ok', 'broadcast_ok',
        'ai_training_optout', 'credit_line', 'signature_name', 'signature_date'],
    5: ['rate_ig_post', 'rate_ig_reel', 'rate_tiktok', 'rate_youtube_integration',
        'rate_ugc_package', 'rate_appearance', 'rate_day', 'currency', 'open_to_gifted',
        'exclusivity_conflicts', 'availability_window', 'booking_contact', 'manager_name',
        'manager_email', 'how_did_you_hear', 'referred_by', 'consent_marketing_email',
        'consent_survey_panel'],
  };
  const CREATOR_ONLY = ['pronouns', 'rate_ig_post', 'rate_ig_reel', 'rate_tiktok',
    'rate_youtube_integration', 'rate_ugc_package', 'rate_appearance', 'rate_day', 'currency',
    'open_to_gifted', 'exclusivity_conflicts', 'availability_window', 'booking_contact',
    'manager_name', 'manager_email'];

  function fieldsForStep(step) {
    const out = {};
    STEP_FIELDS[step].forEach(function (name) {
      if (!isCreator() && CREATOR_ONLY.indexOf(name) !== -1) return;
      if (name in state.app && state.app[name] !== undefined) {
        let v = state.app[name];
        if (v === null) v = '';
        out[name] = v;
      }
    });
    if (step === 1) out.applicant_type = state.app.applicant_type;
    return out;
  }

  // ── client validation ─────────────────────────────────────────────────────
  function validateStep(n) {
    const errors = [];
    const req = function (name, msg) {
      const v = state.app[name];
      if (v === undefined || v === null || v === '' ||
          (Array.isArray(v) && v.length === 0)) errors.push([name, msg]);
    };
    if (n === 1) {
      req('legal_name', 'Add your legal name.');
      req('public_name', isCreator() ? 'Add your stage or public name.' : 'Add the brand name.');
      req('email', 'Add your email.');
      if (state.app.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(state.app.email)) {
        errors.push(['email', 'That email doesn’t look right.']);
      }
      req('phone', 'Add a phone number.');
      req('city', 'Add your city.');
      req('country', 'Add your country.');
    }
    if (n === 2) {
      req('primary_category', 'Pick your main category.');
      req('bio_short', 'Give us the one-liner.');
      req('looking_for', 'Pick at least one thing you’re looking for.');
    }
    if (n === 3) {
      if (isCreator()) {
        if (!(state.app.socials || []).length) {
          errors.push(['socials', 'Add at least one platform.']);
        } else if ((state.app.socials || []).filter(s => s.is_primary).length !== 1) {
          errors.push(['socials', 'Mark one platform as primary.']);
        }
      } else {
        req('website_url', 'Add the company website.');
      }
    }
    if (n === 4) {
      const uploads = state.files.filter(f => f.kind === 'upload' && f.status === 'done').length;
      if (!uploads && !(state.app.media_links || []).length) {
        errors.push(['media_links', 'Upload at least one file or add a link.']);
      }
      if (state.files.some(f => f.status === 'uploading')) {
        errors.push(['media_files', 'Wait for uploads to finish (or remove them).']);
      }
      if (state.app.derivative_ok === undefined) errors.push(['derivative_ok', 'Choose yes or no on edits.']);
      if (state.app.broadcast_ok === undefined) errors.push(['broadcast_ok', 'Choose yes or no on broadcast.']);
      if (state.app.rights_confirmation !== true) {
        errors.push(['rights_confirmation', 'Confirm you own or control the rights.']);
      }
      req('credit_line', 'Tell us how to credit you.');
      req('signature_name', 'Type your name to sign.');
    }
    if (n === 5 && isCreator() && state.app.booking_contact === 'manager') {
      req('manager_email', 'Add your manager’s email.');
    }
    return errors;
  }

  function showErrors(n, errors) {
    const summary = $('.err-summary[data-for="' + n + '"]');
    $$('.f-row.invalid', stepEl(n)).forEach(el => el.classList.remove('invalid'));
    if (!errors.length) {
      summary.classList.remove('active');
      summary.textContent = '';
      return;
    }
    summary.innerHTML = errors.length + (errors.length === 1 ? ' field needs' : ' fields need')
      + ' attention: ' + errors.map(function (e) {
        return '<a href="#" data-jump="' + e[0] + '">' + e[1] + '</a>';
      }).join(' ');
    summary.classList.add('active');
    errors.forEach(function (e) {
      const row = $('.f-row[data-field="' + e[0] + '"]', stepEl(n));
      if (row) {
        row.classList.add('invalid');
        const msg = $('.f-error', row);
        if (msg) msg.textContent = e[1];
      }
    });
    summary.focus && summary.setAttribute('tabindex', '-1');
    summary.focus();
  }

  function applyServerErrors(n, fields) {
    const errors = Object.keys(fields || {}).map(k => [k, fields[k]]);
    if (errors.length) showErrors(n, errors);
    else showErrors(n, [['form', 'Something went wrong — try again.']]);
  }

  // ── navigation ────────────────────────────────────────────────────────────
  function visibleSteps() {
    return STEPS.map(s => s.n);
  }

  function renderStepNav() {
    const nav = $('#step-nav');
    nav.innerHTML = '';
    const steps = visibleSteps();
    steps.forEach(function (n, i) {
      const li = document.createElement('li');
      const conf = STEPS.find(s => s.n === n);
      const label = (n === 5 && !isCreator()) ? 'Finish' : conf.label;
      if (n === state.step) li.setAttribute('aria-current', 'step');
      if (n < state.step) li.classList.add('done');
      if (n > state.step) li.classList.add('locked');
      li.innerHTML = '<button type="button" data-nav="' + n + '"' +
        (n > state.step ? ' aria-disabled="true"' : '') + '>' +
        '<span class="dot">' + (n < state.step ? '✓' : (i + 1)) + '</span>' +
        '<span class="lbl">' + label + '</span></button>' +
        (i < steps.length - 1 ? '<span class="line" aria-hidden="true"></span>' : '');
      nav.appendChild(li);
    });
    const conf = STEPS.find(s => s.n === state.step);
    $('#step-count').textContent =
      'Step ' + (steps.indexOf(state.step) + 1) + ' of ' + steps.length + ' — ' + conf.title;
  }

  async function goTo(n, opts) {
    opts = opts || {};
    if (!opts.skipValidate && n > state.step) {
      collectStep(state.step);
      const errors = validateStep(state.step);
      if (errors.length) { showErrors(state.step, errors); return; }
      showErrors(state.step, []);
      setSaveNote('Saving…');
      const saved = await saveStep(state.step);
      if (!saved.ok) {
        if (saved.data && saved.data.fields) applyServerErrors(state.step, saved.data.fields);
        else showErrors(state.step, [['form',
          'Couldn’t save — check your connection and try again.']]);
        setSaveNote('Not saved', false);
        return;
      }
    } else if (!opts.skipValidate && n < state.step) {
      collectStep(state.step);
      persistLocal();
      if (state.publicId) saveStep(state.step); // fire and forget going backwards
    }
    state.step = n;
    $$('.step', form).forEach(function (el) {
      el.hidden = Number(el.dataset.step) !== n;
    });
    renderStepNav();
    updateTypeUI();
    if (n === 5) renderRecap();
    $('#btn-back').hidden = n === visibleSteps()[0];
    $('#btn-next').textContent = n === 5 ? 'Submit application' : 'Continue →';
    if (!opts.noFocus) {
      const h = $('h2', stepEl(n));
      h && h.focus();
      window.scrollTo({ top: 0 });
    }
    persistLocal();
  }

  // ── applicant-type dependent UI ───────────────────────────────────────────
  function updateTypeUI() {
    const creator = isCreator();
    $$('[data-who]').forEach(function (el) {
      el.hidden = (el.dataset.who === 'creator') !== creator;
    });
    $$('[data-creator]').forEach(function (el) {
      const v = creator ? el.dataset.creator : el.dataset.brand;
      if (v) el.innerHTML = v;
    });
    const mgr = state.app.booking_contact === 'manager';
    $$('[data-manager]').forEach(el => { el.hidden = !creator || !mgr; });
  }

  function renderRecap() {
    const yn = v => v === true ? 'yes' : v === false ? 'no' : '—';
    $('#recap-derivative').textContent = yn(state.app.derivative_ok);
    $('#recap-broadcast').textContent = yn(state.app.broadcast_ok);
    $('#recap-ai').textContent = state.app.ai_training_optout === false ? 'off' : 'on';
  }

  // ── repeatable rows ───────────────────────────────────────────────────────
  const REPEATS = {
    highlights: { list: '#highlights-list', tpl: '#tpl-highlight', max: 10 },
    press: { list: '#press-list', tpl: '#tpl-press', max: 10 },
    socials: { list: '#socials-list', tpl: '#tpl-social', max: 13 },
    medialinks: { list: '#medialinks-list', tpl: '#tpl-medialink', max: 10 },
    conflicts: { list: '#conflicts-list', tpl: '#tpl-conflict', max: 20 },
  };

  function addRow(kind, values) {
    const conf = REPEATS[kind];
    const list = $(conf.list);
    if (list.children.length >= conf.max) return null;
    const row = $(conf.tpl).content.firstElementChild.cloneNode(true);
    if (values) {
      $$('[data-k]', row).forEach(function (input) {
        const v = values[input.dataset.k];
        if (input.type === 'checkbox' || input.type === 'radio') input.checked = !!v;
        else if (v !== undefined && v !== null) input.value = v;
      });
    }
    list.appendChild(row);
    return row;
  }

  // ── uploads ───────────────────────────────────────────────────────────────
  function fmtSize(b) {
    if (b > 1024 * 1024) return (b / 1024 / 1024).toFixed(1) + ' MB';
    return Math.max(1, Math.round(b / 1024)) + ' KB';
  }

  function fileRowFor(f) {
    return $$('#' + (f.kind === 'upload' ? 'media' : 'shots') + '-files .file-row')
      .find(row => Number(row.dataset.mediaId || 0) === f.mediaId || row.__file === f);
  }

  function renderFileRow(f) {
    const listEl = $(f.kind === 'upload' ? '#media-files' : '#shots-files');
    let row = fileRowFor(f);
    if (!row) {
      row = $('#tpl-file-row').content.firstElementChild.cloneNode(true);
      row.__file = f;
      if (f.kind !== 'upload') $('.meta', row).remove(); // screenshots need no credits
      listEl.appendChild(row);
      $$('[data-k]', row).forEach(function (input) {
        input.addEventListener('change', function () {
          f.meta[input.dataset.k] = input.type === 'checkbox' ? input.checked : input.value;
          if (f.status === 'done') confirmUpload(f); // push metadata updates
        });
      });
      $('.rm', row).addEventListener('click', async function () {
        if (f.mediaId && state.publicId) {
          post(API.removeMedia, authBody({ media_id: f.mediaId }));
        }
        state.files = state.files.filter(x => x !== f);
        row.remove();
      });
      $('.retry', row).addEventListener('click', function () { startUpload(f); });
    }
    if (f.mediaId) row.dataset.mediaId = f.mediaId;
    $('.name', row).textContent = f.name;
    $('.size', row).textContent = f.size ? fmtSize(f.size) : '';
    $('.bar i', row).style.width = (f.status === 'done' ? 100 : f.progress || 0) + '%';
    row.classList.toggle('done', f.status === 'done');
    row.classList.toggle('failed', f.status === 'failed');
    $('.retry', row).hidden = f.status !== 'failed';
    if (f.meta) {
      $$('[data-k]', row).forEach(function (input) {
        const v = f.meta[input.dataset.k];
        if (v === undefined) return;
        if (input.type === 'checkbox') input.checked = !!v;
        else if (document.activeElement !== input) input.value = v;
      });
    }
  }

  async function handleFiles(kind, fileList) {
    if (!state.publicId) {
      // Uploads need a draft — create it from whatever step 1 holds now.
      collectStep(1);
      const errs = validateStep(1);
      if (errs.length) {
        await goTo(1, { skipValidate: true });
        showErrors(1, errs.concat([['email', 'Finish this step before uploading files.']]));
        return;
      }
      const saved = await saveStep(1);
      if (!saved.ok) return;
    }
    Array.prototype.slice.call(fileList).forEach(function (file) {
      if (file.size > MAX_FILE) {
        alertRow(kind, file.name + ' is over 200MB — trim it or share a link instead.');
        return;
      }
      const f = {
        kind: kind, name: file.name, size: file.size,
        mime: file.type || 'application/octet-stream',
        status: 'pending', progress: 0, meta: { title: file.name, is_owner: true },
        blob: file, mediaId: null,
      };
      state.files.push(f);
      renderFileRow(f);
      startUpload(f);
    });
  }

  function alertRow(kind, msg) {
    const rowSel = kind === 'upload' ? '[data-field="media_files"]' : '[data-field="analytics_screenshots"]';
    const row = $(rowSel);
    row.classList.add('invalid');
    const err = $('.f-error', row);
    if (err) err.textContent = msg;
  }

  async function startUpload(f) {
    f.status = 'uploading'; f.progress = 0; renderFileRow(f);
    const { data } = await post(API.presign, authBody({
      kind: f.kind === 'upload' ? 'upload' : 'analytics_screenshot',
      filename: f.name, mime: f.mime, bytes: f.size,
    }));
    if (!data.ok) {
      f.status = 'failed'; renderFileRow(f);
      alertRow(f.kind, data.message || 'Couldn’t start the upload.');
      return;
    }
    f.mediaId = data.media_id;
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', data.upload_url);
    xhr.setRequestHeader('Content-Type', data.headers['Content-Type']);
    xhr.upload.onprogress = function (e) {
      if (e.lengthComputable) {
        f.progress = Math.round((e.loaded / e.total) * 100);
        renderFileRow(f);
      }
    };
    xhr.onerror = xhr.onabort = function () { f.status = 'failed'; renderFileRow(f); };
    xhr.onload = function () {
      if (xhr.status === 200) confirmUpload(f, true);
      else { f.status = 'failed'; renderFileRow(f); }
    };
    xhr.send(f.blob);
  }

  async function confirmUpload(f, first) {
    const { data } = await post(API.confirm, authBody(Object.assign(
      { media_id: f.mediaId }, f.meta
    )));
    if (data.ok) {
      if (first) { f.status = 'done'; f.blob = null; }
    } else if (first) {
      f.status = 'failed';
      alertRow(f.kind, data.message || 'Upload verification failed — retry.');
    }
    renderFileRow(f);
  }

  // ── hydration (state → DOM) ───────────────────────────────────────────────
  function renderAll() {
    const a = state.app;
    $$('input[name], select[name], textarea[name]', form).forEach(function (input) {
      const name = input.name;
      if (!(name in a) || name === 'hp_website') return;
      const v = a[name];
      if (input.type === 'radio') {
        input.checked = (v === true && input.value === 'yes')
          || (v === false && input.value === 'no') || input.value === v;
      } else if (input.type === 'checkbox') {
        input.checked = !!v;
      } else if (v !== null && v !== undefined) {
        input.value = v;
      }
    });
    // chips
    $('#secondary-cats').innerHTML = CATEGORIES.map(c =>
      '<label class="fpill" style="display:inline-flex;gap:6px;align-items:center">' +
      '<input type="checkbox" value="' + c + '"' +
      ((a.secondary_categories || []).indexOf(c) !== -1 ? ' checked' : '') + '> ' +
      c.charAt(0).toUpperCase() + c.slice(1) + '</label>').join('');
    $('#looking-for').innerHTML = Object.keys(LOOKING_FOR).map(k =>
      '<label class="fpill" style="display:inline-flex;gap:6px;align-items:center">' +
      '<input type="checkbox" value="' + k + '"' +
      ((a.looking_for || []).indexOf(k) !== -1 ? ' checked' : '') + '> ' +
      LOOKING_FOR[k] + '</label>').join('');
    // repeatables
    $('#highlights-list').innerHTML = '';
    (a.career_highlights || []).forEach(v => addRow('highlights', { value: v }));
    $('#press-list').innerHTML = '';
    (a.notable_press || []).forEach(v => addRow('press', v));
    $('#socials-list').innerHTML = '';
    (a.socials || []).forEach(v => addRow('socials', v));
    if (!(a.socials || []).length) addRow('socials', { is_primary: true });
    $('#medialinks-list').innerHTML = '';
    (a.media_links || []).forEach(v => addRow('medialinks', v));
    $('#conflicts-list').innerHTML = '';
    (a.exclusivity_conflicts || []).forEach(v => addRow('conflicts', { value: v }));
    // signature date + defaults
    const today = new Date().toISOString().slice(0, 10);
    $('#f-signature_date').value = a.signature_date || today;
    a.signature_date = $('#f-signature_date').value;
    if (a.ai_training_optout === undefined) a.ai_training_optout = true;
    $('input[name=ai_training_optout]', form).checked = a.ai_training_optout;
    updateTypeUI();
    updateCounts();
  }

  function updateCounts() {
    [['bio_short', 160], ['bio_long', 900]].forEach(function (pair) {
      const input = $('#f-' + pair[0]);
      const count = $('#' + pair[0] + '-count');
      if (!input || !count) return;
      count.textContent = input.value.length + ' / ' + pair[1];
      count.classList.toggle('over', input.value.length >= pair[1]);
    });
  }

  // ── submit ────────────────────────────────────────────────────────────────
  async function submit() {
    collectStep(5);
    const errors = validateStep(5);
    if (errors.length) { showErrors(5, errors); return; }
    setSaveNote('Submitting…');
    $('#btn-next').disabled = true;
    const { status, data } = await post(API.submit, authBody({ fields: fieldsForStep(5) }));
    $('#btn-next').disabled = false;
    if (data.ok) {
      try { localStorage.removeItem(LS_KEY); } catch (e) { /* ignore */ }
      window.location.href = 'thanks.html?ref=' + encodeURIComponent(data.public_id);
      return;
    }
    if (status === 422 && data.fields) {
      // Jump to the earliest step that has a problem.
      const fieldStep = {};
      Object.keys(STEP_FIELDS).forEach(function (s) {
        STEP_FIELDS[s].forEach(n => { fieldStep[n] = Number(s); });
      });
      let minStep = 5;
      Object.keys(data.fields).forEach(function (name) {
        if (fieldStep[name] && fieldStep[name] < minStep) minStep = fieldStep[name];
      });
      goTo(minStep, { skipValidate: true }).then(function () {
        applyServerErrors(minStep, data.fields);
      });
      return;
    }
    showErrors(5, [['form', (data.message || 'Submission failed — try again.')]]);
  }

  // ── resume flows ──────────────────────────────────────────────────────────
  async function tryResumeToken(token) {
    const { status, data } = await post(API.resume, { token: token });
    if (data.ok) {
      state.publicId = data.public_id;
      state.draftToken = data.draft_token;
      state.payloadRev = data.payload_rev;
      state.app = data.payload || {};
      state.step = Math.min(Math.max(data.current_step || 1, 1), 5);
      state.files = (data.media || []).map(function (m) {
        return { kind: m.kind === 'analytics_screenshot' ? 'shot' : 'upload', mediaId: m.media_id,
                 name: m.title || 'file', size: m.bytes, mime: m.mime,
                 status: m.status === 'stored' ? 'done' : 'failed', progress: 100,
                 meta: { title: m.title } };
      });
      persistLocal();
      renderAll();
      state.files.forEach(renderFileRow);
      $('#resume-banner').hidden = false;
      await goTo(state.step, { skipValidate: true, noFocus: true });
      return true;
    }
    if (status === 410) {
      $('#resume-box').hidden = false;
      $('#resume-box').insertAdjacentHTML('afterbegin',
        '<p class="f-error" style="display:block;margin-bottom:10px">That link has expired — request a fresh one.</p>');
    }
    return false;
  }

  function tryLocalStorage() {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(LS_KEY) || 'null'); } catch (e) { /* ignore */ }
    if (!saved || !saved.app) return false;
    state.publicId = saved.publicId;
    state.draftToken = saved.draftToken;
    state.payloadRev = saved.payloadRev || 0;
    state.app = saved.app;
    state.step = Math.min(Math.max(saved.step || 1, 1), 5);
    renderAll();
    if (saved.publicId) $('#resume-banner').hidden = false;
    goTo(state.step, { skipValidate: true, noFocus: true });
    return true;
  }

  // ── wiring ────────────────────────────────────────────────────────────────
  form.addEventListener('input', function (e) {
    markDirty();
    if (e.target.id === 'f-bio_short' || e.target.id === 'f-bio_long') updateCounts();
  });
  form.addEventListener('change', function (e) {
    markDirty();
    if (e.target.name === 'applicant_type') {
      state.app.applicant_type = e.target.value;
      renderStepNav(); updateTypeUI();
    }
    if (e.target.name === 'booking_contact') {
      state.app.booking_contact = e.target.value;
      updateTypeUI();
    }
  });
  $$('button[data-add]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const row = addRow(btn.dataset.add);
      if (row) { const first = $('input, select', row); first && first.focus(); }
    });
  });
  document.addEventListener('click', function (e) {
    const jump = e.target.closest('[data-jump]');
    if (jump) {
      e.preventDefault();
      const row = $('.f-row[data-field="' + jump.dataset.jump + '"]');
      if (row) { const input = $('input, select, textarea', row); (input || row).focus(); }
    }
    const nav = e.target.closest('[data-nav]');
    if (nav && Number(nav.dataset.nav) <= state.step) goTo(Number(nav.dataset.nav));
    const gt = e.target.closest('[data-goto]');
    if (gt) goTo(Number(gt.dataset.goto), { skipValidate: true });
  });
  $('#btn-next').addEventListener('click', function () {
    const steps = visibleSteps();
    const i = steps.indexOf(state.step);
    if (state.step === 5) submit();
    else goTo(steps[i + 1]);
  });
  $('#btn-back').addEventListener('click', function () {
    const steps = visibleSteps();
    const i = steps.indexOf(state.step);
    if (i > 0) goTo(steps[i - 1]);
  });

  // dropzones
  [['media', 'upload'], ['shots', 'shot']].forEach(function (pair) {
    const drop = $('#' + pair[0] + '-drop');
    const input = $('#' + pair[0] + '-input');
    const open = () => input.click();
    drop.addEventListener('click', open);
    drop.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
    });
    drop.addEventListener('dragover', function (e) { e.preventDefault(); drop.classList.add('drag'); });
    drop.addEventListener('dragleave', function () { drop.classList.remove('drag'); });
    drop.addEventListener('drop', function (e) {
      e.preventDefault(); drop.classList.remove('drag');
      handleFiles(pair[1], e.dataTransfer.files);
    });
    input.addEventListener('change', function () {
      handleFiles(pair[1], input.files);
      input.value = '';
    });
  });

  // resume-by-email box
  $('#resume-open').addEventListener('click', function () {
    $('#resume-box').hidden = false;
    $('#resume-email').focus();
  });
  $('#resume-cancel').addEventListener('click', function () { $('#resume-box').hidden = true; });
  $('#resume-send').addEventListener('click', async function () {
    const email = $('#resume-email').value.trim();
    if (!email) return;
    await post(API.magic, { email: email });
    $('#resume-sent').hidden = false;
  });
  $('#start-over').addEventListener('click', function () {
    try { localStorage.removeItem(LS_KEY); } catch (e) { /* ignore */ }
    window.location.href = 'apply.html';
  });

  window.addEventListener('beforeunload', function (e) {
    if (state.dirty) { e.preventDefault(); e.returnValue = ''; }
  });

  // ── boot ──────────────────────────────────────────────────────────────────
  const params = new URLSearchParams(window.location.search);
  const resumeToken = params.get('resume');
  if (params.get('type') === 'brand') state.app.applicant_type = 'brand';
  renderAll();
  renderStepNav();
  goTo(1, { skipValidate: true, noFocus: true });

  if (resumeToken) {
    history.replaceState(null, '', 'apply.html');
    tryResumeToken(resumeToken).then(function (ok) {
      if (!ok) tryLocalStorage();
    });
  } else {
    tryLocalStorage();
  }
})();
