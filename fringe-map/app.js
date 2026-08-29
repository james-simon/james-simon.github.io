// Fringe Map — timeline-brushed map of a day's events.

(function () {
  'use strict';

  var STORAGE_KEY = 'fringe-map-events-v1';
  var PICKS_KEY = 'fringe-map-picks-v1';
  var DAY_PAD = 30;            // minutes of slack around the day's extent
  var MAX_LABEL_DY = 60;       // stop labelling once a stack gets this deep

  var P = window.FringeParse;
  var fmt = P.fmtMinutes;

  var els = {
    timeline: document.getElementById('timeline'),
    playhead: document.getElementById('playhead'),
    ticks: document.getElementById('ticks'),
    itinerary: document.getElementById('itinerary'),
    itinLanes: document.getElementById('itinLanes'),
    itinEmpty: document.getElementById('itinEmpty'),
    windowLabel: document.getElementById('windowLabel'),
    activeCount: document.getElementById('activeCount'),
    details: document.getElementById('details'),
    input: document.getElementById('eventsInput'),
    errors: document.getElementById('errors'),
    dataStatus: document.getElementById('dataStatus'),
    dataPanel: document.getElementById('dataPanel'),
    sideHint: document.getElementById('sideHint'),
    btnApply: document.getElementById('btnApply'),
    btnReset: document.getElementById('btnReset'),
    btnNow: document.getElementById('btnNow')
  };

  var state = {
    events: [],
    venues: [],          // events grouped by rounded lat/lng
    t: 630,              // selected time of day, in minutes
    domainLo: 540, domainHi: 1500,
    selectedVenue: null,
    picks: {}            // event id -> true, the draft itinerary
  };

  try {
    state.picks = JSON.parse(localStorage.getItem(PICKS_KEY) || '{}') || {};
  } catch (e) { state.picks = {}; }

  function savePicks() {
    try { localStorage.setItem(PICKS_KEY, JSON.stringify(state.picks)); } catch (e) { /* ignore */ }
  }

  function isPicked(ev) { return !!state.picks[ev.id]; }

  var TIME_KEY = 'fringe-map-time-v1';
  function saveWindow() {
    try { localStorage.setItem(TIME_KEY, String(state.t)); } catch (e) { /* ignore */ }
  }

  function pickedEvents() {
    return state.events.filter(isPicked);
  }

  // The span an event occupies for conflict purposes. For multi-session shows we
  // use the session the user is most likely to mean: the first one, unless a
  // later session avoids a clash (resolved in packLanes).
  function eventSpan(ev) {
    var spans = ev.sessions || [{ start: ev.start, end: ev.end }];
    return spans[0];
  }

  // ---------- map ----------

  var map = L.map('map', { scrollWheelZoom: true, zoomControl: true });
  // Minimal light-grey canvas: no labels, no terrain, no POI clutter, so the
  // pins carry all the information.
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri',
    maxZoom: 19,
    maxNativeZoom: 18
  }).addTo(map);
  map.setView([55.9467, -3.1883], 14);   // central Edinburgh, replaced by fitBounds

  // Label placement depends on screen positions, so recompute after the map moves.
  map.on('zoomend moveend', function () { if (state.venues.length) renderMap(); });

  // ---------- grouping ----------

  function venueKey(ev) {
    return ev.lat.toFixed(5) + ',' + ev.lng.toFixed(5);
  }

  function groupByVenue(events) {
    var byKey = {};
    var order = [];
    events.forEach(function (ev) {
      var k = venueKey(ev);
      if (!byKey[k]) {
        byKey[k] = { key: k, lat: ev.lat, lng: ev.lng, name: ev.venueName, shows: [], marker: null };
        order.push(k);
      }
      byKey[k].shows.push(ev);
    });
    return order.map(function (k) { return byKey[k]; });
  }

  // ---------- rendering ----------

  function makeIcon(venue, active, selected, labelText, labelDy, picked) {
    var cls = 'fm-pin-wrap' +
      (picked ? ' is-picked' : (active ? ' is-active' : '')) +
      (selected ? ' is-selected' : '');
    var badge = venue.shows.length > 1
      ? '<span class="fm-pin-badge">' + venue.shows.length + '</span>' : '';
    var label = labelText
      ? '<span class="fm-pin-label" style="top:' + (19 + (labelDy || 0)) + 'px">' + labelText + '</span>'
      : '';
    return L.divIcon({
      className: '',
      html: '<div class="' + cls + '" style="position:relative"><div class="fm-pin"></div>' + badge + label + '</div>',
      iconSize: [14, 14],
      iconAnchor: [7, 7]
    });
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function activeShows(venue) {
    return venue.shows.filter(function (ev) { return P.isActive(ev, state.t); });
  }

  // Active labels are placed in map-pixel space; venues that would overprint
  // each other get pushed down a row so both stay readable.
  function assignLabelOffsets(activeVenues) {
    var placed = [];
    var ROW = 15, XTOL = 150;
    activeVenues.forEach(function (v) {
      var pt = map.latLngToContainerPoint([v.lat, v.lng]);
      var dy = 0, moved = true, guard = 0;
      while (moved && guard++ < 12) {
        moved = false;
        for (var i = 0; i < placed.length; i++) {
          var q = placed[i];
          if (Math.abs(q.x - pt.x) < XTOL && Math.abs((q.y + q.dy) - (pt.y + dy)) < ROW) {
            dy += ROW;
            moved = true;
          }
        }
      }
      placed.push({ x: pt.x, y: pt.y, dy: dy });
      v._labelDy = dy;
    });
  }

  function renderMap() {
    var actives = state.venues.filter(function (v) {
      return activeShows(v).length > 0 || v.shows.some(isPicked);
    });
    // north-to-south so the topmost label keeps its natural position
    actives.sort(function (a, b) { return b.lat - a.lat; });
    assignLabelOffsets(actives);

    state.venues.forEach(function (venue) {
      var act = activeShows(venue);
      var isActive = act.length > 0;
      var picks = venue.shows.filter(isPicked);
      var hasPick = picks.length > 0;
      var isSel = state.selectedVenue === venue.key;

      var labelText = null;
      if ((isActive || hasPick) && venue._labelDy <= MAX_LABEL_DY) {
        // Prefer naming a picked show, since that is the committed plan.
        var lead = hasPick ? picks[0] : act[0];
        var extra = (hasPick ? picks.length : act.length) - 1;
        labelText = esc(lead.name);
        if (extra > 0) {
          labelText += ' <span class="fm-pin-count">+' + extra + '</span>';
        }
      }

      var icon = makeIcon(venue, isActive, isSel, labelText,
        (isActive || hasPick) ? venue._labelDy : 0, hasPick);
      if (!venue.marker) {
        venue.marker = L.marker([venue.lat, venue.lng], {
          icon: icon,
          zIndexOffset: isActive ? 1000 : 0,
          riseOnHover: true
        }).addTo(map);
        venue.marker.on('click', function () { selectVenue(venue.key); });
      } else {
        venue.marker.setIcon(icon);
        venue.marker.setZIndexOffset(isActive ? 1000 : 0);
      }
    });
  }

  function renderTimeline() {
    var span = state.domainHi - state.domainLo;
    var pct = ((state.t - state.domainLo) / span) * 100;
    els.playhead.style.left = pct + '%';
    els.windowLabel.textContent = fmt(state.t);

    var n = state.events.filter(function (ev) {
      return P.isActive(ev, state.t);
    }).length;
    els.activeCount.textContent = n + (n === 1 ? ' show running' : ' shows running');
  }

  function buildTicks() {
    var span = state.domainHi - state.domainLo;
    els.ticks.innerHTML = '';
    var step = span > 720 ? 120 : 60;
    var firstHour = Math.ceil(state.domainLo / step) * step;
    for (var m = firstHour; m <= state.domainHi; m += step) {
      var pct = ((m - state.domainLo) / span) * 100;
      var lab = document.createElement('span');
      lab.className = 'fm-tick';
      lab.style.left = pct + '%';
      lab.textContent = fmt(m);
      els.ticks.appendChild(lab);

      var mark = document.createElement('span');
      mark.className = 'fm-tick-mark';
      mark.style.left = pct + '%';
      els.timeline.appendChild(mark);
    }
  }

  // Greedy interval packing: each pick goes on the first lane where it doesn't
  // overlap anything already placed. Overlapping picks therefore stack.
  function packLanes(events) {
    var sorted = events.slice().sort(function (a, b) {
      return eventSpan(a).start - eventSpan(b).start;
    });
    var lanes = [];
    sorted.forEach(function (ev) {
      var sp = eventSpan(ev);
      for (var i = 0; i < lanes.length; i++) {
        var fits = lanes[i].every(function (o) {
          var os = eventSpan(o);
          return sp.start >= os.end || sp.end <= os.start;
        });
        if (fits) { lanes[i].push(ev); return; }
      }
      lanes.push([ev]);
    });
    return lanes;
  }

  function renderItinerary() {
    var picks = pickedEvents();
    els.itinEmpty.style.display = picks.length ? 'none' : '';
    els.itinLanes.innerHTML = '';
    if (!picks.length) return;

    var lanes = packLanes(picks);
    var span = state.domainHi - state.domainLo;

    lanes.forEach(function (lane) {
      var row = document.createElement('div');
      row.className = 'fm-itin-lane';
      lane.forEach(function (ev) {
        var sp = eventSpan(ev);
        var a = ((sp.start - state.domainLo) / span) * 100;
        var b = ((Math.max(sp.end, sp.start + 10) - state.domainLo) / span) * 100;
        var block = document.createElement('div');
        // A pick sharing a lane index > 0 necessarily clashes with something.
        block.className = 'fm-itin-block' + (lanes.length > 1 && lanes.indexOf(lane) > 0 ? ' conflict' : '');
        block.style.left = a + '%';
        block.style.width = Math.max(1.2, b - a) + '%';
        block.textContent = ev.name;
        block.title = fmt(sp.start) + '–' + fmt(sp.end) + '  ' + ev.name +
          (ev.venueName ? '  ·  ' + ev.venueName : '') + '\n(click to open)';
        // Clicking a block opens that show's venue, scrolled to the show itself.
        block.addEventListener('click', function () {
          var key = venueKey(ev);
          var v = state.venues.filter(function (x) { return x.key === key; })[0];
          if (!v) return;
          state.selectedVenue = key;
          showDetail(v, ev.id);
          renderMap();
          map.panTo([v.lat, v.lng], { animate: true, duration: 0.4 });
        });
        row.appendChild(block);
      });
      els.itinLanes.appendChild(row);
    });

    // count genuine pairwise clashes for the summary line
    var clashes = 0;
    for (var i = 0; i < picks.length; i++) {
      for (var j = i + 1; j < picks.length; j++) {
        var x = eventSpan(picks[i]), y = eventSpan(picks[j]);
        if (x.start < y.end && y.start < x.end) clashes++;
      }
    }
    var sum = document.createElement('div');
    sum.className = 'fm-itin-summary';
    sum.innerHTML = picks.length + (picks.length === 1 ? ' pick' : ' picks') +
      (clashes ? ' · <span class="fm-itin-warn">' + clashes + ' time clash' +
        (clashes > 1 ? 'es' : '') + '</span>' : ' · no clashes');
    els.itinLanes.appendChild(sum);
  }

  // ---------- details ----------

  function showDetail(venue, focusId) {
    var shows = venue.shows.slice().sort(function (a, b) { return a.start - b.start; });
    var html = '<button class="fm-details-close" id="detClose" title="close">&times;</button>';
    html += '<div style="font-size:0.8em;color:#888;margin-bottom:0.5em">' +
      esc(venue.name || 'Venue') + '</div>';

    shows.forEach(function (ev) {
      var on = P.isActive(ev, state.t);
      html += '<div class="fm-detail-show' + (focusId === ev.id ? ' focus' : '') +
        '" data-show="' + esc(ev.id) + '" style="opacity:' + (on ? 1 : 0.45) + '">';
      html += '<h3>' + esc(ev.name);
      if (ev.confidence && ev.confidence !== 'high') {
        html += '<span class="fm-badge fm-badge-' + esc(ev.confidence) + '">' +
          esc(ev.confidence) + ' confidence</span>';
      }
      html += '</h3>';

      var when = fmt(ev.start) + '–' + fmt(ev.end);
      if (ev.sessions && ev.sessions.length > 1) {
        when = ev.sessions.map(function (s) { return fmt(s.start) + '–' + fmt(s.end); }).join('  ·  ');
      }
      html += '<div class="fm-detail-when">' + when + '</div>';

      var meta = [];
      if (ev.room) meta.push(esc(ev.room));
      if (ev.genre) meta.push(esc(ev.genre));
      if (ev.performer) meta.push(esc(ev.performer));
      if (ev.address) meta.push(esc(ev.address));
      if (meta.length) html += '<div class="fm-detail-meta">' + meta.join(' · ') + '</div>';

      if (ev.blurb) html += '<div class="fm-detail-blurb">' + esc(ev.blurb) + '</div>';
      if (ev.note) html += '<div class="fm-detail-note">' + esc(ev.note) + '</div>';

      var picked = isPicked(ev);
      html += '<button class="fm-add-btn' + (picked ? ' added' : '') +
        '" data-ev="' + esc(ev.id) + '">' +
        (picked ? '\u2713 in itinerary — click to remove' : '+ add to itinerary') +
        '</button>';
      html += '</div>';
    });

    els.details.innerHTML = html;
    els.details.hidden = false;
    if (els.sideHint) els.sideHint.style.display = 'none';
    document.getElementById('detClose').addEventListener('click', function () {
      state.selectedVenue = null;
      els.details.hidden = true;
      if (els.sideHint) els.sideHint.style.display = '';
      renderMap();
    });

    if (focusId) {
      var target = els.details.querySelector('[data-show="' + focusId + '"]');
      if (target && target.scrollIntoView) {
        target.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }

    Array.prototype.forEach.call(els.details.querySelectorAll('.fm-add-btn'), function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.dataset.ev;
        if (state.picks[id]) delete state.picks[id];
        else state.picks[id] = true;
        savePicks();
        showDetail(venue, id);  // re-render so the button label flips
        renderItinerary();
        renderMap();
      });
    });
  }

  function selectVenue(key) {
    state.selectedVenue = key;
    var venue = state.venues.filter(function (v) { return v.key === key; })[0];
    if (venue) showDetail(venue);
    renderMap();
  }

  // ---------- timeline interaction ----------

  function pxToMinutes(clientX) {
    var rect = els.timeline.getBoundingClientRect();
    var frac = (clientX - rect.left) / rect.width;
    frac = Math.max(0, Math.min(1, frac));
    var m = state.domainLo + frac * (state.domainHi - state.domainLo);
    return Math.round(m / 5) * 5;      // snap to 5 minutes
  }

  var dragging = false;

  function setTime(m, opts) {
    state.t = Math.max(state.domainLo, Math.min(m, state.domainHi));
    renderTimeline();
    renderMap();
    if ((!opts || opts.saveWindow !== false)) saveWindow();
  }

  function onDown(e) {
    e.preventDefault();
    dragging = true;
    els.playhead.classList.add('dragging');
    var x = e.touches ? e.touches[0].clientX : e.clientX;
    setTime(pxToMinutes(x));
  }

  function onMove(e) {
    if (!dragging) return;
    e.preventDefault();
    var x = e.touches ? e.touches[0].clientX : e.clientX;
    setTime(pxToMinutes(x));
  }

  function onUp() {
    if (!dragging) return;
    dragging = false;
    els.playhead.classList.remove('dragging');
  }

  els.playhead.addEventListener('mousedown', onDown);
  els.playhead.addEventListener('touchstart', onDown, { passive: false });
  els.timeline.addEventListener('mousedown', onDown);
  els.timeline.addEventListener('touchstart', onDown, { passive: false });
  window.addEventListener('mousemove', onMove);
  window.addEventListener('touchmove', onMove, { passive: false });
  window.addEventListener('mouseup', onUp);
  window.addEventListener('touchend', onUp);

  // Arrow keys nudge the playhead once the timeline has focus.
  els.timeline.setAttribute('tabindex', '0');
  els.timeline.addEventListener('keydown', function (e) {
    var step = e.shiftKey ? 60 : 5;
    if (e.key === 'ArrowLeft') { e.preventDefault(); setTime(state.t - step); }
    if (e.key === 'ArrowRight') { e.preventDefault(); setTime(state.t + step); }
  });

  els.btnNow.addEventListener('click', function () {
    var now = new Date();
    setTime(now.getHours() * 60 + now.getMinutes());
  });

  // ---------- data loading ----------

  function clearMarkers() {
    state.venues.forEach(function (v) { if (v.marker) map.removeLayer(v.marker); });
  }

  function load(text, opts) {
    opts = opts || {};
    var res = P.parse(text);

    if (res.errors.length) {
      els.errors.className = 'fm-errors';
      els.errors.textContent = res.errors.slice(0, 3).join(' · ') +
        (res.errors.length > 3 ? ' (+' + (res.errors.length - 3) + ' more)' : '');
    } else {
      els.errors.className = 'fm-errors ok';
      els.errors.textContent = opts.quiet ? '' : 'Loaded ' + res.events.length + ' events.';
    }

    if (!res.events.length) {
      els.dataStatus.textContent = '— nothing loaded';
      return false;
    }

    clearMarkers();
    state.events = res.events;
    // Drop picks whose events are no longer present in the loaded data.
    var live = {};
    res.events.forEach(function (e) { if (state.picks[e.id]) live[e.id] = true; });
    state.picks = live;
    savePicks();
    state.venues = groupByVenue(res.events);
    state.selectedVenue = null;
    els.details.hidden = true;
    if (els.sideHint) els.sideHint.style.display = '';

    // Domain covers the day's events, padded and rounded to the hour.
    var minStart = Math.min.apply(null, res.events.map(function (e) { return e.start; }));
    var maxEnd = Math.max.apply(null, res.events.map(function (e) {
      var spans = e.sessions || [{ end: e.end }];
      return Math.max.apply(null, spans.map(function (s) { return s.end; }));
    }));
    state.domainLo = Math.floor((minStart - DAY_PAD) / 60) * 60;
    state.domainHi = Math.ceil((maxEnd + DAY_PAD) / 60) * 60;

    if (opts.resetWindow !== false) {
      state.t = state.domainLo + 90;
    }
    state.t = Math.max(state.domainLo, Math.min(state.t, state.domainHi));

    var label = res.meta && res.meta.date ? res.meta.date : '';
    els.dataStatus.textContent = '— ' + res.events.length + ' events' +
      (label ? ', ' + label : '') + ', ' + state.venues.length + ' venues';

    buildTicks();
    renderTimeline();
    renderItinerary();
    renderMap();

    var bounds = L.latLngBounds(state.venues.map(function (v) { return [v.lat, v.lng]; }));
    map.fitBounds(bounds, { padding: [45, 45], maxZoom: 15 });
    return true;
  }

  els.btnApply.addEventListener('click', function () {
    var text = els.input.value;
    if (load(text, { resetWindow: false })) {
      try { localStorage.setItem(STORAGE_KEY, text); } catch (e) { /* private mode */ }
    }
  });

  els.btnReset.addEventListener('click', function () {
    var text = JSON.stringify(window.FRINGE_SAMPLE, null, 2);
    els.input.value = text;
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* ignore */ }
    load(text);
  });

  // ---------- boot ----------

  var saved = null;
  try { saved = localStorage.getItem(STORAGE_KEY); } catch (e) { /* ignore */ }

  var savedTime = null;
  try { savedTime = localStorage.getItem(TIME_KEY); } catch (e) { /* ignore */ }

  var initial = saved || JSON.stringify(window.FRINGE_SAMPLE, null, 2);
  els.input.value = initial;
  load(initial, { quiet: true, resetWindow: savedTime === null });
  if (savedTime !== null) setTime(parseFloat(savedTime), { saveWindow: false });
  if (!saved) els.dataPanel.open = false;
})();
