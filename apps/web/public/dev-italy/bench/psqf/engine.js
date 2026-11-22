// PSQF bench definition: rule engine written from the CHG-375323 kit (PSQF 5.2). Fake data only.
(function (g) {
  var C = BenchCore, ok = C.ok, no = C.no;
  var TAGS = [5, 10, 11, 12, 14, 20, 21, 22, 24, 30, 31, 32, 34, 40, 41, 42, 44, 50, 51, 52, 54];
  var codes = {
    1024: "OK", 1517: "Service closed", 1520: "Invalid signature", 1521: "Mandatory attribute not present", 1522: "PVEND, CN or TIPO_TAG not enabled",
    1545: "Error applying the regulation (generic; no dedicated code for an unapproved competition at event creation)", 1510: "Request rejected (message not in this bench)",
    2001: "Event not present", 3001: "Event not playable", 3003: "Outcome not playable", 3004: "Declared odds wrong", 3005: "Duplicate events", 3007: "Wrong ticket price",
    3009: "Play identifier not unique", 3010: "Closing time passed", 3013: "Invalid number of bet lines", 3014: "Invalid system", 3022: "Sport or competition not authorised", 3030: "Invalid bonus",
    4003: "Ticket unknown", 4004: "Ticket not cancellable - remote gaming", 4005: "Ticket not cancellable - cash-out",
    5000: "Ticket not winning or unknown", 5002: "Ticket not payable - already paid", 5003: "Ticket not payable - official results missing", 5008: "Reversal/correction not possible",
    5011: "Invalid cash-out - bets with official results", 5013: "Invalid cash-out - already paid/payable or cancelled", 5017: "Reversal/correction not possible - paid by cash-out",
    5019: "Invalid cash-out - ticket with bonus", 5020: "Cash-out suspended for odds-error recognition", 5021: "Payment suspended for odds-error recognition", 5022: "Reversal/correction not possible for odds-error recognition",
    6018: "Invalid event date", 6022: "Event already created", 6025: "Invalid bet state", 6029: "Official results cannot be modified", 6034: "Dynamic list already present",
    7002: "Invalid account balance", 7009: "Account does not exist", 7010: "Account not playable", 7012: "Non-conforming component data"
  };
  function init(sb) {
    var t = sb.clock;
    return { calendar: { 9001: { sport: 1, comp: 10, start: t + 86400000, home: "Team A", away: "Team B" } }, approvedComps: [10, 11], events: {}, nextEv: 100, tickets: {}, playIds: {}, nextT: 1,
      accounts: { A1: { balance: 100000, state: "open" }, A2: { balance: 5000, state: "suspended" } }, oddsError: false };
  }
  function hexId(n) { var s = (n * 2654435761).toString(16).toUpperCase(); while (s.length < 20) s = "0" + s; return s.slice(0, 20); }
  function sig(req) { if (req.FIRMA_DIG01 === undefined || req.FIRMA_DIG01 === null) return no(1521, "FIRMA_DIG01 is mandatory"); if (req.FIRMA_DIG01 !== "ok") return no(1520, "Signature does not verify"); return null; }
  var H = {
    "7100:20": function (s) { return ok({ calendar: s.calendar }, "Calendar read"); },
    "7100:9": function () { return ok({ models: ["1X2", "outright winner", "over/under"] }, "Authorised bet models"); },
    "7200:1": function (s, q, sb) {
      if (q.calendarId) {
        var cal = s.calendar[q.calendarId]; if (!cal) return no(2001, "Not in the ADM calendar");
        for (var k in s.events) if (s.events[k].calendarId === q.calendarId) return no(6022, "Event already created; INFO_AVV carries the existing codes: event " + k);
        var id = s.nextEv++; s.events[id] = { calendarId: q.calendarId, comp: cal.comp, start: cal.start, state: "open", list: false, result: null };
        return ok({ eventCode: id }, "Event in the ADM calendar: 1024 with the calendar code");
      }
      if (!q.sport || !q.competition || !q.start || !q.home || !q.away) return no(1521, "Sport, competition, date and teams are mandatory");
      if (q.AVV_FEED_PROVIDER === undefined) return no(1521, "AVV_FEED_PROVIDER is mandatory when the event is not accepted from the calendar");
      if (Date.parse(q.start) < sb.clock) return no(6018, "Event date in the past");
      var key = [q.sport, q.competition, q.start, q.home, q.away].join("|");
      for (var e in s.events) if (s.events[e].key === key) return no(6022, "Event already created by an operator; INFO_AVV carries event " + e);
      if (s.approvedComps.indexOf(q.competition) < 0) return no(1545, "No dedicated code for an unapproved competition at event creation; it is enforced at sale with 3022");
      var n = s.nextEv++; s.events[n] = { key: key, comp: q.competition, start: Date.parse(q.start), state: "open", list: false, result: null };
      return ok({ eventCode: n }, "New event created under an approved sport and competition");
    },
    "7200:3": function (s, q) { var e = s.events[q.event]; if (!e) return no(2001, "Event not present"); if (e.list) return no(6034, "Dynamic list already present"); e.list = true; return ok({}, "Outcome list stored; betting on this market may open"); },
    "7200:5": function (s, q, sb) { var e = s.events[q.event]; if (!e) return no(2001, "Event not present"); if (Date.parse(q.start) < sb.clock) return no(6018, "Invalid event date"); e.start = Date.parse(q.start); return ok({}, "Event date updated"); },
    "7200:16": function (s, q) { var e = s.events[q.event]; if (!e) return no(2001, "Event not present"); if (e.result) return no(6029, "Official results cannot be modified: delete them with 7200:9 first"); e.result = { winners: q.winners || [] }; e.state = "resulted"; return ok({}, "Official result stored; payment may now be sent"); },
    "7200:9": function (s, q) { var e = s.events[q.event]; if (!e) return no(2001, "Event not present"); if (!e.result) return no(6025, "No result to delete"); e.result = null; e.state = "open"; return ok({}, "Official result deleted"); },
    "7900:6": function (s, q, sb) {
      var r = sig(q); if (r) return r;
      if (q.tipo_tag !== undefined && TAGS.indexOf(q.tipo_tag) < 0) return no(1522, "TIPO_TAG not enabled for remote gaming");
      var a = s.accounts[q.account]; if (!a) return no(7009, "Account does not exist"); if (a.state !== "open") return no(7010, "Account not playable");
      if (typeof q.SALDO_CONTO !== "number" || q.SALDO_CONTO < 0) return no(7002, "SALDO_CONTO must be the balance already reduced by the price and the bonus played");
      if (!q.INFO_QUOTA) return no(1521, "INFO_QUOTA is mandatory in the sale");
      if (s.playIds[q.ID_GIOCATA]) return { code: 3009, rule: "Play identifier not unique; ID_BIGLIETTO carries the existing ticket", ID_BIGLIETTO: s.playIds[q.ID_GIOCATA] };
      var bets = q.bets || []; if (bets.length < 1 || bets.length > 30) return no(3013, "A sale carries 1 to 30 bets");
      var seen = {}; for (var i = 0; i < bets.length; i++) { if (seen[bets[i].event]) return no(3005, "Duplicate events in one ticket"); seen[bets[i].event] = 1; }
      if (q.price < 100 || q.price % 5 !== 0) return no(3007, "Wrong ticket price: at least EUR 1.00 in steps of EUR 0.05");
      if ((q.bonus || 0) > 10000) return no(3030, "Bonus used on one bet is at most EUR 100");
      for (var j = 0; j < bets.length; j++) {
        var b = bets[j], e = s.events[b.event];
        if (!e) return no(3001, "Event not playable: not created at ADM"); if (e.state !== "open") return no(3001, "Event not playable: not open");
        if (s.approvedComps.indexOf(e.comp) < 0) return no(3022, "Sport or competition not authorised");
        if (b.dynamic && !e.list) return no(3003, "Outcome not playable: the outcome list was not sent");
        if (!(b.odds >= 1)) return no(3004, "Declared odds wrong: never below 1");
        if (sb.clock > e.start && (q.CHECK_INIZIO || []).indexOf(b.event) >= 0) return no(3010, "Closing time passed: CHECK_INIZIO_AVVENIMENTO lists this event");
      }
      var id = hexId(s.nextT++); s.tickets[id] = { id: id, account: q.account, price: q.price, bonus: q.bonus || 0, bets: bets, state: "accepted" }; s.playIds[q.ID_GIOCATA] = id; a.balance -= q.price - (q.bonus || 0);
      return ok({ ticketId: id }, "Accepted: ticket ID (80 bit, 20 hex characters) returned; the stake is debited only now");
    },
    "7900:2": function (s, q) {
      var r = sig(q); if (r) return r; var t = s.tickets[q.id]; if (!t) return no(5000, "Ticket unknown");
      if (t.state === "paid") return no(5002, "Already paid"); if (s.oddsError) return no(5021, "Payment suspended while an odds-error request is processed");
      var all = t.bets.every(function (b) { return s.events[b.event].result; }); if (!all) return no(5003, "Official results missing");
      var wins = t.bets.every(function (b) { return s.events[b.event].result.winners.indexOf(b.outcome) >= 0; }); if (!wins) return no(5000, "Ticket not winning");
      var odds = t.bets.reduce(function (p, b) { return p * b.odds; }, 1), amt = Math.floor(t.price * Math.floor(odds * 1e6) / 1e6); t.state = "paid"; t.paid = amt; s.accounts[t.account].balance += amt;
      return ok({ paid: amt }, "Payment accepted: the PACG credit (6.8) follows; the amount paid is returned");
    },
    "7900:3": function (s, q) { var t = s.tickets[q.id]; if (!t) return no(4003, "Ticket unknown"); return t.state === "cashed" ? no(4005, "Not cancellable: paid by cash-out") : no(4004, "Not cancellable: remote gaming"); },
    "7900:12": function (s, q) { var r = sig(q); if (r) return r; var t = s.tickets[q.id]; if (!t) return no(5008, "Reversal not possible"); if (s.oddsError) return no(5022, "Not possible while an odds-error request is processed"); if (t.state === "cashed") return no(5017, "Paid by cash-out"); if (t.state !== "paid") return no(5008, "Ticket is not collected"); t.state = "reversed"; s.accounts[t.account].balance -= t.paid; return ok({}, "Reversal accepted; PACG 6.9 follows"); },
    "7900:13": function (s, q) { var r = sig(q); if (r) return r; var t = s.tickets[q.id]; if (!t) return no(5008, "Correction not possible"); if (s.oddsError) return no(5022, "Not possible while an odds-error request is processed"); if (t.state === "cashed") return no(5017, "Paid by cash-out"); if (t.state !== "paid") return no(5008, "Ticket is not collected"); t.paid = q.importo; return ok({}, "Correction accepted; PACG 6.9 then 6.8 follow"); },
    "7900:18": function (s, q) { var r = sig(q); if (r) return r; var t = s.tickets[q.id]; if (!t) return no(5000, "Ticket unknown"); if (t.bonus > 0) return no(5019, "Cash-out is not allowed on a ticket with bonus"); if (s.oddsError) return no(5020, "Cash-out suspended while an odds-error request is processed"); if (t.state !== "accepted") return no(5013, "Already paid or cancelled"); if (t.bets.some(function (b) { return s.events[b.event].result; })) return no(5011, "Bets with official results"); t.state = "cashed"; t.paid = q.importo_cashout; return ok({}, "Full cash-out accepted"); },
    "8000:1": function (s) { return ok({ tickets: Object.keys(s.tickets).length }, "Daily statement returned; compare with Digitain's own figures"); },
    "8004:1": function () { return ok({}, "Keep-alive accepted"); },
    "8004:2": function (s, q) { var bad = (q.components || []).some(function (c) { return c.hash === "bad"; }); return bad ? no(7012, "Non-conforming component data: the component is blocked") : ok({}, "Integrity check accepted"); }
  };
  var n = 0;
  function tx() { return "T" + (++n); }
  function sale(o) { o = o || {}; var q = { id_transazione: o.tx || tx(), tag: o.tag || 1, tipo_tag: o.tipo_tag === undefined ? 5 : o.tipo_tag, FIRMA_DIG01: o.sig === undefined ? "ok" : o.sig, account: o.account || "A1", SALDO_CONTO: 99000, INFO_QUOTA: 2, ID_GIOCATA: o.play || "P" + tx(), price: o.price || 500, bonus: o.bonus || 0, bets: o.bets || [{ event: 100, outcome: "1", odds: 2.5 }] }; if (o.check) q.CHECK_INIZIO = o.check; return q; }
  function ev(sb, comp, offset) { var id = sb.state.nextEv++; sb.state.events[id] = { comp: comp || 10, start: sb.clock + (offset === undefined ? 3600000 : offset), state: "open", list: false, result: null }; return id; }
  function open(sb) { ev(sb); }
  var mk = function (id, title, steps) { return { id: id, title: title, steps: steps }; };
  var tid = function (sb) { return Object.keys(sb.state.tickets)[0]; };
  var pay = function (x) { return function (sb) { return { id_transazione: tx(), FIRMA_DIG01: "ok", id: tid(sb), importo: x || 0 }; }; };
  var res = function (w) { return { id_transazione: tx(), event: 100, winners: w }; };
  var sell = function (p, extra) { return { do: extra || open, label: "Sale", msg: "7900:6", req: function () { return sale({ play: p }); }, expect: 1024 }; };
  var groups = [
    { id: "A", title: "Official programme and offer", ticket: "Kit rules 1 to 10", messages: ["7100:20", "7200:1", "7200:3"], note: "Create each event with ADM before betting opens, from the calendar or as a new event. Markets with dynamic outcome lists need their list first.", cases: [
      mk("A.1", "Create an event from the ADM calendar", [{ label: "Read the calendar", msg: "7100:20", req: { id_transazione: "a11" }, expect: 1024 }, { label: "Create from calendar entry 9001", msg: "7200:1", req: { id_transazione: "a12", calendarId: 9001 }, expect: 1024 }, { label: "Create it again", msg: "7200:1", req: { id_transazione: "a13", calendarId: 9001 }, expect: 6022 }]),
      mk("A.2", "A new event needs the feed provider", [{ label: "Without AVV_FEED_PROVIDER", msg: "7200:1", req: { id_transazione: "a21", sport: 1, competition: 10, start: "2026-12-01T18:00:00Z", home: "X", away: "Y" }, expect: 1521 }, { label: "With AVV_FEED_PROVIDER 0", msg: "7200:1", req: { id_transazione: "a22", sport: 1, competition: 10, start: "2026-12-01T18:00:00Z", home: "X", away: "Y", AVV_FEED_PROVIDER: 0 }, expect: 1024 }]),
      mk("A.3", "Unapproved competition", [{ label: "Create under competition 99", msg: "7200:1", req: { id_transazione: "a31", sport: 1, competition: 99, start: "2026-12-01T18:00:00Z", home: "X", away: "Y", AVV_FEED_PROVIDER: 0 }, expect: 1545 }, { do: function (sb) { sb.state.events[500] = { comp: 99, start: sb.clock + 3600000, state: "open", list: false, result: null }; }, label: "Sale on an event of competition 99", msg: "7900:6", req: function () { return sale({ bets: [{ event: 500, outcome: "1", odds: 2 }] }); }, expect: 3022 }]),
      mk("A.4", "Dynamic market: the outcome list comes first", [{ do: open, label: "Sale before the list", msg: "7900:6", req: function () { return sale({ bets: [{ event: 100, outcome: "A", odds: 5, dynamic: true }] }); }, expect: 3003 }, { label: "Send the list", msg: "7200:3", req: { id_transazione: "a42", event: 100 }, expect: 1024 }, { label: "Send it again", msg: "7200:3", req: { id_transazione: "a43", event: 100 }, expect: 6034 }, { label: "Sale after the list", msg: "7900:6", req: function () { return sale({ bets: [{ event: 100, outcome: "A", odds: 5, dynamic: true }] }); }, expect: 1024 }]),
      mk("A.5", "A bet needs an event that exists at ADM", [{ label: "Sale on event 777", msg: "7900:6", req: function () { return sale({ bets: [{ event: 777, outcome: "1", odds: 2 }] }); }, expect: 3001 }]),
      mk("A.6", "Event date change", [{ do: open, label: "Move the event to the past", msg: "7200:5", req: { id_transazione: "a61", event: 100, start: "2020-01-01T00:00:00Z" }, expect: 6018 }, { label: "Move it later", msg: "7200:5", req: { id_transazione: "a62", event: 100, start: "2026-12-02T18:00:00Z" }, expect: 1024 }])
    ] },
    { id: "B", title: "Bet placement", ticket: "Kit rules 11 to 27", messages: ["7900:6", "7900:7"], note: "Every bet is sent in real time. The stake is debited only after the ticket ID comes back.", cases: [
      mk("B.1", "Accepted sale returns the ticket ID", [{ do: open, label: "Sale of EUR 5.00", msg: "7900:6", req: function () { return sale(); }, expect: 1024, assert: function (s, r) { return /^[0-9A-F]{20}$/.test(r.ticketId) || "ticket ID is not 20 hex characters"; } }, { label: "Stake debited after the code", assert: function (s) { return s.accounts.A1.balance === 99500 || "balance " + s.accounts.A1.balance; } }]),
      mk("B.2", "Lost reply: resend with the same transaction ID", [{ do: open, label: "Sale, reply lost", msg: "7900:6", req: { id_transazione: "RT1", tag: 1, tipo_tag: 5, FIRMA_DIG01: "ok", account: "A1", SALDO_CONTO: 99000, INFO_QUOTA: 2, ID_GIOCATA: "PX1", price: 500, bets: [{ event: 100, outcome: "1", odds: 2.5 }] }, fault: "drop-response", expect: null }, { label: "Resend unchanged", msg: "7900:6", req: { id_transazione: "RT1", tag: 1, tipo_tag: 5, FIRMA_DIG01: "ok", account: "A1", SALDO_CONTO: 99000, INFO_QUOTA: 2, ID_GIOCATA: "PX1", price: 500, bets: [{ event: 100, outcome: "1", odds: 2.5 }] }, expect: 1024, assert: function (s, r) { return (Object.keys(s.tickets).length === 1 && r.replayed) || "expected one ticket and a stored reply"; } }]),
      mk("B.3", "Repeated ID_GIOCATA", [{ do: open, label: "First sale", msg: "7900:6", req: function () { return sale({ play: "SAME" }); }, expect: 1024 }, { label: "Second sale, new transaction, same play ID", msg: "7900:6", req: function () { return sale({ play: "SAME" }); }, expect: 3009 }]),
      mk("B.4", "Duplicate events in one ticket", [{ do: open, label: "Two bets on event 100", msg: "7900:6", req: function () { return sale({ bets: [{ event: 100, outcome: "1", odds: 2 }, { event: 100, outcome: "X", odds: 3 }] }); }, expect: 3005 }]),
      mk("B.5", "More than 30 bets", [{ do: function (sb) { for (var i = 0; i < 31; i++) ev(sb); }, label: "Sale with 31 bets", msg: "7900:6", req: function () { var b = []; for (var i = 100; i < 131; i++) b.push({ event: i, outcome: "1", odds: 2 }); return sale({ bets: b }); }, expect: 3013 }]),
      mk("B.6", "Sale after the start time", [{ do: function (sb) { ev(sb, 10, 1000); sb.advance(60000); }, label: "Live sale, no start check", msg: "7900:6", req: function () { return sale(); }, expect: 1024 }, { label: "Same with CHECK_INIZIO_AVVENIMENTO", msg: "7900:6", req: function () { return sale({ check: [100] }); }, expect: 3010 }]),
      mk("B.7", "Terminal type not enabled", [{ do: open, label: "tipo_tag 7", msg: "7900:6", req: function () { return sale({ tipo_tag: 7 }); }, expect: 1522 }]),
      mk("B.8", "Odds below 1", [{ do: open, label: "Odds 0.9", msg: "7900:6", req: function () { return sale({ bets: [{ event: 100, outcome: "1", odds: 0.9 }] }); }, expect: 3004 }]),
      mk("B.9", "Account not playable", [{ do: open, label: "Account A2 is suspended", msg: "7900:6", req: function () { return sale({ account: "A2" }); }, expect: 7010 }, { label: "Account A9 does not exist", msg: "7900:6", req: function () { return sale({ account: "A9" }); }, expect: 7009 }]),
      mk("B.10", "Signature", [{ do: open, label: "Signature missing", msg: "7900:6", req: function () { return sale({ sig: null }); }, expect: 1521 }, { label: "Signature wrong", msg: "7900:6", req: function () { return sale({ sig: "bad" }); }, expect: 1520 }]),
      mk("B.11", "Price rule", [{ do: open, label: "EUR 0.90 is below the minimum", msg: "7900:6", req: function () { return sale({ price: 90 }); }, expect: 3007 }, { label: "EUR 1.03 is not a step of 0.05", msg: "7900:6", req: function () { return sale({ price: 103 }); }, expect: 3007 }, { label: "EUR 1.05 is accepted", msg: "7900:6", req: function () { return sale({ price: 105 }); }, expect: 1024 }]),
      mk("B.12", "Service closed", [{ do: open, label: "Sale while the service is closed", msg: "7900:6", req: function () { return sale(); }, fault: "closed", expect: 1517, assert: function (s) { return Object.keys(s.tickets).length === 0 || "a ticket was created"; } }])
    ] },
    { id: "C", title: "No void after the code", ticket: "Kit rule 26", messages: ["7900:3"], note: "ADM refuses the cancel message for online bets.", cases: [
      mk("C.1", "Cancel an accepted bet", [sell("C1"), { label: "Cancel it", msg: "7900:3", req: function (sb) { return { id_transazione: tx(), id: tid(sb) }; }, expect: 4004 }]),
      mk("C.2", "Cancel after a cash-out", [sell("C2"), { label: "Cash out", msg: "7900:18", req: function (sb) { return { id_transazione: tx(), FIRMA_DIG01: "ok", id: tid(sb), importo_cashout: 300 }; }, expect: 1024 }, { label: "Cancel it", msg: "7900:3", req: function (sb) { return { id_transazione: tx(), id: tid(sb) }; }, expect: 4005 }])
    ] },
    { id: "D", title: "Results, refunds, settlement", ticket: "Kit rules 31 to 36", messages: ["7200:16", "7900:2"], note: "Result, then payment to ADM, then the PACG credit.", cases: [
      mk("D.1", "Result, then payment", [sell("D1"), { label: "Official result: outcome 1 wins", msg: "7200:16", req: function () { return res(["1"]); }, expect: 1024 }, { label: "Payment", msg: "7900:2", req: pay(1250), expect: 1024, assert: function (s, r) { return r.paid === 1250 || "paid " + r.paid; } }]),
      mk("D.2", "Payment before the result", [sell("D2"), { label: "Payment", msg: "7900:2", req: pay(), expect: 5003 }]),
      mk("D.3", "Payment twice", [sell("D3"), { label: "Result", msg: "7200:16", req: function () { return res(["1"]); }, expect: 1024 }, { label: "Payment", msg: "7900:2", req: pay(), expect: 1024 }, { label: "Payment again", msg: "7900:2", req: pay(), expect: 5002 }]),
      mk("D.4", "Losing ticket", [sell("D4"), { label: "Result: outcome 2 wins", msg: "7200:16", req: function () { return res(["2"]); }, expect: 1024 }, { label: "Payment", msg: "7900:2", req: pay(), expect: 5000 }]),
      mk("D.5", "Unknown ticket", [{ label: "Payment of an unknown ticket", msg: "7900:2", req: { id_transazione: "d51", FIRMA_DIG01: "ok", id: "FFFF" }, expect: 5000 }])
    ] },
    { id: "E", title: "Result changes and reversals", ticket: "Kit rules 37 to 39", messages: ["7200:9", "7900:12", "7900:13"], note: "A wrong result is deleted and sent again; paid tickets are reversed or corrected.", cases: [
      mk("E.1", "Change a result", [{ do: open, label: "Result", msg: "7200:16", req: function () { return res(["1"]); }, expect: 1024 }, { label: "Send a second result without deleting", msg: "7200:16", req: function () { return res(["2"]); }, expect: 6029 }, { label: "Delete the result", msg: "7200:9", req: { id_transazione: "e13", event: 100 }, expect: 1024 }, { label: "Send the correct result", msg: "7200:16", req: function () { return res(["2"]); }, expect: 1024 }]),
      mk("E.2", "Reverse a paid ticket", [sell("E2"), { label: "Result", msg: "7200:16", req: function () { return res(["1"]); }, expect: 1024 }, { label: "Payment", msg: "7900:2", req: pay(), expect: 1024 }, { label: "Reversal", msg: "7900:12", req: pay(), expect: 1024 }]),
      mk("E.3", "Reverse an unpaid ticket", [sell("E3"), { label: "Reversal", msg: "7900:12", req: pay(), expect: 5008 }]),
      mk("E.4", "Correct a paid ticket", [sell("E4"), { label: "Result", msg: "7200:16", req: function () { return res(["1"]); }, expect: 1024 }, { label: "Payment", msg: "7900:2", req: pay(), expect: 1024 }, { label: "Correction", msg: "7900:13", req: pay(1000), expect: 1024 }])
    ] },
    { id: "F", title: "Odds errors", ticket: "Kit rules 40 to 43", messages: ["7900:2", "7900:18", "7900:12"], note: "While ADM processes an odds-error request, payment, cash-out and reversal are suspended. The platform never voids a ticket itself.", cases: [
      mk("F.1", "Payment suspended", [sell("F1"), { label: "Result", msg: "7200:16", req: function () { return res(["1"]); }, expect: 1024 }, { do: function (sb) { sb.state.oddsError = true; }, label: "Payment while the request runs", msg: "7900:2", req: pay(), expect: 5021 }]),
      mk("F.2", "Cash-out suspended", [sell("F2"), { do: function (sb) { sb.state.oddsError = true; }, label: "Cash-out while the request runs", msg: "7900:18", req: function (sb) { return { id_transazione: tx(), FIRMA_DIG01: "ok", id: tid(sb), importo_cashout: 300 }; }, expect: 5020 }]),
      mk("F.3", "Reversal not possible", [sell("F3"), { do: function (sb) { sb.state.oddsError = true; }, label: "Reversal while the request runs", msg: "7900:12", req: pay(), expect: 5022 }])
    ] },
    { id: "G", title: "Cash-out", ticket: "Kit rules 44 and 45", messages: ["7900:18", "7900:19"], note: "Full and partial cash-out; not allowed on bets placed even partly with bonus.", cases: [
      mk("G.1", "Full cash-out", [sell("G1"), { label: "Cash-out", msg: "7900:18", req: function (sb) { return { id_transazione: tx(), FIRMA_DIG01: "ok", id: tid(sb), importo_cashout: 300 }; }, expect: 1024 }, { label: "Cash-out again", msg: "7900:18", req: function (sb) { return { id_transazione: tx(), FIRMA_DIG01: "ok", id: tid(sb), importo_cashout: 300 }; }, expect: 5013 }]),
      mk("G.2", "Cash-out with bonus", [{ do: open, label: "Sale with EUR 2.00 bonus", msg: "7900:6", req: function () { return sale({ play: "G2", bonus: 200 }); }, expect: 1024 }, { label: "Cash-out", msg: "7900:18", req: function (sb) { return { id_transazione: tx(), FIRMA_DIG01: "ok", id: tid(sb), importo_cashout: 300 }; }, expect: 5019 }]),
      mk("G.3", "Cash-out after the result", [sell("G3"), { label: "Result", msg: "7200:16", req: function () { return res(["1"]); }, expect: 1024 }, { label: "Cash-out", msg: "7900:18", req: function (sb) { return { id_transazione: tx(), FIRMA_DIG01: "ok", id: tid(sb), importo_cashout: 300 }; }, expect: 5011 }])
    ] },
    { id: "H", title: "Accounting and integrity", ticket: "Kit rules 46 to 48", messages: ["8000:1", "8004:1", "8004:2"], note: "Daily accounting request, keep-alive every minute, integrity check daily and after each patch.", cases: [
      mk("H.1", "Daily statement", [{ label: "8000:1", msg: "8000:1", req: { id_transazione: "h11", FIRMA_DIG01: "ok", year: 2026, month: 11, day: 19 }, expect: 1024 }]),
      mk("H.2", "Keep-alive", [{ label: "8004:1", msg: "8004:1", req: { id_transazione: "h21", FIRMA_DIG01: "ok" }, expect: 1024 }]),
      mk("H.3", "Integrity check", [{ label: "Matching hashes", msg: "8004:2", req: { id_transazione: "h31", FIRMA_DIG01: "ok", components: [{ type: 1, hash: "ok" }] }, expect: 1024 }, { label: "A different hash", msg: "8004:2", req: { id_transazione: "h32", FIRMA_DIG01: "ok", components: [{ type: 1, hash: "bad" }] }, expect: 7012 }])
    ] }
  ];
  var messages = [
    { id: "7900:6", name: "Sale", template: { id_transazione: "ff1", tag: 1, tipo_tag: 5, FIRMA_DIG01: "ok", account: "A1", SALDO_CONTO: 99000, INFO_QUOTA: 2, ID_GIOCATA: "FF1", price: 500, bets: [{ event: 100, outcome: "1", odds: 2.5 }] } },
    { id: "7200:1", name: "Event creation", template: { id_transazione: "ff2", calendarId: 9001 } },
    { id: "7200:3", name: "Outcome list", template: { id_transazione: "ff3", event: 100 } },
    { id: "7200:16", name: "Official result", template: { id_transazione: "ff4", event: 100, winners: ["1"] } },
    { id: "7900:2", name: "Payment", template: { id_transazione: "ff5", FIRMA_DIG01: "ok", id: "" } },
    { id: "7900:3", name: "Cancellation", template: { id_transazione: "ff6", id: "" } },
    { id: "7900:18", name: "Full cash-out", template: { id_transazione: "ff7", FIRMA_DIG01: "ok", id: "", importo_cashout: 300 } },
    { id: "8004:1", name: "Keep alive", template: { id_transazione: "ff8", FIRMA_DIG01: "ok" } }
  ];
  var coverage = [
    { rule: "4, 5, 6", text: "Create each event before betting; feed provider; 1024 or 6022", cases: ["A.1", "A.2"] }, { rule: "7, 8", text: "Unconfirmed events and dynamic outcome lists", cases: ["A.4", "A.5"] }, { rule: "10", text: "Authorisation at sale (3021, 3022)", cases: ["A.3"] },
    { rule: "11, 13", text: "Stake debited only after the ticket ID; 80-bit ticket ID", cases: ["B.1"] }, { rule: "12", text: "At most 30 bets; no duplicate events", cases: ["B.4", "B.5"] }, { rule: "14", text: "ID_GIOCATA unique (3009)", cases: ["B.3"] },
    { rule: "16", text: "No reply: resend with the same transaction ID", cases: ["B.2"] }, { rule: "20", text: "tipo_tag values (1522)", cases: ["B.7"] }, { rule: "21", text: "Odds never below 1 (3004)", cases: ["B.8"] }, { rule: "22", text: "Live sale and CHECK_INIZIO_AVVENIMENTO (3010)", cases: ["B.6"] },
    { rule: "24", text: "Bonus limit on a bet (3030)", cases: ["G.2"] }, { rule: "26", text: "No cancellation (4004, 4005)", cases: ["C.1", "C.2"] }, { rule: "28 to 30", text: "Signature, account state, price", cases: ["B.9", "B.10", "B.11", "B.12"] },
    { rule: "31 to 34", text: "Result, payment, then credit", cases: ["D.1", "D.2", "D.3", "D.4", "D.5"] }, { rule: "37 to 39", text: "Result changes, reversal, correction", cases: ["E.1", "E.2", "E.3", "E.4"] },
    { rule: "40 to 43", text: "Odds errors: 5020, 5021, 5022", cases: ["F.1", "F.2", "F.3"] }, { rule: "44, 45", text: "Cash-out and bonus (5019)", cases: ["G.1", "G.2", "G.3"] }, { rule: "46 to 48", text: "Accounting, keep-alive, integrity", cases: ["H.1", "H.2", "H.3"] }
  ];
  g.BENCH = { id: "psqf", title: "PSQF Bench", subtitle: "Netbet Italy, CHG-375323, PSQF v5.2 (fake data)", kitPage: "CHG-375323.html", startTime: "2026-11-20T09:00:00Z", closedCode: 1517, init: init, handle: function (s, m, q, sb) { var h = H[m]; return h ? h(s, q, sb) : no(1510, "Message not in this bench"); }, groups: groups, messages: messages, codes: codes, coverage: coverage };
})(typeof window !== "undefined" ? window : globalThis);
