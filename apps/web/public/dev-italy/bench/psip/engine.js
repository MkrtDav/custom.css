// PSIP bench definition: rule engine written from the CHG-375325 kit (PSIP 3.0 of 3 September 2026). Fake data only.
(function (g) {
  var C = BenchCore, ok = C.ok, no = C.no;
  var TAGS = [5, 10, 11, 12, 14, 20, 21, 22, 24, 30, 31, 32, 34, 40, 41, 42, 44, 50, 51, 52, 54];
  var codes = {
    1024: "No error", 1517: "Service closed", 1518: "Formal data error", 1520: "Signature not valid", 1521: "Mandatory attribute not present", 1522: "PVEND, CN or TIPO_TAG not enabled for the operation", 1546: "Bonus not valid", 1510: "Request rejected (message not in this bench)",
    2005: "Notification does not exist", 3001: "Event not playable", 3005: "Declared odds wrong", 3008: "Play identifier not unique", 3009: "System not compatible or bet type not acceptable", 3011: "Number of bet lines not valid", 3013: "CONTO_2 attribute inconsistent",
    4004: "Ticket cannot be cancelled: remote gaming", 5000: "Ticket not winning or not found", 5002: "Not payable: already paid", 5003: "Not payable: official results missing", 5004: "Not payable: cancelled", 5006: "Payments suspended", 5009: "Reversal or correction not allowed",
    7002: "Account balance not valid", 7009: "Account does not exist", 7010: "Account not playable", 7012: "Component data not compliant",
    "P-STAKE": "Platform check: stake rule (not a PSIP code)", "P-STRUCT": "Platform check: bet shape (not a PSIP code)", "P-ODDS": "Platform check: odds (not a PSIP code)", "P-MARGIN": "Platform check: bookmaker margin above ADM's ceiling (not a PSIP code)"
  };
  function init() { return { events: { 1: { state: 2, race: "R1", runners: 8, results: null }, 2: { state: 3 }, 3: { state: 7 } }, tickets: {}, plays: {}, nextT: 1, accounts: { A1: { balance: 100000, state: "open" }, A2: { balance: 0, state: "suspended" } }, paySuspended: false }; }
  function sig(q) { if (q.FIRMA_DIG01 === undefined || q.FIRMA_DIG01 === null) return no(1521, "FIRMA_DIG01 is mandatory"); if (q.FIRMA_DIG01 !== "ok") return no(1520, "Signature does not verify"); return null; }
  function payoutSingle(stake, oddsH) { return Math.floor(stake * oddsH / 100); }
  function payoutMulti(stake, oddsHs) { var P = 1, i; for (i = 0; i < oddsHs.length; i++) P *= oddsHs[i]; var p6 = Math.floor(P * 1e6 / Math.pow(100, oddsHs.length)); return Math.floor(stake * p6 / 1e6); }
  var CEIL = [[2, 3, 12700], [4, 7, 13900], [8, 9, 14300], [10, 14, 14700], [15, 99, 15600]];
  var H = {
    "3000.2": function (s, q) { var e = s.events[q.event]; if (!e) return no(1518, "Event not in the programme"); return ok({ state: e.state }, "Event read"); },
    "3001.11": function (s, q) { return q.id === 1 ? ok({}, "Notification returned") : no(2005, "Notification does not exist (last seven days only)"); },
    "check:bet": function (s, q) {
      var r = q.kind;
      if (r === "single" || r === "multiple") {
        if (q.stake % 300 !== 0 || q.stake < 300) return no("P-STAKE", "A fixed-odds horse ticket costs EUR 3 or a multiple of EUR 3");
        if (r === "multiple" && q.selections > 20) return no("P-STRUCT", "A multiple has at most 20 selections");
      }
      if (r === "system") { if (q.unit !== 25) return no("P-STAKE", "System unit stake is EUR 0.25"); if (q.total < 300) return no("P-STAKE", "A system ticket is at least EUR 3.00"); if (q.races > 30) return no("P-STRUCT", "A system covers at most 30 races"); if (q.total !== q.unit * q.bets) return no("P-STAKE", "The price is the sum of all bets: unit stake times bets"); }
      if ((q.odds || []).some(function (o) { return o < 100; })) return no("P-ODDS", "Odds are never below 1.00");
      return ok({}, "Bet passes the platform checks");
    },
    "check:market": function (s, q) {
      var runners = q.odds.filter(function (o) { return o < 5000; }), total = Math.round(runners.reduce(function (p, o) { return p + 10000 / o * 100; }, 0)), n = q.odds.length, c = CEIL.filter(function (x) { return n >= x[0] && n <= x[1]; })[0];
      return total > c[2] ? no("P-MARGIN", "Margin " + (total / 100) + "% is above the ceiling " + (c[2] / 100) + "%") : ok({ margin: total / 100 }, "Margin " + (total / 100) + "% is within the ceiling " + (c[2] / 100) + "%");
    },
    "3011.5": function (s, q) {
      var r = sig(q); if (r) return r;
      if (q.tipo_tag !== undefined && TAGS.indexOf(q.tipo_tag) < 0) return no(1522, "TIPO_TAG not enabled for remote gaming");
      var a = s.accounts[q.account]; if (!a) return no(7009, "Account does not exist"); if (a.state !== "open") return no(7010, "Account not playable");
      if (q.CONTO_2 === undefined || q.SALDO_CONTO === undefined || q.IP_VENDITA_GIOCATORE === undefined) return no(1521, "CONTO_2, SALDO_CONTO and IP_VENDITA_GIOCATORE are mandatory for remote gaming");
      if (q.CONTO_2 !== q.account) return no(3013, "CONTO_2 inconsistent with the account"); if (q.SALDO_CONTO < 0) return no(7002, "SALDO_CONTO must be the balance after the price and bonus played");
      if (q.bonusInvalid) return no(1546, "Bonus not valid"); if (s.plays[q.ID_GIOCATA]) return no(3008, "Play identifier not unique");
      var l = q.entries || []; if (l.length < 1 || l.length > 20) return no(3011, "A sale carries 1 to 20 entries");
      for (var i = 0; i < l.length; i++) { var e = s.events[l[i].event]; if (!e || e.state !== 2) return no(3001, "Event not playable: acceptance is open only in state AP"); if (l[i].odds < 100) return no(3005, "Declared odds wrong"); }
      var id = "T" + String(s.nextT++).padStart(11, "0"); s.tickets[id] = { id: id, account: q.account, price: q.price, entries: l, state: "issued" }; s.plays[q.ID_GIOCATA] = id; a.balance -= q.price;
      return ok({ id: id, TAG_MOV: [{ caus: 1, imp: q.price }] }, "Accepted: ticket code returned with TAG_MOV reason 1 (issued); the stake is debited only now");
    },
    "3011.6": function (s, q) {
      var r = sig(q); if (r) return r; if (!s.accounts[q.account]) return no(7009, "Account does not exist");
      if ((q.baseEvents || 0) > 30 || (q.multiples || 0) > 2000 || (q.bodyBytes || 0) > 2000) return no(3009, "System sale: at most 30 base events, 2000 multiples, body 2000 bytes");
      return ok({}, "System sale accepted");
    },
    "3011.7": function (s, q) {
      var r = sig(q); if (r) return r; var t = s.tickets[q.id]; if (!t) return no(5000, "Ticket not found"); if (t.state === "paid") return no(5002, "Already paid"); if (t.state === "cancelled") return no(5004, "Cancelled");
      if (s.paySuspended) return no(5006, "Payments suspended"); var res = t.entries.every(function (x) { return s.events[x.event].results; }); if (!res) return no(5003, "Official results missing");
      var ok1 = t.entries.every(function (x) { return s.events[x.event].results.winners.indexOf(x.outcome) >= 0; }); if (!ok1) return no(5000, "Ticket not winning");
      var amt = t.entries.length === 1 ? payoutSingle(t.price, t.entries[0].odds) : payoutMulti(t.price, t.entries.map(function (x) { return x.odds; })); t.state = "paid"; t.paid = amt;
      return ok({ TAG_MOV: [{ caus: 3, imp: amt }], amount: amt }, "Payment accepted: TAG_MOV reason 3 (paid) with the amount; the PACG credit 6.8 follows, then the account is credited");
    },
    "3011.3": function (s, q) { return s.tickets[q.id] ? no(4004, "Ticket cannot be cancelled: remote gaming") : no(5000, "Ticket not found"); },
    "3011.12": function (s, q) { var r = sig(q); if (r) return r; var t = s.tickets[q.id]; if (!t || t.state !== "paid") return no(5009, "Reversal not allowed: the ticket is not collected"); t.state = "reversed"; return ok({}, "Reversal accepted; PACG 6.9 follows"); },
    "3011.13": function (s, q) { var r = sig(q); if (r) return r; var t = s.tickets[q.id]; if (!t || t.state !== "paid") return no(5009, "Correction not allowed: the ticket is not collected"); t.paid = q.importo; return ok({ amount: q.importo }, "Correction accepted; PACG 6.9 reverses the old credit, then 6.8 credits the amount now due"); },
    "3500.1": function (s) { return ok({ tickets: Object.keys(s.tickets).length }, "Daily statement returned; reasons 16, 40 and 41 come with game type 0"); },
    "3600.5": function (s, q) { if (q.count > 250) return no(1518, "At most 250 tickets per request"); return ok({}, "Uncollected tickets list"); },
    "3900.1": function () { return ok({}, "Keep-alive accepted (once a minute)"); },
    "3900.2": function (s, q) { return (q.components || []).some(function (c) { return c.hash === "bad"; }) ? no(7012, "Component data not compliant (7012 in the return-code table)") : ok({}, "Integrity check accepted"); }
  };
  var n = 0, tx = function () { return "I" + (++n); };
  var sale = function (o) { o = o || {}; return { id_transazione: tx(), tag: 1, tipo_tag: o.tipo_tag === undefined ? 5 : o.tipo_tag, FIRMA_DIG01: o.sig === undefined ? "ok" : o.sig, account: o.account || "A1", CONTO_2: o.conto || o.account || "A1", SALDO_CONTO: o.saldo === undefined ? 99000 : o.saldo, IP_VENDITA_GIOCATORE: "10.0.0.1", ID_GIOCATA: o.play || "G" + tx(), price: o.price || 300, bonusInvalid: o.bonusInvalid, entries: o.entries || [{ event: 1, outcome: "H1", odds: 235 }] }; };
  var mk = function (id, title, steps) { return { id: id, title: title, steps: steps }; };
  var tk = function (sb) { return Object.keys(sb.state.tickets)[0]; };
  var pq = function (x) { return function (sb) { return { id_transazione: tx(), FIRMA_DIG01: "ok", id: tk(sb), importo: x }; }; };
  var sell = function (p, entries, price) { return { label: "Sale", msg: "3011.5", req: function () { return sale({ play: p, entries: entries, price: price }); }, expect: 1024 }; };
  var result = function (w) { return { do: function (sb) { sb.state.events[1].results = { winners: w }; sb.state.events[1].state = 4; }, label: "Official result arrives (3000.7)" }; };
  var chk = function (label, q, exp) { return { label: label, msg: "check:bet", req: q, expect: exp }; };
  var groups = [
    { id: "A", title: "Programme and betting window", ticket: "Kit rules 8 to 10", messages: ["3000.2", "3001.11"], note: "Only events in state AP can be sold. Missed notifications are recovered on request.", cases: [
      mk("A.1", "Read an event", [{ label: "3000.2", msg: "3000.2", req: { id_transazione: "a11", event: 1 }, expect: 1024 }, { label: "Unknown event", msg: "3000.2", req: { id_transazione: "a12", event: 99 }, expect: 1518 }]),
      mk("A.2", "A sale needs state AP", [{ label: "Event 2 is closed (CH)", msg: "3011.5", req: function () { return sale({ entries: [{ event: 2, outcome: "H1", odds: 200 }] }); }, expect: 3001 }, { label: "Event 3 is cancelled (AN)", msg: "3011.5", req: function () { return sale({ entries: [{ event: 3, outcome: "H1", odds: 200 }] }); }, expect: 3001 }, { label: "Event 1 is open (AP)", msg: "3011.5", req: function () { return sale(); }, expect: 1024 }]),
      mk("A.3", "Recover a notification", [{ label: "Notification 1", msg: "3001.11", req: { id_transazione: "a31", id: 1 }, expect: 1024 }, { label: "Notification 9", msg: "3001.11", req: { id_transazione: "a32", id: 9 }, expect: 2005 }])
    ] },
    { id: "B", title: "Bet placement", ticket: "Kit rules 20 to 27", messages: ["3011.5", "3011.6"], note: "Validate first, then move money: the stake is debited only after esito 1024 with the ticket code.", cases: [
      mk("B.1", "Accepted sale", [{ label: "3011.5", msg: "3011.5", req: function () { return sale(); }, expect: 1024, assert: function (s, r) { return (r.TAG_MOV[0].caus === 1) || "TAG_MOV reason 1 expected"; } }, { label: "Stake debited after the code", assert: function (s) { return s.accounts.A1.balance === 99700 || "balance " + s.accounts.A1.balance; } }]),
      mk("B.2", "Lost reply: resend with the same transaction ID", [{ label: "Sale, reply lost", msg: "3011.5", req: { id_transazione: "RI1", tag: 1, tipo_tag: 5, FIRMA_DIG01: "ok", account: "A1", CONTO_2: "A1", SALDO_CONTO: 99000, IP_VENDITA_GIOCATORE: "10.0.0.1", ID_GIOCATA: "GX", price: 300, entries: [{ event: 1, outcome: "H1", odds: 235 }] }, fault: "drop-response", expect: null }, { label: "Resend", msg: "3011.5", req: { id_transazione: "RI1", tag: 1, tipo_tag: 5, FIRMA_DIG01: "ok", account: "A1", CONTO_2: "A1", SALDO_CONTO: 99000, IP_VENDITA_GIOCATORE: "10.0.0.1", ID_GIOCATA: "GX", price: 300, entries: [{ event: 1, outcome: "H1", odds: 235 }] }, expect: 1024, assert: function (s, r) { return (Object.keys(s.tickets).length === 1 && r.replayed) || "expected one ticket"; } }]),
      mk("B.3", "Repeated play ID", [{ label: "First", msg: "3011.5", req: function () { return sale({ play: "SAME" }); }, expect: 1024 }, { label: "Second", msg: "3011.5", req: function () { return sale({ play: "SAME" }); }, expect: 3008 }]),
      mk("B.4", "Mandatory remote attributes", [{ label: "No SALDO_CONTO", msg: "3011.5", req: function () { var q = sale(); delete q.SALDO_CONTO; return q; }, expect: 1521 }, { label: "CONTO_2 differs from the account", msg: "3011.5", req: function () { return sale({ conto: "A9" }); }, expect: 3013 }, { label: "Negative balance", msg: "3011.5", req: function () { return sale({ saldo: -5 }); }, expect: 7002 }, { label: "Bonus not valid", msg: "3011.5", req: function () { return sale({ bonusInvalid: true }); }, expect: 1546 }]),
      mk("B.5", "Account, terminal, signature", [{ label: "Suspended account", msg: "3011.5", req: function () { return sale({ account: "A2" }); }, expect: 7010 }, { label: "Unknown account", msg: "3011.5", req: function () { return sale({ account: "A9" }); }, expect: 7009 }, { label: "TIPO_TAG 7", msg: "3011.5", req: function () { return sale({ tipo_tag: 7 }); }, expect: 1522 }, { label: "Wrong signature", msg: "3011.5", req: function () { return sale({ sig: "bad" }); }, expect: 1520 }]),
      mk("B.6", "Entries and odds", [{ label: "21 entries", msg: "3011.5", req: function () { var e = []; for (var i = 0; i < 21; i++) e.push({ event: 1, outcome: "H" + i, odds: 200 }); return sale({ entries: e }); }, expect: 3011 }, { label: "Odds below 1.00", msg: "3011.5", req: function () { return sale({ entries: [{ event: 1, outcome: "H1", odds: 90 }] }); }, expect: 3005 }]),
      mk("B.7", "System sale limits", [{ label: "31 base events", msg: "3011.6", req: { id_transazione: "b71", FIRMA_DIG01: "ok", account: "A1", baseEvents: 31 }, expect: 3009 }, { label: "2001 multiples", msg: "3011.6", req: { id_transazione: "b72", FIRMA_DIG01: "ok", account: "A1", multiples: 2001 }, expect: 3009 }, { label: "30 events, 2000 multiples", msg: "3011.6", req: { id_transazione: "b73", FIRMA_DIG01: "ok", account: "A1", baseEvents: 30, multiples: 2000 }, expect: 1024 }]),
      mk("B.8", "Service closed", [{ label: "Sale while closed", msg: "3011.5", req: function () { return sale(); }, fault: "closed", expect: 1517, assert: function (s) { return Object.keys(s.tickets).length === 0 || "a ticket exists"; } }]),
      mk("B.9", "No void after the code", [sell("N1"), { label: "Cancel", msg: "3011.3", req: function (sb) { return { id_transazione: tx(), id: tk(sb) }; }, expect: 4004 }])
    ] },
    { id: "C", title: "Horse rules outside PSIP", ticket: "Kit rules 11 to 19", messages: ["check:bet", "check:market"], note: "These are platform checks run before a bet is sent. PSIP has no field for them.", cases: [
      mk("C.1", "Stake in multiples of EUR 3", [chk("EUR 3", { kind: "single", stake: 300, odds: [235] }, 1024), chk("EUR 6", { kind: "single", stake: 600, odds: [235] }, 1024), chk("EUR 9", { kind: "single", stake: 900, odds: [235] }, 1024), chk("EUR 5", { kind: "single", stake: 500, odds: [235] }, "P-STAKE")]),
      mk("C.2", "System stakes", [chk("Unit 0.25, 12 bets, EUR 3.00", { kind: "system", unit: 25, bets: 12, total: 300, races: 3, odds: [200] }, 1024), chk("EUR 2.75 in total", { kind: "system", unit: 25, bets: 11, total: 275, races: 3, odds: [200] }, "P-STAKE"), chk("Unit 0.30", { kind: "system", unit: 30, bets: 10, total: 300, races: 3, odds: [200] }, "P-STAKE")]),
      mk("C.3", "Bet shape limits", [chk("Multiple with 20 selections", { kind: "multiple", stake: 300, selections: 20, odds: [200] }, 1024), chk("Multiple with 21 selections", { kind: "multiple", stake: 300, selections: 21, odds: [200] }, "P-STRUCT"), chk("System over 31 races", { kind: "system", unit: 25, bets: 12, total: 300, races: 31, odds: [200] }, "P-STRUCT"), chk("Odds 0.99", { kind: "single", stake: 300, odds: [99] }, "P-ODDS")]),
      mk("C.4", "Bookmaker margin", [{ label: "Three runners 2.00, 3.00, 4.00", msg: "check:market", req: { odds: [200, 300, 400] }, expect: 1024 }, { label: "Three runners 1.50, 2.00, 2.50", msg: "check:market", req: { odds: [150, 200, 250] }, expect: "P-MARGIN" }, { label: "Odds of 50.00 or more are left out", msg: "check:market", req: { odds: [200, 300, 5000, 400] }, expect: 1024 }])
    ] },
    { id: "D", title: "Settlement in two steps", ticket: "Kit rules 28 to 33", messages: ["3011.7"], note: "Payment through PSIP, then the PACG credit; the player is credited only after the PACG reply.", cases: [
      mk("D.1", "Single bet payout is truncated", [sell("D1", [{ event: 1, outcome: "H1", odds: 235 }], 300), result(["H1"]), { label: "Payment", msg: "3011.7", req: pq(), expect: 1024, assert: function (s, r) { return r.amount === 705 || "paid " + r.amount; } }]),
      mk("D.2", "Multiple payout is truncated", [{ do: function (sb) { sb.state.events[4] = { state: 2 }; sb.state.events[5] = { state: 2 }; }, label: "Sale of a multiple", msg: "3011.5", req: function () { return sale({ play: "D2", entries: [{ event: 1, outcome: "H1", odds: 235 }, { event: 4, outcome: "H2", odds: 310 }, { event: 5, outcome: "H3", odds: 185 }] }); }, expect: 1024 }, { do: function (sb) { [1, 4, 5].forEach(function (i) { sb.state.events[i].results = { winners: ["H1", "H2", "H3"] }; sb.state.events[i].state = 4; }); }, label: "Results arrive" }, { label: "Payment", msg: "3011.7", req: pq(), expect: 1024, assert: function (s, r) { return r.amount === 4043 || "paid " + r.amount; } }]),
      mk("D.3", "Payment rules", [sell("D3"), { label: "Payment before the result", msg: "3011.7", req: pq(), expect: 5003 }, result(["H1"]), { label: "Payment", msg: "3011.7", req: pq(), expect: 1024 }, { label: "Payment again", msg: "3011.7", req: pq(), expect: 5002 }]),
      mk("D.4", "Losing and unknown tickets", [sell("D4"), result(["H9"]), { label: "Payment of a losing ticket", msg: "3011.7", req: pq(), expect: 5000 }, { label: "Unknown ticket", msg: "3011.7", req: { id_transazione: "d44", FIRMA_DIG01: "ok", id: "NOPE" }, expect: 5000 }]),
      mk("D.5", "Payments suspended", [sell("D5"), result(["H1"]), { do: function (sb) { sb.state.paySuspended = true; }, label: "Payment", msg: "3011.7", req: pq(), expect: 5006 }])
    ] },
    { id: "E", title: "Result changes", ticket: "Kit rule 31", messages: ["3011.12", "3011.13"], note: "A changed result is reversed or corrected through PSIP and PACG.", cases: [
      mk("E.1", "Reverse and correct", [sell("E1"), { label: "Reversal of an unpaid ticket", msg: "3011.12", req: pq(), expect: 5009 }, result(["H1"]), { label: "Payment", msg: "3011.7", req: pq(), expect: 1024 }, { label: "Correction", msg: "3011.13", req: pq(500), expect: 1024, assert: function (s, r) { return r.amount === 500 || "amount " + r.amount; } }, { label: "Reversal", msg: "3011.12", req: pq(), expect: 1024 }])
    ] },
    { id: "G", title: "Accounting and integrity", ticket: "Kit rules 34 to 37", messages: ["3500.1", "3600.5", "3900.1", "3900.2"], note: "Daily statement, keep-alive once a minute, integrity daily and after each patch.", cases: [
      mk("G.1", "Daily statement and lists", [{ label: "3500.1", msg: "3500.1", req: { id_transazione: "g11" }, expect: 1024 }, { label: "3600.5 with 300 tickets", msg: "3600.5", req: { id_transazione: "g12", count: 300 }, expect: 1518 }, { label: "3600.5 with 250 tickets", msg: "3600.5", req: { id_transazione: "g13", count: 250 }, expect: 1024 }]),
      mk("G.2", "Keep-alive and integrity", [{ label: "3900.1", msg: "3900.1", req: { id_transazione: "g21" }, expect: 1024 }, { label: "3900.2, matching hashes", msg: "3900.2", req: { id_transazione: "g22", components: [{ hash: "ok" }] }, expect: 1024 }, { label: "3900.2, a different hash", msg: "3900.2", req: { id_transazione: "g23", components: [{ hash: "bad" }] }, expect: 7012 }])
    ] }
  ];
  var messages = [
    { id: "3011.5", name: "Fixed-odds sale", template: { id_transazione: "ff1", tag: 1, tipo_tag: 5, FIRMA_DIG01: "ok", account: "A1", CONTO_2: "A1", SALDO_CONTO: 99000, IP_VENDITA_GIOCATORE: "10.0.0.1", ID_GIOCATA: "FF1", price: 300, entries: [{ event: 1, outcome: "H1", odds: 235 }] } },
    { id: "3011.7", name: "Payment or refund", template: { id_transazione: "ff2", FIRMA_DIG01: "ok", id: "" } }, { id: "3011.3", name: "Cancellation", template: { id_transazione: "ff3", id: "" } },
    { id: "3000.2", name: "Events", template: { id_transazione: "ff4", event: 1 } }, { id: "check:bet", name: "Platform bet check", template: { kind: "single", stake: 300, odds: [235] } },
    { id: "check:market", name: "Platform margin check", template: { odds: [200, 300, 400] } }, { id: "3900.1", name: "Keep alive", template: { id_transazione: "ff7" } }
  ];
  var coverage = [
    { rule: "8, 10", text: "Only events in state AP can be sold; recovery of notifications", cases: ["A.1", "A.2", "A.3"] }, { rule: "5", text: "No reply: resend with the same transaction ID", cases: ["B.2"] }, { rule: "20, 22", text: "Validate first; mandatory remote attributes", cases: ["B.1", "B.4"] },
    { rule: "21", text: "20 entries; system 30 events, 2000 multiples", cases: ["B.6", "B.7"] }, { rule: "24", text: "Play identifier unique (3008)", cases: ["B.3"] }, { rule: "25", text: "No void after the code (4004)", cases: ["B.9"] }, { rule: "27", text: "Account state at login and sale", cases: ["B.5"] },
    { rule: "11 to 14", text: "Stakes, shapes, odds and margin", cases: ["C.1", "C.2", "C.3", "C.4"] }, { rule: "15", text: "Payout truncation, never rounding", cases: ["D.1", "D.2"] }, { rule: "28 to 33", text: "Two-step settlement", cases: ["D.3", "D.4", "D.5"] },
    { rule: "31", text: "Reversal and correction", cases: ["E.1"] }, { rule: "34 to 37", text: "Accounting, keep-alive, integrity", cases: ["G.1", "G.2", "B.8"] }
  ];
  g.BENCH = { id: "psip", title: "PSIP Bench", subtitle: "Netbet Italy, CHG-375325, PSIP 3.0 of 3 September 2026 (fake data)", kitPage: "CHG-375325.html", startTime: "2026-11-20T09:00:00Z", closedCode: 1517, init: init, handle: function (s, m, q, sb) { var h = H[m]; return h ? h(s, q, sb) : no(1510, "Message not in this bench"); }, groups: groups, messages: messages, codes: codes, coverage: coverage };
})(typeof window !== "undefined" ? window : globalThis);
