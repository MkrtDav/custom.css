// PSV bench definition: rule engine written from the CHG-375324 kit (PSV 2.0). Fake data only.
(function (g) {
  var C = BenchCore, ok = C.ok, no = C.no;
  var TAGS = [5, 10, 11, 12, 14, 20, 21, 22, 24, 30, 31, 32, 34, 40, 41, 42, 44, 50, 51, 52, 54];
  var codes = {
    1024: "OK", 1517: "Service closed", 1520: "Signature not valid", 1521: "Mandatory attribute missing", 1522: "PVEND, CN or TIPO_TAG not enabled for the operation", 1510: "Request rejected (message not in this bench)",
    2000: "Programme not identified", 2001: "Event not identified", 2004: "Weight error", 2005: "Number of events not valid", 2006: "Discipline not identified", 2007: "Programme for the discipline already coded for the current day",
    2008: "Platform not identified", 2011: "Event date different from programme date", 2012: "Programme not open", 2016: "Event not open", 2017: "Event not closed", 2023: "Platform blocked", 2024: "Official results different from the totalisator's",
    2028: "Event already in a multi-event", 2031: "Programme opening blocked on the date given",
    3001: "Event not playable", 3004: "Declared odds wrong", 3005: "Duplicate events", 3006: "Wrong ticket price", 3007: "Wrong payout amount", 3008: "Play identifier not unique", 3009: "Number of bet lines not valid",
    3015: "Multiple across events, multi-events and tournaments not allowed", 4004: "Ticket cannot be cancelled: remote gaming",
    5000: "Ticket not winning or not found", 5002: "Not payable: already paid", 5003: "Not payable: official results missing", 5005: "Payments suspended", 5007: "Not payable: cancelled",
    7009: "Account does not exist", 7010: "Account not playable", 7012: "Component data not compliant"
  };
  function init() { return { programmes: {}, events: {}, nextP: 1, nextE: 1, tickets: {}, plays: {}, nextT: 1, multi: {}, accounts: { A1: { balance: 100000, state: "open" }, A2: { balance: 0, state: "blocked" } }, blockedDates: ["2026-12-25"] }; }
  function sig(q) { if (q.FIRMA_DIG01 === undefined || q.FIRMA_DIG01 === null) return no(1521, "FIRMA_DIG01 is mandatory"); if (q.FIRMA_DIG01 !== "ok") return no(1520, "Signature does not verify"); return null; }
  var H = {
    "9000.1": function (s, q, sb) {
      if (["football", "horses", "dogs"].indexOf(q.discipline) < 0) return no(2006, "Discipline not identified");
      if (s.blockedDates.indexOf(q.date) >= 0) return no(2031, "Programme opening is blocked on this date");
      var day = new Date(sb.clock).toISOString().slice(0, 10), ahead = (Date.parse(q.date) - Date.parse(day)) / 86400000;
      if (ahead > 1) return no(2012, "A programme can be opened at most one day ahead");
      for (var k in s.programmes) if (s.programmes[k].discipline === q.discipline && s.programmes[k].date === q.date) return no(2007, "Only one programme per discipline can be coded for the day");
      var id = s.nextP++; s.programmes[id] = { discipline: q.discipline, date: q.date }; return ok({ programme: id }, "Programme opened; programme code returned");
    },
    "9000.2": function (s, q) {
      var p = s.programmes[q.programme]; if (!p) return no(2000, "Programme not identified"); if (q.platform === "BLOCKED") return no(2023, "Platform blocked"); if (q.platform !== "P1") return no(2008, "Platform not identified");
      if (q.date !== p.date) return no(2011, "Event date different from programme date"); var sum = (q.weights || []).reduce(function (a, b) { return a + b; }, 0); if (sum !== 1000000) return no(2004, "Weights are in millionths and must sum to 1,000,000");
      if ((q.odds || []).some(function (o) { return o < 100; })) return no(3004, "Declared odds wrong (hundredths, at least 100)");
      var id = s.nextE++; s.events[id] = { programme: q.programme, state: 2, results: null }; return ok({ event: id }, "Event opened: bet acceptance is open from this moment");
    },
    "9000.3": function (s, q) { var e = s.events[q.event]; if (!e) return no(2001, "Event not identified"); if (e.state !== 2) return no(2016, "Event not open"); e.state = 3; e.numbers = [7, 21, 33]; return ok({ numbers: e.numbers }, "Draw request: bet acceptance closes and the pseudo-random numbers are returned"); },
    "9000.4": function (s, q) {
      var e = s.events[q.event]; if (!e) return no(2001, "Event not identified"); if (e.state !== 3) return no(2017, "Event not closed");
      if (JSON.stringify(q.results) !== JSON.stringify(e.numbers)) { e.suspended = true; return no(2024, "Results differ from the totalisator's: payments on this event are suspended"); }
      e.state = 4; e.results = q.results; return ok({}, "Official results accepted; payment and refund may follow");
    },
    "9000.5": function (s, q) { var e = s.events[q.event]; if (!e) return no(2001, "Event not identified"); if (e.state !== 2) return no(2016, "Only an open event can be cancelled; a closed event is completed"); e.state = 7; return ok({}, "Event cancelled: every bet on it is refunded in full"); },
    "9000.7": function (s, q) { var ev = q.events || []; if (ev.length < 1 || ev.length > 10) return no(2005, "A multi-event has up to 10 simultaneous events"); for (var i = 0; i < ev.length; i++) { if (!s.events[ev[i]]) return no(2001, "Event not identified"); if (s.multi[ev[i]]) return no(2028, "Event already in a multi-event"); } ev.forEach(function (x) { s.multi[x] = 1; }); return ok({}, "Multi-event opened"); },
    "9100.1": function (s, q) {
      var r = sig(q); if (r) return r; if (q.tipo_tag !== undefined && TAGS.indexOf(q.tipo_tag) < 0) return no(1522, "TIPO_TAG not enabled");
      var a = s.accounts[q.account]; if (!a) return no(7009, "Account does not exist"); if (a.state !== "open") return no(7010, "Account not playable");
      if (s.plays[q.ID_GIOCATA]) return no(3008, "Play identifier not unique");
      var lines = q.lines || []; if (lines.length < 1 || lines.length > 20) return no(3009, "A sale carries 1 to 20 bet lines");
      if (q.price < 100 || q.price % 50 !== 0) return no(3006, "Wrong ticket price: at least EUR 1.00 in steps of EUR 0.50");
      if (q.maxPay > 5000000) return no(3007, "Wrong payout amount: maximum win EUR 50,000");
      var seen = {}; for (var i = 0; i < lines.length; i++) { var l = lines[i]; if (seen[l.event]) return no(3005, "Duplicate events"); seen[l.event] = 1; var e = s.events[l.event]; if (!e || e.state !== 2) return no(3001, "Event not playable"); if (s.multi[l.event] && lines.length > 1) return no(3015, "A multiple cannot mix events with multi-events"); if (!(l.odds >= 100)) return no(3004, "Declared odds wrong"); }
      var id = "EC" + String(s.nextT++).padStart(10, "0"); s.tickets[id] = { id: id, account: q.account, price: q.price, lines: lines, state: "issued" }; s.plays[q.ID_GIOCATA] = id; a.balance -= q.price;
      return ok({ ticket: id }, "Accepted: ticket ID (48 bits, 12 hex characters) returned; the stake is debited only now");
    },
    "9100.2": function (s, q) {
      var r = sig(q); if (r) return r; var t = s.tickets[q.id]; if (!t) return no(5000, "Ticket not found"); if (t.state === "paid") return no(5002, "Already paid");
      var evs = t.lines.map(function (l) { return s.events[l.event]; });
      if (evs.some(function (e) { return e.state === 7; })) { t.state = "paid"; s.accounts[t.account].balance += t.price; return ok({ refunded: t.price }, "Event cancelled: the stake is refunded in full"); }
      if (evs.some(function (e) { return e.suspended; })) return no(5005, "Payments suspended");
      if (evs.some(function (e) { return e.state !== 4; })) return no(5003, "Official results missing");
      var wins = t.lines.every(function (l) { return s.events[l.event].results.indexOf(l.outcome) >= 0; }); if (!wins) return no(5000, "Ticket not winning");
      var odds = t.lines.reduce(function (p, l) { return p * l.odds / 100; }, 1), amt = Math.floor(t.price * odds); t.state = "paid"; s.accounts[t.account].balance += amt; return ok({ paid: amt }, "Payment accepted: the PACG credit (6.36 or 6.8) follows");
    },
    "9100.4": function (s, q) { var t = s.tickets[q.id]; if (!t) return no(5000, "Ticket not found"); return no(4004, "Ticket cannot be cancelled: remote gaming"); },
    "9200.1": function (s) { return ok({ tickets: Object.keys(s.tickets).length }, "Daily statement returned; compare with the platform figures"); },
    "9400.1": function (s) { var l = Object.keys(s.events).filter(function (k) { return s.events[k].state === 2 || s.events[k].state === 3; }); return ok({ left: l }, "Events left open or closed"); },
    "9500.1": function () { return ok({}, "Keep-alive accepted"); },
    "9500.2": function (s, q) { return (q.components || []).some(function (c) { return c.hash === "bad"; }) ? no(7012, "Component data not compliant") : ok({}, "Integrity check accepted"); }
  };
  var n = 0, tx = function () { return "V" + (++n); };
  function prog(sb) { var day = new Date(sb.clock).toISOString().slice(0, 10); sb.state.programmes[sb.state.nextP] = { discipline: "football", date: day }; return sb.state.nextP++; }
  function openEv(sb) { var p = prog(sb); var id = sb.state.nextE++; sb.state.events[id] = { programme: p, state: 2, results: null }; return id; }
  var day = function (sb) { return new Date(sb.clock).toISOString().slice(0, 10); };
  var sale = function (o) { o = o || {}; return { id_transazione: tx(), tag: 1, tipo_tag: o.tipo_tag === undefined ? 5 : o.tipo_tag, FIRMA_DIG01: o.sig === undefined ? "ok" : o.sig, account: o.account || "A1", ID_GIOCATA: o.play || "G" + tx(), price: o.price || 500, maxPay: o.maxPay || 100000, lines: o.lines || [{ event: 1, outcome: 7, odds: 250 }] }; };
  var mk = function (id, title, steps) { return { id: id, title: title, steps: steps }; };
  var tkt = function (sb) { return Object.keys(sb.state.tickets)[0]; };
  var payq = function (sb) { return { id_transazione: tx(), FIRMA_DIG01: "ok", id: tkt(sb) }; };
  var sell = function (p) { return { do: function (sb) { openEv(sb); }, label: "Sale", msg: "9100.1", req: function () { return sale({ play: p }); }, expect: 1024 }; };
  var draw = { label: "Draw request", msg: "9000.3", req: function () { return { id_transazione: tx(), event: 1 }; }, expect: 1024 };
  var results = function (r) { return { label: "Official results", msg: "9000.4", req: function () { return { id_transazione: tx(), event: 1, results: r }; }, expect: r[0] === 7 ? 1024 : 2024 }; };
  var ev1 = function (o) { return function (sb) { var q = { id_transazione: tx(), programme: 1, platform: "P1", date: day(sb), weights: [500000, 500000], odds: [190, 190] }; for (var k in o) q[k] = o[k]; return q; }; };
  var groups = [
    { id: "A", title: "Programme and events", ticket: "Kit rules 1 to 7", messages: ["9000.1", "9000.2", "9000.7"], note: "Declare first: the programme and each event are opened at ADM before any bet.", cases: [
      mk("A.1", "Open a programme", [{ label: "9000.1", msg: "9000.1", req: function (sb) { return { id_transazione: tx(), discipline: "football", date: day(sb) }; }, expect: 1024 }, { label: "Same discipline and day again", msg: "9000.1", req: function (sb) { return { id_transazione: tx(), discipline: "football", date: day(sb) }; }, expect: 2007 }, { label: "Unknown discipline", msg: "9000.1", req: function (sb) { return { id_transazione: tx(), discipline: "chess", date: day(sb) }; }, expect: 2006 }]),
      mk("A.2", "Programme date window and blocked date", [{ label: "Three days ahead", msg: "9000.1", req: function (sb) { return { id_transazione: tx(), discipline: "dogs", date: new Date(sb.clock + 3 * 86400000).toISOString().slice(0, 10) }; }, expect: 2012 }, { label: "A blocked date", msg: "9000.1", req: { id_transazione: "a22", discipline: "horses", date: "2026-12-25" }, expect: 2031 }]),
      mk("A.3", "Open an event", [{ do: function (sb) { prog(sb); }, label: "9000.2", msg: "9000.2", req: ev1(), expect: 1024 }, { label: "Weights not summing", msg: "9000.2", req: ev1({ weights: [500000, 400000] }), expect: 2004 }, { label: "Unknown platform", msg: "9000.2", req: ev1({ platform: "X" }), expect: 2008 }, { label: "Blocked platform", msg: "9000.2", req: ev1({ platform: "BLOCKED" }), expect: 2023 }, { label: "Wrong event date", msg: "9000.2", req: ev1({ date: "2020-01-01" }), expect: 2011 }]),
      mk("A.4", "Multi-event", [{ do: function (sb) { for (var i = 0; i < 11; i++) openEv(sb); }, label: "11 events", msg: "9000.7", req: { id_transazione: "a41", events: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] }, expect: 2005 }, { label: "Events 1 to 3", msg: "9000.7", req: { id_transazione: "a42", events: [1, 2, 3] }, expect: 1024 }, { label: "Event 2 again", msg: "9000.7", req: { id_transazione: "a43", events: [2, 4] }, expect: 2028 }])
    ] },
    { id: "B", title: "Bet placement", ticket: "Kit rules 8 to 20", messages: ["9100.1"], note: "Code before money: the stake is debited only after the ticket ID.", cases: [
      mk("B.1", "Accepted sale", [{ do: function (sb) { openEv(sb); }, label: "9100.1", msg: "9100.1", req: function () { return sale(); }, expect: 1024, assert: function (s, r) { return /^EC[0-9]{10}$/.test(r.ticket) || "ticket ID shape"; } }, { label: "Stake debited after the code", assert: function (s) { return s.accounts.A1.balance === 99500 || "balance " + s.accounts.A1.balance; } }]),
      mk("B.2", "Lost reply: resend with the same transaction ID", [{ do: function (sb) { openEv(sb); }, label: "Sale, reply lost", msg: "9100.1", req: { id_transazione: "RV1", tag: 1, tipo_tag: 5, FIRMA_DIG01: "ok", account: "A1", ID_GIOCATA: "GX1", price: 500, maxPay: 100000, lines: [{ event: 1, outcome: 7, odds: 250 }] }, fault: "drop-response", expect: null }, { label: "Resend", msg: "9100.1", req: { id_transazione: "RV1", tag: 1, tipo_tag: 5, FIRMA_DIG01: "ok", account: "A1", ID_GIOCATA: "GX1", price: 500, maxPay: 100000, lines: [{ event: 1, outcome: 7, odds: 250 }] }, expect: 1024, assert: function (s, r) { return (Object.keys(s.tickets).length === 1 && r.replayed) || "expected one ticket"; } }]),
      mk("B.3", "Repeated play ID", [{ do: function (sb) { openEv(sb); }, label: "First", msg: "9100.1", req: function () { return sale({ play: "SAME" }); }, expect: 1024 }, { label: "Second", msg: "9100.1", req: function () { return sale({ play: "SAME" }); }, expect: 3008 }]),
      mk("B.4", "Line and price rules", [{ do: function (sb) { openEv(sb); }, label: "21 lines", msg: "9100.1", req: function () { var l = []; for (var i = 0; i < 21; i++) l.push({ event: 1, outcome: 7, odds: 250 }); return sale({ lines: l }); }, expect: 3009 }, { label: "Price EUR 1.20", msg: "9100.1", req: function () { return sale({ price: 120 }); }, expect: 3006 }, { label: "Maximum win above EUR 50,000", msg: "9100.1", req: function () { return sale({ maxPay: 5000001 }); }, expect: 3007 }, { label: "Duplicate events", msg: "9100.1", req: function () { return sale({ lines: [{ event: 1, outcome: 7, odds: 250 }, { event: 1, outcome: 8, odds: 300 }] }); }, expect: 3005 }]),
      mk("B.5", "Event not playable", [{ label: "Sale on an unknown event", msg: "9100.1", req: function () { return sale({ lines: [{ event: 99, outcome: 7, odds: 250 }] }); }, expect: 3001 }]),
      mk("B.6", "Multiple across a multi-event", [{ do: function (sb) { openEv(sb); openEv(sb); sb.state.multi[1] = 1; }, label: "Event 1 is in a multi-event; a multiple with event 2", msg: "9100.1", req: function () { return sale({ lines: [{ event: 1, outcome: 7, odds: 250 }, { event: 2, outcome: 7, odds: 250 }] }); }, expect: 3015 }]),
      mk("B.7", "Account, terminal and signature", [{ do: function (sb) { openEv(sb); }, label: "Account blocked", msg: "9100.1", req: function () { return sale({ account: "A2" }); }, expect: 7010 }, { label: "Unknown account", msg: "9100.1", req: function () { return sale({ account: "A9" }); }, expect: 7009 }, { label: "TIPO_TAG 7", msg: "9100.1", req: function () { return sale({ tipo_tag: 7 }); }, expect: 1522 }, { label: "No signature", msg: "9100.1", req: function () { return sale({ sig: null }); }, expect: 1521 }]),
      mk("B.8", "Service closed", [{ do: function (sb) { openEv(sb); }, label: "Sale while closed", msg: "9100.1", req: function () { return sale(); }, fault: "closed", expect: 1517, assert: function (s) { return Object.keys(s.tickets).length === 0 || "a ticket exists"; } }]),
      mk("B.9", "No void after the code", [sell("N1"), { label: "Cancel the ticket", msg: "9100.4", req: function (sb) { return { id_transazione: tx(), id: tkt(sb) }; }, expect: 4004 }])
    ] },
    { id: "C", title: "Draw, results and closing", ticket: "Kit rules 26 to 28", messages: ["9000.3", "9000.4", "9000.5"], note: "The draw request closes betting; official results are checked against the totalisator.", cases: [
      mk("C.1", "Draw and results", [{ do: function (sb) { openEv(sb); }, label: "Results before the draw", msg: "9000.4", req: { id_transazione: "c11", event: 1, results: [7, 21, 33] }, expect: 2017 }, draw, { label: "Draw again", msg: "9000.3", req: { id_transazione: "c13", event: 1 }, expect: 2016 }, results([7, 21, 33])]),
      mk("C.2", "Results that differ", [{ do: function (sb) { openEv(sb); }, label: "Draw", msg: "9000.3", req: { id_transazione: "c21", event: 1 }, expect: 1024 }, { label: "Wrong results", msg: "9000.4", req: { id_transazione: "c22", event: 1, results: [1, 2, 3] }, expect: 2024, assert: function (s) { return s.events[1].suspended || "payments were not suspended"; } }]),
      mk("C.3", "Cancel an open or closed event", [{ do: function (sb) { openEv(sb); openEv(sb); }, label: "Cancel open event 1", msg: "9000.5", req: { id_transazione: "c31", event: 1 }, expect: 1024 }, { label: "Draw event 2", msg: "9000.3", req: { id_transazione: "c32", event: 2 }, expect: 1024 }, { label: "Cancel the closed event 2", msg: "9000.5", req: { id_transazione: "c33", event: 2 }, expect: 2016 }])
    ] },
    { id: "E", title: "Settlement in two steps", ticket: "Kit rules 29 to 33", messages: ["9100.2"], note: "Payment through PSV, then the PACG credit; the balance moves only after both positive replies.", cases: [
      mk("E.1", "Win paid once", [sell("E1"), draw, results([7, 21, 33]), { label: "Payment", msg: "9100.2", req: payq, expect: 1024, assert: function (s, r) { return r.paid === 1250 || "paid " + r.paid; } }, { label: "Payment again", msg: "9100.2", req: payq, expect: 5002 }]),
      mk("E.2", "Payment before the results", [sell("E2"), { label: "Payment", msg: "9100.2", req: payq, expect: 5003 }]),
      mk("E.3", "Lost ticket", [{ do: function (sb) { openEv(sb); }, label: "Sale on outcome 99", msg: "9100.1", req: function () { return sale({ play: "E3", lines: [{ event: 1, outcome: 99, odds: 250 }] }); }, expect: 1024 }, draw, results([7, 21, 33]), { label: "Payment", msg: "9100.2", req: payq, expect: 5000 }]),
      mk("E.4", "Refund on a cancelled event", [sell("E4"), { label: "Cancel the event", msg: "9000.5", req: { id_transazione: "e42", event: 1 }, expect: 1024 }, { label: "Refund", msg: "9100.2", req: payq, expect: 1024, assert: function (s, r) { return r.refunded === 500 || "refunded " + r.refunded; } }]),
      mk("E.5", "Suspended payment", [sell("E5"), draw, { label: "Wrong results", msg: "9000.4", req: { id_transazione: "e53", event: 1, results: [1, 2, 3] }, expect: 2024 }, { label: "Payment", msg: "9100.2", req: payq, expect: 5005 }])
    ] },
    { id: "F", title: "Recovery", ticket: "Kit rules 34 to 37", messages: ["9400.1"], note: "After a malfunction the morning job lists events left open or closed.", cases: [
      mk("F.1", "Events left open", [{ do: function (sb) { openEv(sb); openEv(sb); }, label: "9400.1", msg: "9400.1", req: { id_transazione: "f11" }, expect: 1024, assert: function (s, r) { return r.left.length === 2 || "left " + r.left.length; } }])
    ] },
    { id: "G", title: "Accounting and operations", ticket: "Kit rules 38 to 46", messages: ["9200.1", "9500.1", "9500.2"], note: "Daily statement, keep-alive every minute, integrity at least daily and after each patch.", cases: [
      mk("G.1", "Daily statement", [{ label: "9200.1", msg: "9200.1", req: { id_transazione: "g11" }, expect: 1024 }]),
      mk("G.2", "Keep-alive and integrity", [{ label: "9500.1", msg: "9500.1", req: { id_transazione: "g21" }, expect: 1024 }, { label: "9500.2 with matching hashes", msg: "9500.2", req: { id_transazione: "g22", components: [{ hash: "ok" }] }, expect: 1024 }, { label: "9500.2 with a different hash", msg: "9500.2", req: { id_transazione: "g23", components: [{ hash: "bad" }] }, expect: 7012 }])
    ] }
  ];
  var messages = [
    { id: "9000.1", name: "Programme", template: { id_transazione: "ff1", discipline: "football", date: "2026-11-20" } },
    { id: "9000.2", name: "Event opening", template: { id_transazione: "ff2", programme: 1, platform: "P1", date: "2026-11-20", weights: [500000, 500000], odds: [190, 190] } },
    { id: "9000.3", name: "Draw request", template: { id_transazione: "ff3", event: 1 } }, { id: "9000.4", name: "Official results", template: { id_transazione: "ff4", event: 1, results: [7, 21, 33] } },
    { id: "9100.1", name: "Sale", template: { id_transazione: "ff5", tag: 1, tipo_tag: 5, FIRMA_DIG01: "ok", account: "A1", ID_GIOCATA: "FF5", price: 500, maxPay: 100000, lines: [{ event: 1, outcome: 7, odds: 250 }] } },
    { id: "9100.2", name: "Payment or refund", template: { id_transazione: "ff6", FIRMA_DIG01: "ok", id: "" } }, { id: "9100.4", name: "Ticket cancellation", template: { id_transazione: "ff7", id: "" } }, { id: "9500.1", name: "Keep alive", template: { id_transazione: "ff8" } }
  ];
  var coverage = [
    { rule: "1, 2", text: "Programme code, one per discipline and day, one day ahead, blocked date", cases: ["A.1", "A.2"] }, { rule: "3 to 5", text: "Event opening, platform, weights and odds", cases: ["A.3"] }, { rule: "6", text: "Multi-event up to 10 events", cases: ["A.4"] },
    { rule: "8, 9", text: "Stake debited only after the ticket ID", cases: ["B.1"] }, { rule: "10", text: "No reply: resend with the same transaction ID", cases: ["B.2"] }, { rule: "11, 12, 13", text: "Lines, price, play ID", cases: ["B.3", "B.4"] },
    { rule: "16", text: "No cancellation of a remote bet (4004)", cases: ["B.9"] }, { rule: "19", text: "Duplicates and multiples across multi-events", cases: ["B.4", "B.6"] }, { rule: "21, 22", text: "Draw closes betting; results checked", cases: ["C.1", "C.2"] },
    { rule: "29 to 33", text: "Settlement and refunds", cases: ["E.1", "E.2", "E.3", "E.4", "E.5"] }, { rule: "34 to 37", text: "Cancellation and recovery", cases: ["C.3", "F.1"] }, { rule: "38 to 46", text: "Accounting and operations", cases: ["G.1", "G.2", "B.7", "B.8"] }
  ];
  g.BENCH = { id: "psv", title: "PSV Bench", subtitle: "Netbet Italy, CHG-375324, PSV v2.0 (fake data)", kitPage: "CHG-375324.html", startTime: "2026-11-20T09:00:00Z", closedCode: 1517, init: init, handle: function (s, m, q, sb) { var h = H[m]; return h ? h(s, q, sb) : no(1510, "Message not in this bench"); }, groups: groups, messages: messages, codes: codes, coverage: coverage };
})(typeof window !== "undefined" ? window : globalThis);
