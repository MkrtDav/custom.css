// PACG bench definition: rule engine written from the CHG-375322 kit (PACG 3.3). Fake data only.
(function (g) {
  var C = BenchCore, ok = C.ok, no = C.no, DAY = 86400000;
  var codes = {
    1024: "OK", 1517: "Service closed",
    1200: "Already holds an account with Netbet", 1202: "Account does not exist", 1203: "Account closed", 1204: "Account dormant", 1208: "Reopen refused: account is open", 1209: "Reopen refused: account is closed",
    1211: "Suspend refused: already suspended", 1212: "Suspend refused: closed", 1214: "Close refused: already closed", 1217: "Negative balance amount", 1234: "Invalid reason for the status change",
    1236: "Receipt unknown", 1239: "Reversal time limit passed", 1271: "Account blocked", 1275: "Block refused: already blocked", 1294: "No indefinite exclusion to reactivate",
    1298: "Person self-excluded (bonus refused)", 1302: "Minor", 1304: "Invalid tax code", 1421: "Payment method not allowed for the movement", 1427: "Bonus reversal time limit passed", 1432: "Reactivation by another operator's exclusion",
    1449: "Documents not acquired", 1451: "Document expired", 1452: "Cross-operator self-exclusion in progress", 1454: "Self-limit value not allowed at opening", 1460: "Duration and value equal to the previous ones",
    1463: "Disconnection already sent", 1464: "Sub-registration receipt ID missing or inconsistent", 1465: "Account differs from the sub-registration account", 1471: "Suspended with reason 9, 10 or 11",
    1481: "Duration not allowed", 1484: "Reactivation under 270 days", 1487: "Account suspended", 1488: "Account closed", 1489: "Account dormant", 1490: "Account blocked", 1491: "Self-excluded from game families",
    1494: "Deposit limit exceeded", 1495: "PVR weekly cap exceeded", 1496: "Method only for PVR top-ups", 1502: "Limit category not allowed", 1505: "Block refused: block follows a suspension", 1506: "Block refused: closed", 1507: "Suspend refused: blocked", 1510: "Request rejected (message not in this bench)"
  };
  function init() { return { accounts: {}, byTax: {}, excluded: {}, receipts: {}, movements: {}, nextR: 1, nextM: 1, discon: {} }; }
  function mkAcc(s, sb, tax, state) { var a = { code: "A" + (Object.keys(s.accounts).length + 1), tax: tax, state: state || 1, reason: 0, balance: 10000, bonus: 0, limits: { deposit: 20000, spend: 10000, time: 3 }, deposits: [], pvr: [], excl: null, limitsSet: {}, openedAt: sb.clock, awards: {} }; s.accounts[a.code] = a; s.byTax[tax] = a.code; return a; }
  var TAX = "RSSMRA80A01H501U";
  var H = {
    "6.1": function (s, q, sb) {
      if (s.byTax[q.tax] && s.accounts[s.byTax[q.tax]].state !== 3) return no(1200, "One account per player and operator");
      if (q.age < 18) return no(1302, "Minor"); if (!q.tax || q.tax.length !== 16) return no(1304, "Tax code invalid");
      if (s.excluded[q.tax] && s.excluded[q.tax] <= 8) return no(1452, "Cross-operator self-exclusion in force: opening refused");
      if (q.docs !== true) return no(1449, "6.1 sent as documents not acquired"); if (Date.parse(q.docExpiry) < sb.clock) return no(1451, "Identity document expired");
      var young = q.age <= 24, cap = young ? { time: 2, spend: 50, deposit: 50 } : { time: 3, spend: 100, deposit: 200 }, l = q.limits || {};
      if (l.time > cap.time || l.spend > cap.spend || l.deposit > cap.deposit) return no(1454, "A first-activation limit is above the cap: " + JSON.stringify(cap));
      var a = mkAcc(s, sb, q.tax); a.limits = { deposit: l.deposit * 100, spend: l.spend * 100, time: l.time }; return ok({ account: a.code }, "Account opened; activation follows the code confirmation");
    },
    "6.12": function (s, q) {
      var a = s.accounts[q.account]; if (!a) return no(1202, "Account does not exist");
      if (q.balance < 0) return no(1217, "Negative balance amount");
      var m = { 2: 1487, 5: 1490, 3: 1488, 4: 1489 }; if (m[a.state]) return no(m[a.state], "Account state refuses the session");
      if (a.excl && a.excl.type <= 8) return no(1452, "Cross-operator or operator self-exclusion"); if (a.excl && a.excl.type >= 9) return no(1491, "Self-exclusion from game families: no gaming session for that scope");
      var r = "R" + String(s.nextR++); while (r.length < 25) r = r + "0"; s.receipts[r] = { account: a.code }; return ok({ receipt: r }, "Sub-registration accepted: receipt ID returned; the session may start");
    },
    "6.3": function (s, q, sb) {
      var a = s.accounts[q.account]; if (!a) return no(1202, "Account does not exist"); var top = q.kind === "topup";
      if (a.state === 3) { if (top) return no(1203, "Top-up on a closed account"); if ([9, 10, 11].indexOf(a.reason) >= 0) return no(1471, "Withdrawal refused for this reason"); }
      if (a.state === 4) return no(1204, "Account dormant"); if (a.state === 5) return no(1271, "Account blocked");
      if (a.state === 2 && [9, 10, 11].indexOf(a.reason) >= 0) return no(1471, "Suspended with reason 9, 10 or 11");
      if (!top && q.method === 17) return no(1421, "Method 17 (PVR cash) is not allowed on a withdrawal"); if (q.method === 17 && !q.pvr) return no(1496, "Method allowed only for PVR top-ups");
      if (top) {
        var week = a.pvr.filter(function (x) { return sb.clock - x.t < 7 * DAY; }).reduce(function (p, x) { return p + x.amount; }, 0);
        if (q.method === 17 && week + q.amount > 10000) return no(1495, "PVR cash cap of EUR 100 per week");
        var day = a.deposits.filter(function (x) { return sb.clock - x.t < DAY; }).reduce(function (p, x) { return p + x.amount; }, 0);
        if (day + q.amount > a.limits.deposit) return no(1494, "Deposit limit exceeded");
        a.deposits.push({ t: sb.clock, amount: q.amount }); if (q.method === 17) a.pvr.push({ t: sb.clock, amount: q.amount }); a.balance += q.amount;
      } else a.balance -= q.amount;
      var id = "M" + s.nextM++; s.movements[id] = { account: a.code, t: sb.clock, kind: q.kind, amount: q.amount }; return ok({ receipt: id }, "Movement recorded first; the balance moves only now");
    },
    "6.4": function (s, q, sb) {
      var m = s.movements[q.receipt]; if (!m) return no(1236, "Receipt unknown"); var days = (sb.clock - m.t) / DAY, lim = q.chargeback ? 196 : 15;
      if (days > lim) return no(1239, "Reversal window passed: " + lim + " days"); return ok({}, "Reversal accepted");
    },
    "6.5": function (s, q, sb) { var a = s.accounts[q.account]; if (!a) return no(1202, "Account does not exist"); if (a.state === 3) return no(1203, "Account closed"); if (a.excl) return no(1298, "The person is self-excluded"); a.bonus += q.amount; a.awards[q.award] = sb.clock; return ok({}, "Bonus award recorded"); },
    "6.6": function (s, q, sb) { var a = s.accounts[q.account]; if (!a) return no(1202, "Account does not exist"); var t = a.awards[q.award]; if (t === undefined) return no(1236, "Award unknown"); if ((sb.clock - t) / DAY > 365) return no(1427, "Bonus reversal window of 365 days passed"); return ok({}, "Bonus reversal recorded (also on a closed account)"); },
    "6.8": function (s, q) { var a = s.accounts[q.account]; if (!a) return no(1202, "Account does not exist"); if (q.balance < 0) return no(1217, "Negative balance amount"); a.balance += q.amount; return ok({}, "Credit accepted; ADM refuses no credit by account state"); },
    "6.10": function (s, q) {
      var a = s.accounts[q.account]; if (!a) return no(1202, "Account does not exist"); var t = q.target, f = a.state;
      if ([1, 5, 9, 11].indexOf(q.reason) >= 0 && t !== 1) return no(1234, "Reasons 1, 5, 9 and 11 are set by ADM only");
      if (t === 1) { if (f === 1) return no(1208, "Already open"); if (f === 3) return no(1209, "A closed account is never reopened"); }
      if (t === 2) { if (f === 2) return no(1211, "Already suspended"); if (f === 3) return no(1212, "Closed"); if (f === 5) return no(1507, "Blocked"); }
      if (t === 3 && f === 3) return no(1214, "Already closed");
      if (t === 5) { if (f === 1) return no(1505, "A block follows a suspension"); if (f === 5) return no(1275, "Already blocked"); if (f === 3) return no(1506, "Closed"); }
      a.state = t; a.reason = q.reason; return ok({}, "Status change accepted");
    },
    "6.16": function (s, q, sb) {
      var a = s.accounts[q.account]; if (!a) return no(1202, "Account does not exist");
      if (q.type === 1) { if (!a.excl || a.excl.duration !== 0) return no(1294, "No indefinite exclusion to reactivate"); if (a.excl.other) return no(1432, "Registered through another operator"); if ((sb.clock - a.excl.t) / DAY < 270) return no(1484, "Under 270 days"); a.excl = null; delete s.excluded[a.tax]; return ok({}, "Reactivation accepted; play returns after 7 days"); }
      if ([5, 6, 7, 8, 9, 10, 11, 12].indexOf(q.type) < 0) return no(1510, "Type not in this bench");
      var fixed = [6, 8, 10, 12].indexOf(q.type) >= 0; if (fixed && (q.duration < 7 || q.duration > 270)) return no(1481, "Fixed duration is 7 to 270 days"); if (!fixed && q.duration !== 0) return no(1481, "Indefinite exclusion has duration 0");
      a.excl = { type: q.type, duration: q.duration, t: sb.clock, other: !!q.other }; if (q.type <= 8) s.excluded[a.tax] = q.type; return ok({}, "Self-exclusion recorded");
    },
    "6.23": function (s, q) { var a = s.accounts[q.account]; if (!a) return no(1202, "Account does not exist"); if (["topup", "spend", "time", "loss"].indexOf(q.category) < 0) return no(1502, "Category not allowed"); var k = q.category + q.period, p = a.limitsSet[k]; if (p !== undefined && p === q.value) return no(1460, "Same value as before"); a.limitsSet[k] = q.value; return ok({}, "Limit accepted; a stricter value applies at once, a looser one from day 7"); },
    "6.32": function (s, q) { var r = s.receipts[q.receipt]; if (!q.receipt || !r) return no(1464, "Receipt ID missing or inconsistent"); if (r.account !== q.account) return no(1465, "Account differs from the sub-registration account"); if (s.discon[q.receipt]) return no(1463, "Disconnection already sent: treat as done"); s.discon[q.receipt] = 1; return ok({}, "Disconnection recorded"); }
  };
  var n = 0, tx = function () { return "P" + (++n); };
  var open = function (st) { return function (sb) { var a = mkAcc(sb.state, sb, TAX); a.state = st || 1; }; };
  var reg = function (o) { var q = { id_transazione: tx(), tax: TAX, age: 30, docs: true, docExpiry: "2030-01-01", limits: { time: 3, spend: 100, deposit: 200 } }; for (var k in o) q[k] = o[k]; return q; };
  var mv = function (o) { var q = { id_transazione: tx(), account: "A1", kind: "topup", method: 2, amount: 5000 }; for (var k in o) q[k] = o[k]; return q; };
  var mk = function (id, title, steps) { return { id: id, title: title, steps: steps }; };
  var st = function (target, reason) { return { id_transazione: tx(), account: "A1", target: target, reason: reason }; };
  var rec = function (sb) { return Object.keys(sb.state.movements)[0]; };
  var groups = [
    { id: "A", title: "Registration and account opening", ticket: "Kit rules 1 to 14", messages: ["6.1"], note: "6.1 is sent only after identity is verified and documents are acquired. First-activation caps apply.", cases: [
      mk("A.1", "A valid opening", [{ label: "6.1", msg: "6.1", req: reg(), expect: 1024 }]),
      mk("A.2", "A second account for the same tax code", [{ label: "First opening", msg: "6.1", req: reg(), expect: 1024 }, { label: "Second opening", msg: "6.1", req: reg(), expect: 1200 }]),
      mk("A.3", "Refusals of the opening", [{ label: "Minor", msg: "6.1", req: reg({ age: 17 }), expect: 1302 }, { label: "Invalid tax code", msg: "6.1", req: reg({ tax: "SHORT" }), expect: 1304 }, { label: "Documents not acquired", msg: "6.1", req: reg({ docs: false }), expect: 1449 }, { label: "Expired document", msg: "6.1", req: reg({ docExpiry: "2020-01-01" }), expect: 1451 }]),
      mk("A.4", "First-activation caps", [{ label: "Time 4 hours", msg: "6.1", req: reg({ limits: { time: 4, spend: 100, deposit: 200 } }), expect: 1454 }, { label: "Aged 22 with spend 100", msg: "6.1", req: reg({ age: 22, limits: { time: 2, spend: 100, deposit: 50 } }), expect: 1454 }, { label: "Aged 22 with 2 h, 50, 50", msg: "6.1", req: reg({ age: 22, limits: { time: 2, spend: 50, deposit: 50 } }), expect: 1024 }]),
      mk("A.5", "Cross-operator self-exclusion blocks opening", [{ do: function (sb) { sb.state.excluded[TAX] = 5; }, label: "6.1", msg: "6.1", req: reg(), expect: 1452 }])
    ] },
    { id: "B", title: "Login check", ticket: "Kit rules 15 to 17", messages: ["6.12", "6.32"], note: "6.12 at every session start; the session starts only after the positive reply.", cases: [
      mk("B.1", "An open account", [{ do: open(), label: "6.12", msg: "6.12", req: { id_transazione: "b11", account: "A1", balance: 10000 }, expect: 1024, assert: function (s, r) { return (r.receipt && r.receipt.length === 25) || "receipt ID is not 25 characters"; } }]),
      mk("B.2", "Refusals by state", [{ do: open(2), label: "Suspended", msg: "6.12", req: { id_transazione: "b21", account: "A1", balance: 0 }, expect: 1487 }, { do: function (sb) { sb.state.accounts.A1.state = 5; }, label: "Blocked", msg: "6.12", req: { id_transazione: "b22", account: "A1", balance: 0 }, expect: 1490 }, { do: function (sb) { sb.state.accounts.A1.state = 3; }, label: "Closed", msg: "6.12", req: { id_transazione: "b23", account: "A1", balance: 0 }, expect: 1488 }, { do: function (sb) { sb.state.accounts.A1.state = 4; }, label: "Dormant", msg: "6.12", req: { id_transazione: "b24", account: "A1", balance: 0 }, expect: 1489 }]),
      mk("B.3", "Self-exclusion at login", [{ do: function (sb) { var a = mkAcc(sb.state, sb, TAX); a.excl = { type: 5, duration: 0, t: sb.clock }; }, label: "Cross-operator", msg: "6.12", req: { id_transazione: "b31", account: "A1", balance: 0 }, expect: 1452 }, { do: function (sb) { sb.state.accounts.A1.excl = { type: 9, duration: 0, t: sb.clock }; }, label: "Game families", msg: "6.12", req: { id_transazione: "b32", account: "A1", balance: 0 }, expect: 1491 }]),
      mk("B.4", "Lost reply on the login check", [{ do: open(), label: "6.12, reply lost", msg: "6.12", req: { id_transazione: "b41", account: "A1", balance: 10000 }, fault: "drop-response", expect: null }, { label: "Resend unchanged", msg: "6.12", req: { id_transazione: "b41", account: "A1", balance: 10000 }, expect: 1024, assert: function (s, r) { return r.replayed || "expected a stored reply"; } }]),
      mk("B.5", "Disconnection at logout", [{ do: open(), label: "6.12", msg: "6.12", req: { id_transazione: "b51", account: "A1", balance: 10000 }, expect: 1024 }, { label: "6.32", msg: "6.32", req: function (sb) { return { id_transazione: tx(), account: "A1", receipt: Object.keys(sb.state.receipts)[0] }; }, expect: 1024 }, { label: "6.32 again", msg: "6.32", req: function (sb) { return { id_transazione: tx(), account: "A1", receipt: Object.keys(sb.state.receipts)[0] }; }, expect: 1463 }, { label: "Unknown receipt", msg: "6.32", req: { id_transazione: "b54", account: "A1", receipt: "NOPE" }, expect: 1464 }])
    ] },
    { id: "C", title: "Deposit, reversal and PVR", ticket: "Kit rules 18 to 24", messages: ["6.3", "6.4"], note: "Record first; the balance moves only after the positive reply.", cases: [
      mk("C.1", "A deposit", [{ do: open(), label: "6.3 top-up", msg: "6.3", req: mv(), expect: 1024 }]),
      mk("C.2", "Deposit limit", [{ do: open(), label: "EUR 150", msg: "6.3", req: mv({ amount: 15000 }), expect: 1024 }, { label: "EUR 100 more over the EUR 200 limit", msg: "6.3", req: mv({ amount: 10000 }), expect: 1494 }]),
      mk("C.3", "Account state refuses movements", [{ do: open(3), label: "Closed: top-up", msg: "6.3", req: mv(), expect: 1203 }, { label: "Closed: withdrawal", msg: "6.3", req: mv({ kind: "withdrawal", method: 4 }), expect: 1024 }, { do: function (sb) { sb.state.accounts.A1.state = 4; }, label: "Dormant", msg: "6.3", req: mv(), expect: 1204 }, { do: function (sb) { sb.state.accounts.A1.state = 5; }, label: "Blocked", msg: "6.3", req: mv(), expect: 1271 }, { do: function (sb) { var a = sb.state.accounts.A1; a.state = 2; a.reason = 10; }, label: "Suspended with reason 10", msg: "6.3", req: mv(), expect: 1471 }]),
      mk("C.4", "PVR cash cap", [{ do: open(), label: "PVR top-up EUR 60", msg: "6.3", req: mv({ method: 17, pvr: 1, amount: 6000 }), expect: 1024 }, { label: "PVR top-up EUR 50 more", msg: "6.3", req: mv({ method: 17, pvr: 1, amount: 5000 }), expect: 1495 }, { label: "Method 17 without a PVR", msg: "6.3", req: mv({ method: 17, amount: 1000 }), expect: 1496 }, { label: "Method 17 on a withdrawal", msg: "6.3", req: mv({ method: 17, kind: "withdrawal", pvr: 1 }), expect: 1421 }]),
      mk("C.5", "Reversal windows", [{ do: open(), label: "Top-up", msg: "6.3", req: mv(), expect: 1024 }, { advance: 10 * DAY, label: "Normal reversal after 10 days", msg: "6.4", req: function (sb) { return { id_transazione: tx(), receipt: rec(sb) }; }, expect: 1024 }, { advance: 10 * DAY, label: "Normal reversal after 20 days", msg: "6.4", req: function (sb) { return { id_transazione: tx(), receipt: rec(sb) }; }, expect: 1239 }, { label: "Charge-back reversal after 20 days", msg: "6.4", req: function (sb) { return { id_transazione: tx(), receipt: rec(sb), chargeback: true }; }, expect: 1024 }, { advance: 190 * DAY, label: "Charge-back after 210 days", msg: "6.4", req: function (sb) { return { id_transazione: tx(), receipt: rec(sb), chargeback: true }; }, expect: 1239 }])
    ] },
    { id: "D", title: "Credits and bonus", ticket: "Kit rules 26 to 30", messages: ["6.8", "6.5", "6.6"], note: "Credits are not refused by account state; bonus is refused to an excluded player.", cases: [
      mk("D.1", "Credit on a closed account", [{ do: open(3), label: "6.8", msg: "6.8", req: { id_transazione: "d11", account: "A1", amount: 2000, balance: 12000 }, expect: 1024 }, { label: "Negative declared balance", msg: "6.8", req: { id_transazione: "d12", account: "A1", amount: 2000, balance: -1 }, expect: 1217 }]),
      mk("D.2", "Bonus award", [{ do: open(), label: "Award", msg: "6.5", req: { id_transazione: "d21", account: "A1", amount: 1000, award: "W1" }, expect: 1024 }, { do: function (sb) { sb.state.accounts.A1.excl = { type: 7, duration: 0, t: sb.clock }; }, label: "Award to an excluded player", msg: "6.5", req: { id_transazione: "d22", account: "A1", amount: 1000, award: "W2" }, expect: 1298 }, { do: function (sb) { sb.state.accounts.A1.excl = null; sb.state.accounts.A1.state = 3; }, label: "Award on a closed account", msg: "6.5", req: { id_transazione: "d23", account: "A1", amount: 1000, award: "W3" }, expect: 1203 }]),
      mk("D.3", "Bonus reversal window", [{ do: open(), label: "Award", msg: "6.5", req: { id_transazione: "d31", account: "A1", amount: 1000, award: "W1" }, expect: 1024 }, { advance: 300 * DAY, label: "Reversal after 300 days", msg: "6.6", req: { id_transazione: "d32", account: "A1", award: "W1" }, expect: 1024 }, { advance: 100 * DAY, label: "Reversal after 400 days", msg: "6.6", req: { id_transazione: "d33", account: "A1", award: "W1" }, expect: 1427 }])
    ] },
    { id: "H", title: "Self-limits", ticket: "Kit rules 32 to 37", messages: ["6.23"], note: "Four limit categories; an equal value is refused.", cases: [
      mk("H.1", "Set and repeat a limit", [{ do: open(), label: "Set spend per day 5000", msg: "6.23", req: { id_transazione: "h11", account: "A1", category: "spend", period: "day", value: 5000 }, expect: 1024 }, { label: "Set the same value again", msg: "6.23", req: { id_transazione: "h12", account: "A1", category: "spend", period: "day", value: 5000 }, expect: 1460 }, { label: "Unknown category", msg: "6.23", req: { id_transazione: "h13", account: "A1", category: "bonus", period: "day", value: 1 }, expect: 1502 }])
    ] },
    { id: "J", title: "Self-exclusion", ticket: "Kit rules 38 to 46", messages: ["6.16"], note: "Fixed 7 to 270 days or indefinite; reactivation from day 270.", cases: [
      mk("J.1", "Durations", [{ do: open(), label: "Fixed 5 days", msg: "6.16", req: { id_transazione: "j11", account: "A1", type: 6, duration: 5 }, expect: 1481 }, { label: "Fixed 30 days", msg: "6.16", req: { id_transazione: "j12", account: "A1", type: 6, duration: 30 }, expect: 1024 }, { label: "Indefinite with a duration", msg: "6.16", req: { id_transazione: "j13", account: "A1", type: 5, duration: 10 }, expect: 1481 }]),
      mk("J.2", "Reactivation", [{ do: open(), label: "No exclusion to reactivate", msg: "6.16", req: { id_transazione: "j21", account: "A1", type: 1, duration: 0 }, expect: 1294 }, { label: "Indefinite exclusion", msg: "6.16", req: { id_transazione: "j22", account: "A1", type: 7, duration: 0 }, expect: 1024 }, { advance: 100 * DAY, label: "Reactivate after 100 days", msg: "6.16", req: { id_transazione: "j23", account: "A1", type: 1, duration: 0 }, expect: 1484 }, { advance: 200 * DAY, label: "Reactivate after 300 days", msg: "6.16", req: { id_transazione: "j24", account: "A1", type: 1, duration: 0 }, expect: 1024 }]),
      mk("J.3", "Exclusion registered elsewhere", [{ do: open(), label: "Registered through another operator", msg: "6.16", req: { id_transazione: "j31", account: "A1", type: 5, duration: 0, other: true }, expect: 1024 }, { advance: 300 * DAY, label: "Reactivate here", msg: "6.16", req: { id_transazione: "j32", account: "A1", type: 1, duration: 0 }, expect: 1432 }])
    ] },
    { id: "K", title: "Account states and closure", ticket: "Kit rules 47 to 55", messages: ["6.10"], note: "6.10 transitions; a closed account is never reopened.", cases: [
      mk("K.1", "Suspend and reopen", [{ do: open(), label: "Suspend with reason 2", msg: "6.10", req: st(2, 2), expect: 1024 }, { label: "Suspend again", msg: "6.10", req: st(2, 2), expect: 1211 }, { label: "Reopen", msg: "6.10", req: st(1, 2), expect: 1024 }, { label: "Reopen an open account", msg: "6.10", req: st(1, 2), expect: 1208 }]),
      mk("K.2", "Reasons ADM sets", [{ do: open(), label: "Suspend with reason 9", msg: "6.10", req: st(2, 9), expect: 1234 }, { label: "Suspend with reason 11", msg: "6.10", req: st(2, 11), expect: 1234 }, { label: "Suspend with reason 7", msg: "6.10", req: st(2, 7), expect: 1024 }]),
      mk("K.3", "A block follows a suspension", [{ do: open(), label: "Block from open", msg: "6.10", req: st(5, 10), expect: 1505 }, { label: "Suspend", msg: "6.10", req: st(2, 10), expect: 1024 }, { label: "Block", msg: "6.10", req: st(5, 10), expect: 1024 }, { label: "Block again", msg: "6.10", req: st(5, 10), expect: 1275 }, { label: "Suspend a blocked account", msg: "6.10", req: st(2, 10), expect: 1507 }]),
      mk("K.4", "A closed account", [{ do: open(), label: "Close", msg: "6.10", req: st(3, 3), expect: 1024 }, { label: "Reopen", msg: "6.10", req: st(1, 2), expect: 1209 }, { label: "Suspend", msg: "6.10", req: st(2, 2), expect: 1212 }, { label: "Close again", msg: "6.10", req: st(3, 3), expect: 1214 }, { label: "Block", msg: "6.10", req: st(5, 10), expect: 1506 }, { label: "Login check", msg: "6.12", req: { id_transazione: "k45", account: "A1", balance: 0 }, expect: 1488 }, { label: "Re-registration creates a new account", msg: "6.1", req: reg(), expect: 1024 }])
    ] }
  ];
  var messages = [
    { id: "6.1", name: "Account opening", template: reg() }, { id: "6.12", name: "Sub-registration", template: { id_transazione: "ff2", account: "A1", balance: 10000 } },
    { id: "6.3", name: "Movement", template: mv() }, { id: "6.10", name: "Status change", template: { id_transazione: "ff4", account: "A1", target: 2, reason: 2 } },
    { id: "6.16", name: "Self-exclusion", template: { id_transazione: "ff5", account: "A1", type: 6, duration: 30 } }, { id: "6.32", name: "Disconnection", template: { id_transazione: "ff6", account: "A1", receipt: "" } }
  ];
  var coverage = [
    { rule: "1 to 14", text: "Opening conditions, refusals and first-activation caps", cases: ["A.1", "A.2", "A.3", "A.4", "A.5"] }, { rule: "15, 16", text: "Login check refusals by state and self-exclusion", cases: ["B.1", "B.2", "B.3"] },
    { rule: "10, 13", text: "Resend with the same transaction ID; 6.32 once per receipt", cases: ["B.4", "B.5"] }, { rule: "18, 22", text: "Record first; state refusals on movements", cases: ["C.1", "C.3"] },
    { rule: "21", text: "Reversal windows 15 and 196 days", cases: ["C.5"] }, { rule: "22, 24", text: "Deposit limit and PVR cap", cases: ["C.2", "C.4"] }, { rule: "28", text: "Credits are not refused by state", cases: ["D.1"] },
    { rule: "29, 30", text: "Bonus award and reversal", cases: ["D.2", "D.3"] }, { rule: "33", text: "Limit change refused when equal (1460)", cases: ["H.1"] }, { rule: "38 to 44", text: "Self-exclusion durations and reactivation", cases: ["J.1", "J.2", "J.3"] },
    { rule: "47 to 55", text: "States, reasons, closure", cases: ["K.1", "K.2", "K.3", "K.4"] }
  ];
  g.BENCH = { id: "pacg", title: "PACG Bench", subtitle: "Netbet Italy, CHG-375322, PACG v3.3 (fake data)", kitPage: "CHG-375322.html", startTime: "2026-11-20T09:00:00Z", closedCode: 1517, init: init, handle: function (s, m, q, sb) { var h = H[m]; return h ? h(s, q, sb) : no(1510, "Message not in this bench"); }, groups: groups, messages: messages, codes: codes, coverage: coverage };
})(typeof window !== "undefined" ? window : globalThis);
