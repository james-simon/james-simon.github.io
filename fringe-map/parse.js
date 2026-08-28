// Event-list parsing. Accepts either:
//   (a) a JSON object {shows:[...]} / {events:[...]} or a bare JSON array, or
//   (b) one event per line:  name | time | location | lat, lng
// Times may be "14:30" or "14:30-16:00" or full ISO "2026-08-29T14:30".
// Blank lines and #-comments are ignored.

(function (global) {
  'use strict';

  function toMinutes(str, dayStartISO) {
    if (str == null) return null;
    var s = String(str).trim();
    if (!s) return null;

    // Full ISO timestamp: measure offset from the reference day.
    var iso = s.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{1,2}):(\d{2})/);
    if (iso) {
      var mins = parseInt(iso[4], 10) * 60 + parseInt(iso[5], 10);
      if (dayStartISO) {
        var d0 = dayStartISO.slice(0, 10);
        if (iso[1] + '-' + iso[2] + '-' + iso[3] !== d0) {
          // Different calendar day -> roll past midnight (handles 23:00->00:00 shows).
          var a = Date.UTC(+iso[1], +iso[2] - 1, +iso[3]);
          var b = Date.UTC(+d0.slice(0, 4), +d0.slice(5, 7) - 1, +d0.slice(8, 10));
          mins += Math.round((a - b) / 86400000) * 1440;
        }
      }
      return mins;
    }

    // Bare clock time, optionally with am/pm.
    var t = s.match(/^(\d{1,2})[:.](\d{2})\s*(am|pm)?$/i);
    if (t) {
      var h = parseInt(t[1], 10), mm = parseInt(t[2], 10);
      var ap = t[3] && t[3].toLowerCase();
      if (ap === 'pm' && h < 12) h += 12;
      if (ap === 'am' && h === 12) h = 0;
      return h * 60 + mm;
    }
    var t2 = s.match(/^(\d{1,2})\s*(am|pm)$/i);
    if (t2) {
      var h2 = parseInt(t2[1], 10);
      var ap2 = t2[2].toLowerCase();
      if (ap2 === 'pm' && h2 < 12) h2 += 12;
      if (ap2 === 'am' && h2 === 12) h2 = 0;
      return h2 * 60;
    }
    return null;
  }

  function fmtMinutes(m) {
    m = ((Math.round(m) % 1440) + 1440) % 1440;
    var h = Math.floor(m / 60), mm = m % 60;
    return String(h).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
  }

  function normalizeShow(raw, dayStartISO, errors, label) {
    var venue = raw.venue || {};
    var lat = raw.lat != null ? raw.lat : venue.lat;
    var lng = raw.lng != null ? raw.lng : (raw.lon != null ? raw.lon : venue.lng != null ? venue.lng : venue.lon);
    lat = typeof lat === 'string' ? parseFloat(lat) : lat;
    lng = typeof lng === 'string' ? parseFloat(lng) : lng;

    var name = raw.name || raw.title || '(untitled)';
    if (!isFinite(lat) || !isFinite(lng)) {
      errors.push(label + ': missing or invalid coordinates for "' + name + '"');
      return null;
    }

    var start = toMinutes(raw.start || raw.time, dayStartISO);
    if (start == null) {
      errors.push(label + ': could not read a start time for "' + name + '"');
      return null;
    }
    var end = toMinutes(raw.end, dayStartISO);
    if (end == null && raw.durationMin) end = start + Number(raw.durationMin);
    if (end == null) end = start;          // zero-length: treated as a point in time
    if (end < start) end += 1440;          // crossed midnight

    var sessions = null;
    if (Array.isArray(raw.sessions) && raw.sessions.length) {
      sessions = raw.sessions.map(function (s) {
        var ss = toMinutes(s.start, dayStartISO);
        var se = toMinutes(s.end, dayStartISO);
        if (ss == null) return null;
        if (se == null) se = ss;
        if (se < ss) se += 1440;
        return { start: ss, end: se };
      }).filter(Boolean);
      if (!sessions.length) sessions = null;
    }

    return {
      id: raw.id || (name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'event') + '-' + start,
      name: name,
      performer: raw.performer || null,
      genre: raw.genre || null,
      blurb: raw.blurb || null,
      note: raw.note || null,
      status: raw.status || 'candidate',
      start: start,
      end: end,
      sessions: sessions,
      venueName: venue.name || raw.location || raw.venue_name || '',
      room: venue.room || raw.room || null,
      address: venue.address || raw.address || null,
      confidence: venue.confidence || null,
      lat: lat,
      lng: lng
    };
  }

  function parseLine(line, lineNo, dayStartISO, errors) {
    var parts = line.split('|').map(function (p) { return p.trim(); });
    if (parts.length < 4) {
      errors.push('line ' + lineNo + ': expected 4 fields separated by "|", got ' + parts.length);
      return null;
    }
    var name = parts[0], timeStr = parts[1], loc = parts[2], coords = parts.slice(3).join(',');

    var startStr = timeStr, endStr = null;
    var range = timeStr.split(/\s*(?:-|–|—|to)\s*/);
    if (range.length === 2) { startStr = range[0]; endStr = range[1]; }

    var cm = coords.match(/(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)/);
    if (!cm) {
      errors.push('line ' + lineNo + ': could not read "lat, lng" from "' + coords + '"');
      return null;
    }

    return normalizeShow({
      name: name, start: startStr, end: endStr,
      venue: { name: loc, lat: parseFloat(cm[1]), lng: parseFloat(cm[2]) }
    }, dayStartISO, errors, 'line ' + lineNo);
  }

  function parse(text) {
    var errors = [];
    var events = [];
    var meta = null;
    var trimmed = (text || '').trim();
    if (!trimmed) return { events: [], errors: [], meta: null };

    if (trimmed[0] === '{' || trimmed[0] === '[') {
      var data;
      try {
        data = JSON.parse(trimmed);
      } catch (e) {
        return { events: [], errors: ['JSON did not parse: ' + e.message], meta: null };
      }
      var list = Array.isArray(data) ? data : (data.shows || data.events || data.items || []);
      meta = (!Array.isArray(data) && data.meta) || null;
      var dayStart = meta && meta.date ? meta.date + 'T00:00' : (list[0] && list[0].start) || null;
      list.forEach(function (raw, i) {
        var ev = normalizeShow(raw, dayStart, errors, 'entry ' + (i + 1));
        if (ev) events.push(ev);
      });
    } else {
      trimmed.split(/\r?\n/).forEach(function (line, i) {
        var s = line.trim();
        if (!s || s[0] === '#') return;
        var ev = parseLine(s, i + 1, null, errors);
        if (ev) events.push(ev);
      });
    }

    events.sort(function (a, b) { return a.start - b.start; });
    return { events: events, errors: errors, meta: meta };
  }

  // An event is active if any of its sessions overlaps [lo, hi].
  function isActive(ev, lo, hi) {
    var spans = ev.sessions || [{ start: ev.start, end: ev.end }];
    for (var i = 0; i < spans.length; i++) {
      var s = spans[i];
      var e = s.end === s.start ? s.start : s.end;
      if (s.start <= hi && e >= lo) return true;
    }
    return false;
  }

  global.FringeParse = { parse: parse, isActive: isActive, fmtMinutes: fmtMinutes, toMinutes: toMinutes };
})(typeof window !== 'undefined' ? window : globalThis);
