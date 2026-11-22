// PGDA bench definition: rule engine written from the CHG-375326 kit (PGDA 3.1.0). Fake data only. Esito 0 is positive.
(function (g) {
  var C = BenchCore, no = C.no, DAY = 86400000;
  var ok = function (extra, rule) { var r = C.ok(extra, rule); r.code = 0; return r; };
  var codes = {
    0: "Esito 0: positive", 1003: "Transaction code refers to a different request already made", 1226: "Start and end amount, sum of bets and amount returned inconsistent", 1425: "Player has already closed the participation at the table",
    1426: "Player exceeded the playable amount limit", 1428: "Player is already seated at the table", 1431: "Players are still seated at the table", 1432: "Participation amount below the minimum for the table",
    1433: "Participation amount above the maximum for the table", 1470: "BON value other than B or F", 1491: "MNI above the limit allowed by the rules", 1492: "MXI above the limit allowed by the rules",
    1631: "Player pseudonym associated with another gaming account", 1810: "The session is closed", 2370: "810 end date before the presumed end", 2424: "Last phases of the previous day not sent", 2429: "Total phases inconsistent with what was declared",
    2451: "No accounting data", 2499: "Accounting data not available for the period", 2630: "cod_tipo_componente missing or wrong", 2663: "Participation in sessions that award jackpot prizes not allowed", 1191: "Game not enabled for the concessionaire", 1442: "Game inconsistent with its transmission mode",
    1517: "Service closed"
  };
  function init() { return { sessions: {}, nextS: 1, tickets: {}, nextT: 1, seats: {}, pseudo: {}, accounting: { "2026-11-19": { taxable: 125000 } }, phases: {} }; }
  var H = {
    "400": function (s, q, sb) {
      if (q.game !== "SLOT1") return no(1191, "Game not enabled for the concessionaire"); if (q.mode !== 3) return no(1442, "Message type not provided for this mode");
      if (q.BON !== undefined && q.BON !== "B" && q.BON !== "F") return no(1470, "BON is B or F in mode 3"); if (q.MNI > 100000) return no(1491, "MNI above the limit allowed by the rules"); if (q.MXI > 100000) return no(1492, "MXI above the limit allowed by the rules: EUR 1,000 per session");
      var id = "S" + s.nextS++; s.sessions[id] = { state: 1, MNI: q.MNI, MXI: q.MXI, BON: q.BON, end: q.end ? Date.parse(q.end) : sb.clock + 7 * DAY, start: sb.clock, jackpot: !!q.jackpot }; return ok({ sess_id_sist_centr: id }, "Session accepted: the session code is used in every later message");
    },
    "420": function (s, q) {
      var x = s.sessions[q.session]; if (!x) return no(1810, "Unknown session"); if (x.state === 9) return no(1810, "The session is closed"); if (x.jackpot && q.noJackpot) return no(2663, "Participation in sessions that award jackpot prizes not allowed");
      var k = q.session + "|" + q.account, seat = s.seats[k];
      if (q.pseudonym && s.pseudo[q.pseudonym] && s.pseudo[q.pseudonym] !== q.account) return no(1631, "Pseudonym belongs to another gaming account");
      if (seat && seat.left) return no(1425, "The participation is already closed: a new request gets a new id_ticket"); if (seat && q.progr === 1) return no(1428, "Player is already seated at the table");
      if (q.amount < x.MNI && !seat) return no(1432, "Participation amount below the table minimum"); if (q.amount > x.MXI) return no(1433, "Participation amount above the table maximum");
      var tot = (seat ? seat.taken : 0) + q.amount; if (tot > 100000) return no(1426, "Over the EUR 1,000 playable amount of the session");
      if (!seat) { var id = "TK" + s.nextT++; s.seats[k] = { ticket: id, taken: q.amount, left: false, session: q.session }; s.tickets[id] = k; if (q.pseudonym) s.pseudo[q.pseudonym] = q.account; return ok({ id_ticket: id }, "Participation code assigned: the stake is debited and the board may start only now"); }
      seat.taken = tot; return ok({ id_ticket: seat.ticket }, "Top-up recorded under the same id_ticket");
    },
    "430": function (s, q) {
      var k = s.tickets[q.id_ticket]; if (!k) return no(1810, "Unknown participation"); var seat = s.seats[k], x = s.sessions[seat.session]; if (x.state === 9) return no(1810, "The session is closed");
      if (seat.left) return no(1425, "Participation already closed"); if (seat.taken - q.bets + q.won !== q.finalStake) return no(1226, "Final stake must equal stake taken minus bets plus winnings returned");
      seat.left = true; return ok({}, "Participation end accepted; the final stake is credited through PACG after this reply");
    },
    "500": function (s, q) { var x = s.sessions[q.session]; if (!x) return no(1810, "Unknown session"); var open = Object.keys(s.seats).some(function (k) { return s.seats[k].session === q.session && !s.seats[k].left; }); if (open) return no(1431, "Players are still seated at the table"); x.state = 9; return ok({}, "Session closed"); },
    "510": function (s, q) { if (q.session) return no(1442, "Instant games have no session"); var id = "TK" + s.nextT++; return ok({ id_ticket: id }, "Instant play recorded: the result is shown with the participation code only after this reply"); },
    "580": function (s, q) { if (q.day === "2026-11-21" && !s.phases["2026-11-20"]) return no(2424, "The last phases of the previous day were not sent"); s.phases[q.day] = q.phases; return ok({}, "Phases of the day recorded"); },
    "590": function (s, q) { return s.phases[q.day] === q.total ? ok({}, "Balancing accepted") : no(2429, "Total phases inconsistent with what was declared"); },
    "800": function (s, q) { if (!s.accounting[q.day]) return q.day > "2026-11-19" ? no(2499, "Accounting data not available for the period") : no(2451, "No accounting data"); return ok(s.accounting[q.day], "Accounting data for the day: compare with the platform per game type"); },
    "810": function (s, q) { var x = s.sessions[q.session]; if (!x) return no(1810, "Unknown session"); if (x.state === 9) return no(1810, "The session is closed"); if (Date.parse(q.end) < x.end) return no(2370, "810 end date before the presumed end"); x.end = Date.parse(q.end); return ok({}, "End date extended"); },
    "833": function (s, q) { return [1, 2, 3, 4].indexOf(q.type) < 0 ? no(2630, "cod_tipo_componente missing or wrong") : ok({}, "Hash recorded (at least daily and after each patch)"); },
    "880": function () { return ok({}, "Keep-alive accepted"); }
  };
  var n = 0, tx = function () { return "G" + (++n); };
  var mk = function (id, title, steps) { return { id: id, title: title, steps: steps }; };
  var open = function (o) { return function (sb) { var q = { id_transazione: tx(), game: "SLOT1", mode: 3, MNI: 100, MXI: 100000, BON: "B" }; for (var k in o) q[k] = o[k]; sb.send("400", q); }; };
  var join = function (acc, amt, extra) { return function () { var q = { id_transazione: tx(), session: "S1", account: acc || "A1", amount: amt || 5000, progr: 1 }; for (var k in extra) q[k] = extra[k]; return q; }; };
  var groups = [
    { id: "A", title: "Session, participation, closing", ticket: "Kit rules 1 to 8, 22", messages: ["400", "420", "430", "500"], note: "A session is opened at ADM before any player joins; the stake is debited only after the participation code.", cases: [
      mk("A.1", "Open, join, leave, close", [{ label: "400 session start", msg: "400", req: { id_transazione: "a11", game: "SLOT1", mode: 3, MNI: 100, MXI: 100000, BON: "B" }, expect: 0 }, { label: "420 participation", msg: "420", req: join("A1", 5000), expect: 0, assert: function (s, r) { return !!r.id_ticket || "no id_ticket"; } }, { label: "430 participation end", msg: "430", req: { id_transazione: "a13", id_ticket: "TK1", bets: 3000, won: 1000, finalStake: 3000 }, expect: 0 }, { label: "500 session end", msg: "500", req: { id_transazione: "a14", session: "S1" }, expect: 0 }]),
      mk("A.2", "Close while a player is seated", [{ do: open(), label: "Join", msg: "420", req: join("A1", 5000), expect: 0 }, { label: "500", msg: "500", req: { id_transazione: "a22", session: "S1" }, expect: 1431 }]),
      mk("A.3", "The same player twice, and a top-up", [{ do: open(), label: "Join", msg: "420", req: join("A1", 5000), expect: 0 }, { label: "Join again as a new participation", msg: "420", req: join("A1", 5000), expect: 1428 }, { label: "Top-up under the same ticket", msg: "420", req: join("A1", 2000, { progr: 2 }), expect: 0 }]),
      mk("A.4", "A top-up after leaving", [{ do: open(), label: "Join", msg: "420", req: join("A1", 5000), expect: 0 }, { label: "Leave", msg: "430", req: { id_transazione: "a43", id_ticket: "TK1", bets: 0, won: 0, finalStake: 5000 }, expect: 0 }, { label: "Top-up", msg: "420", req: join("A1", 1000, { progr: 2 }), expect: 1425 }]),
      mk("A.5", "A closed session", [{ do: open(), label: "Close the empty table", msg: "500", req: { id_transazione: "a51", session: "S1" }, expect: 0 }, { label: "Join", msg: "420", req: join("A1", 5000), expect: 1810 }])
    ] },
    { id: "B", title: "Amounts and limits", ticket: "Kit rules 9 to 13", messages: ["400", "420", "430"], note: "At most EUR 1,000 per session for chance games; table minimum and maximum; final stake arithmetic.", cases: [
      mk("B.1", "Table limits in the session attributes", [{ label: "MNI above the limit", msg: "400", req: { id_transazione: "b11", game: "SLOT1", mode: 3, MNI: 100001, MXI: 100000 }, expect: 1491 }, { label: "MXI above EUR 1,000", msg: "400", req: { id_transazione: "b12", game: "SLOT1", mode: 3, MNI: 100, MXI: 100001 }, expect: 1492 }, { label: "MXI exactly EUR 1,000", msg: "400", req: { id_transazione: "b13", game: "SLOT1", mode: 3, MNI: 100, MXI: 100000 }, expect: 0 }]),
      mk("B.2", "Participation below and above the table limits", [{ do: open({ MNI: 500, MXI: 20000 }), label: "Below the minimum", msg: "420", req: join("A1", 400), expect: 1432 }, { label: "Above the maximum", msg: "420", req: join("A1", 20001), expect: 1433 }, { label: "Within the limits", msg: "420", req: join("A1", 20000), expect: 0 }]),
      mk("B.3", "The EUR 1,000 session cap with top-ups", [{ do: open({ MXI: 100000 }), label: "EUR 800", msg: "420", req: join("A1", 80000), expect: 0 }, { label: "Top-up EUR 300", msg: "420", req: join("A1", 30000, { progr: 2 }), expect: 1426 }, { label: "Top-up EUR 200", msg: "420", req: join("A1", 20000, { progr: 2 }), expect: 0 }]),
      mk("B.4", "Final stake must add up", [{ do: open(), label: "Join EUR 50", msg: "420", req: join("A1", 5000), expect: 0 }, { label: "Bets 30, won 10, final 40", msg: "430", req: { id_transazione: "b42", id_ticket: "TK1", bets: 3000, won: 1000, finalStake: 4000 }, expect: 1226 }, { label: "Bets 30, won 10, final 30", msg: "430", req: { id_transazione: "b43", id_ticket: "TK1", bets: 3000, won: 1000, finalStake: 3000 }, expect: 0 }])
    ] },
    { id: "C", title: "Bonus, game and pseudonym", ticket: "Kit rules 40 to 43", messages: ["400", "420"], note: "BON is B or F in mode 3; the game must be enabled; one account per pseudonym.", cases: [
      mk("C.1", "BON values", [{ label: "BON F", msg: "400", req: { id_transazione: "c11", game: "SLOT1", mode: 3, MNI: 100, MXI: 1000, BON: "F" }, expect: 0 }, { label: "BON N", msg: "400", req: { id_transazione: "c12", game: "SLOT1", mode: 3, MNI: 100, MXI: 1000, BON: "N" }, expect: 1470 }]),
      mk("C.2", "Game and mode", [{ label: "Unknown game", msg: "400", req: { id_transazione: "c21", game: "NOPE", mode: 3, MNI: 100, MXI: 1000 }, expect: 1191 }, { label: "Wrong mode for the game", msg: "400", req: { id_transazione: "c22", game: "SLOT1", mode: 1, MNI: 100, MXI: 1000 }, expect: 1442 }]),
      mk("C.3", "Pseudonym", [{ do: open(), label: "Join with pseudonym Ace", msg: "420", req: join("A1", 5000, { pseudonym: "Ace" }), expect: 0 }, { label: "Another account uses Ace", msg: "420", req: join("A2", 5000, { pseudonym: "Ace" }), expect: 1631 }])
    ] },
    { id: "D", title: "Instant games and jackpots", ticket: "Kit rules 6, 25 to 27", messages: ["510", "420"], note: "Instant games use one message and no session.", cases: [
      mk("D.1", "Instant game", [{ label: "510", msg: "510", req: { id_transazione: "d11", account: "A1", stake: 500, win: 0 }, expect: 0, assert: function (s, r) { return !!r.id_ticket || "no id_ticket"; } }, { label: "510 with a session", msg: "510", req: { id_transazione: "d12", session: "S1", account: "A1" }, expect: 1442 }]),
      mk("D.2", "Session that awards jackpots", [{ do: open({ jackpot: true }), label: "Join a jackpot session where it is not allowed", msg: "420", req: join("A1", 5000, { noJackpot: true }), expect: 2663 }])
    ] },
    { id: "E", title: "End date, phases, accounting", ticket: "Kit rules 17, 35, 36", messages: ["810", "580", "590", "800"], note: "The session end date can be extended before it passes; phases of a day are sent and balanced; accounting by day.", cases: [
      mk("E.1", "Extend the end date", [{ do: open(), label: "End date before the presumed end", msg: "810", req: { id_transazione: "e11", session: "S1", end: "2026-11-21T00:00:00Z" }, expect: 2370 }, { label: "A later end date", msg: "810", req: { id_transazione: "e12", session: "S1", end: "2026-12-30T00:00:00Z" }, expect: 0 }]),
      mk("E.2", "Phases and balancing", [{ label: "Day 2026-11-21 before the previous day", msg: "580", req: { id_transazione: "e21", day: "2026-11-21", phases: 3 }, expect: 2424 }, { label: "Day 2026-11-20", msg: "580", req: { id_transazione: "e22", day: "2026-11-20", phases: 3 }, expect: 0 }, { label: "Balancing with 4 phases", msg: "590", req: { id_transazione: "e23", day: "2026-11-20", total: 4 }, expect: 2429 }, { label: "Balancing with 3 phases", msg: "590", req: { id_transazione: "e24", day: "2026-11-20", total: 3 }, expect: 0 }]),
      mk("E.3", "Accounting data", [{ label: "A day with data", msg: "800", req: { id_transazione: "e31", day: "2026-11-19" }, expect: 0 }, { label: "A day without data", msg: "800", req: { id_transazione: "e32", day: "2026-11-10" }, expect: 2451 }, { label: "A day not yet available", msg: "800", req: { id_transazione: "e33", day: "2026-11-25" }, expect: 2499 }])
    ] },
    { id: "H", title: "Transport and integrity", ticket: "Kit rules 14, 15, 37, 38", messages: ["833", "880"], note: "Same transaction ID on every resend; software hash at least daily; keep-alive.", cases: [
      mk("H.1", "Lost reply on a session start", [{ label: "400, reply lost", msg: "400", req: { id_transazione: "RG1", game: "SLOT1", mode: 3, MNI: 100, MXI: 100000, BON: "B" }, fault: "drop-response", expect: null }, { label: "Resend unchanged", msg: "400", req: { id_transazione: "RG1", game: "SLOT1", mode: 3, MNI: 100, MXI: 100000, BON: "B" }, expect: 0, assert: function (s, r) { return (Object.keys(s.sessions).length === 1 && r.replayed) || "expected one session"; } }]),
      mk("H.2", "Service closed", [{ label: "400 while closed", msg: "400", req: { id_transazione: "h21", game: "SLOT1", mode: 3, MNI: 100, MXI: 1000 }, fault: "closed", expect: 1517, assert: function (s) { return Object.keys(s.sessions).length === 0 || "a session exists"; } }]),
      mk("H.3", "Software hash and keep-alive", [{ label: "833 platform", msg: "833", req: { id_transazione: "h31", type: 1 }, expect: 0 }, { label: "833 unknown type", msg: "833", req: { id_transazione: "h32", type: 9 }, expect: 2630 }, { label: "880", msg: "880", req: { id_transazione: "h33" }, expect: 0 }])
    ] }
  ];
  var messages = [
    { id: "400", name: "Game session start", template: { id_transazione: "ff1", game: "SLOT1", mode: 3, MNI: 100, MXI: 100000, BON: "B" } }, { id: "420", name: "Participation right purchase", template: { id_transazione: "ff2", session: "S1", account: "A1", amount: 5000, progr: 1 } },
    { id: "430", name: "Participation end", template: { id_transazione: "ff3", id_ticket: "TK1", bets: 0, won: 0, finalStake: 5000 } }, { id: "500", name: "Session end", template: { id_transazione: "ff4", session: "S1" } },
    { id: "510", name: "Instant game play", template: { id_transazione: "ff5", account: "A1", stake: 500, win: 0 } }, { id: "800", name: "Accounting data request", template: { id_transazione: "ff6", day: "2026-11-19" } }, { id: "880", name: "Keep alive", template: { id_transazione: "ff7" } }
  ];
  var coverage = [
    { rule: "1 to 5, 22", text: "Session, participation, end, closing a table with players seated", cases: ["A.1", "A.2", "A.5"] }, { rule: "7", text: "Same player twice; top-ups; a participation after leaving", cases: ["A.3", "A.4"] }, { rule: "6", text: "Instant games: one message, no session", cases: ["D.1"] },
    { rule: "9, 10", text: "EUR 1,000 per session; table minimum and maximum", cases: ["B.1", "B.2", "B.3"] }, { rule: "11", text: "Final stake arithmetic (1226)", cases: ["B.4"] }, { rule: "14, 15", text: "Transaction ID repeated on a resend", cases: ["H.1"] },
    { rule: "17", text: "End date extension (810)", cases: ["E.1"] }, { rule: "27", text: "Jackpot sessions (2663)", cases: ["D.2"] }, { rule: "35, 36", text: "Accounting, phases and balancing", cases: ["E.2", "E.3"] }, { rule: "37, 38", text: "Software hash and keep-alive", cases: ["H.3", "H.2"] }, { rule: "40 to 43", text: "BON, game classification, pseudonym", cases: ["C.1", "C.2", "C.3"] }
  ];
  g.BENCH = { id: "pgda", title: "PGDA Bench", subtitle: "Netbet Italy, CHG-375326, PGDA v3.1.0 (fake data; JSON stands in for the binary format)", kitPage: "CHG-375326.html", startTime: "2026-11-20T09:00:00Z", closedCode: 1517, init: init, handle: function (s, m, q, sb) { var h = H[m]; return h ? h(s, q, sb) : no(1442, "Message type not provided for the game type"); }, groups: groups, messages: messages, codes: codes, coverage: coverage };
})(typeof window !== "undefined" ? window : globalThis);
