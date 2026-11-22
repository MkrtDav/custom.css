// Bench UI: left list of scenario groups, top bar with mock clock, tabs. Needs bench-core.js and a definition in window.BENCH.
(function () {
  var def = window.BENCH, sb = new BenchCore.Sandbox(def), results = {}, runs = [], sel = def.groups[0].id, tab = "scenarios", ff = { msg: def.messages[0].id, fault: "" };
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); };
  var json = function (o) { return esc(JSON.stringify(o, null, 2)); };
  function badge(r) { return r === undefined ? '<span class="bd nr">NOT RUN</span>' : r.pass ? '<span class="bd ok">PASS</span>' : '<span class="bd bad">FAIL</span>'; }
  function counts() { var p = 0, f = 0, n = 0; def.groups.forEach(function (g) { g.cases.forEach(function (c) { n++; var r = results[c.id]; if (r) r.pass ? p++ : f++; }); }); return { p: p, f: f, n: n }; }
  function shell() {
    document.title = def.title + " - rehearsal bench";
    document.body.innerHTML = '<header class="top"><div class="brand"><b>' + esc(def.title) + '</b><small>' + esc(def.subtitle) + '</small></div>' +
      '<div class="clock"><span>MOCK CLOCK</span><code id="clk"></code><button data-a="adv" data-v="3600000">+1 hour</button><button data-a="adv" data-v="86400000">+1 day</button><button data-a="set">Set...</button></div>' +
      '<div class="acts"><a class="btn" href="../../' + def.kitPage + '">Kit</a><button data-a="reset">Reset sandbox</button><button class="main" data-a="runall">Run all</button><button data-a="export">Export</button><span id="st" class="dot"></span></div></header>' +
      '<div class="notice">Rehearsal with fake data. It is not ADM and not certification evidence. Nothing leaves your browser.</div>' +
      '<div class="layout"><aside id="side"></aside><main><nav class="tabs2" id="tabs"></nav><div id="view"></div></main></div>';
  }
  function side() {
    $("#side").innerHTML = '<input id="flt" placeholder="Filter scenarios / ..." value="">' + def.groups.map(function (g) {
      var pass = g.cases.filter(function (c) { return results[c.id] && results[c.id].pass; }).length, ran = g.cases.filter(function (c) { return results[c.id]; }).length;
      return '<div class="gi' + (g.id === sel ? " on" : "") + '" data-g="' + g.id + '"><span class="gl">' + esc(g.id) + '</span><div><b>' + esc(g.title) + '</b><small>' + esc(g.ticket) + ' · ' + g.cases.length + ' cases' + (ran ? ' · ' + pass + '/' + ran + ' pass' : '') + '</small></div></div>';
    }).join("");
  }
  function tabs() {
    var t = [["scenarios", "Scenarios"], ["freeform", "Free-form"], ["state", "State"], ["trace", "Trace"], ["coverage", "Coverage"], ["runs", "Runs"], ["codes", "Codes"]];
    $("#tabs").innerHTML = t.map(function (x) { return '<button data-t="' + x[0] + '" class="' + (tab === x[0] ? "on" : "") + '">' + x[1] + "</button>"; }).join("");
  }
  function view() {
    var v = $("#view"), c = counts();
    $("#clk").textContent = sb.iso();
    $("#st").title = c.p + " pass, " + c.f + " fail of " + c.n;
    $("#st").className = "dot " + (c.f ? "r" : c.p ? "g" : "");
    if (tab === "scenarios") {
      var g = def.groups.filter(function (x) { return x.id === sel; })[0];
      v.innerHTML = '<h2>' + esc(g.id) + ". " + esc(g.title) + '</h2><p class="meta">' + esc(g.ticket) + ' ' + (g.messages || []).map(function (m) { return "<code>" + esc(m) + "</code>"; }).join(" ") + ' <button class="main sm" data-a="rungroup" data-v="' + g.id + '">Run scenario ' + esc(g.id) + '</button></p><p class="note">' + esc(g.note || "") + '</p>' +
        g.cases.map(function (cs) {
          var r = results[cs.id];
          var body = r ? '<table class="st"><tr><th>#</th><th>Step</th><th>Message</th><th>Expected</th><th>Got</th><th>Rule applied</th></tr>' + r.steps.map(function (s) {
            return '<tr class="' + (s.ok ? "" : "bad") + '"><td>' + s.n + '</td><td>' + esc(s.label) + '</td><td><code>' + esc(s.msg) + '</code></td><td>' + esc(s.expect === undefined ? "" : s.expect) + '</td><td><b>' + esc(s.code === null ? "no reply" : s.code) + '</b></td><td>' + esc(s.rule) + (s.why ? ' <em>' + esc(s.why) + '</em>' : '') + '</td></tr>';
          }).join("") + '</table>' : '<p class="note">Not run yet. Steps: ' + cs.steps.map(function (s) { return esc(s.label); }).join("; ") + '.</p>';
          return '<details class="case" ' + (r && !r.pass ? "open" : "") + '><summary><span>' + esc(cs.id) + '</span><b>' + esc(cs.title) + '</b><i>' + cs.steps.length + ' steps</i>' + badge(r) + ' <button class="sm" data-a="runcase" data-v="' + cs.id + '">Run</button></summary>' + body + "</details>";
        }).join("");
    } else if (tab === "freeform") {
      var m = def.messages.filter(function (x) { return x.id === ff.msg; })[0];
      v.innerHTML = '<h2>Free-form request</h2><p class="note">Send any message to the mock. The sandbox state carries over between sends. Use a fresh transaction ID for a new request; the same ID returns the stored reply.</p>' +
        '<div class="ffrow"><select id="ffm">' + def.messages.map(function (x) { return '<option value="' + esc(x.id) + '"' + (x.id === ff.msg ? " selected" : "") + ">" + esc(x.id + " " + x.name) + "</option>"; }).join("") + '</select><select id="fff"><option value="">no fault</option><option value="closed">closed (service closed)</option><option value="drop-response">drop-response</option></select><button class="main sm" data-a="ffsend">Send</button></div>' +
        '<textarea id="ffreq" rows="14">' + esc(JSON.stringify(m.template, null, 2)) + '</textarea><h3>Reply</h3><pre id="ffres">(none yet)</pre>';
    } else if (tab === "state") {
      v.innerHTML = '<h2>State of the sandbox</h2><pre>' + json(sb.state) + '</pre>';
    } else if (tab === "trace") {
      v.innerHTML = '<h2>Trace</h2>' + (sb.trace.length ? '<table class="st"><tr><th>Time (mock)</th><th>Message</th><th>Reply</th><th>Rule applied</th></tr>' + sb.trace.slice().reverse().map(function (r) { return '<tr><td>' + esc(r.t) + '</td><td><code>' + esc(r.msg) + '</code>' + (r.fault ? ' <em>' + esc(r.fault) + '</em>' : '') + '</td><td><b>' + esc(r.res.code === null ? "no reply" : r.res.code) + '</b></td><td>' + esc(r.res.rule) + '</td></tr>'; }).join("") + '</table>' : '<p class="note">Nothing sent yet. The trace shows the last sandbox only; a case run resets it.</p>');
    } else if (tab === "coverage") {
      v.innerHTML = '<h2>Coverage of the kit rules</h2><p class="note">Each rule of the kit with the cases that check it. Green means all those cases passed in the last run.</p><table class="st"><tr><th>Kit rule</th><th>What it says</th><th>Cases</th><th></th></tr>' + def.coverage.map(function (r) {
        var st = r.cases.map(function (id) { return results[id]; }), done = st.every(function (x) { return x; }), good = done && st.every(function (x) { return x.pass; });
        return '<tr><td>' + esc(r.rule) + '</td><td>' + esc(r.text) + '</td><td>' + r.cases.map(function (id) { return "<code>" + id + "</code>"; }).join(" ") + '</td><td>' + (!done ? '<span class="bd nr">NOT RUN</span>' : good ? '<span class="bd ok">PASS</span>' : '<span class="bd bad">FAIL</span>') + '</td></tr>';
      }).join("") + '</table>';
    } else if (tab === "runs") {
      v.innerHTML = '<h2>Runs</h2>' + (runs.length ? '<table class="st"><tr><th>Time</th><th>Cases</th><th>Pass</th><th>Fail</th></tr>' + runs.map(function (r) { return '<tr><td>' + esc(r.at) + '</td><td>' + r.n + '</td><td>' + r.p + '</td><td>' + r.f + '</td></tr>'; }).join("") + '</table>' : '<p class="note">No full run yet. Press Run all.</p>');
    } else {
      v.innerHTML = '<h2>Return codes</h2><table class="st"><tr><th>Code</th><th>Meaning</th></tr>' + Object.keys(def.codes).map(function (k) { return '<tr><td><code>' + esc(k) + '</code></td><td>' + esc(def.codes[k]) + '</td></tr>'; }).join("") + '</table>';
    }
  }
  function paint() { side(); tabs(); view(); }
  function runAll() {
    results = {}; var all = sb.runAll(); all.forEach(function (r) { results[r.id] = r; });
    var c = counts(); runs.unshift({ at: new Date().toISOString().slice(0, 19).replace("T", " "), n: c.n, p: c.p, f: c.f });
  }
  function exportMd() {
    var c = counts(), md = "# " + def.title + " run\n\nFake data rehearsal. Not ADM, not certification evidence.\n\n" + c.p + " pass, " + c.f + " fail of " + c.n + " cases.\n\n";
    def.groups.forEach(function (g) { md += "## " + g.id + ". " + g.title + "\n\n"; g.cases.forEach(function (cs) { var r = results[cs.id]; md += "- " + cs.id + " " + cs.title + ": " + (r ? (r.pass ? "PASS" : "FAIL") : "not run") + "\n"; if (r && !r.pass) r.steps.filter(function (s) { return !s.ok; }).forEach(function (s) { md += "  - step " + s.n + " " + s.label + ": " + s.why + "\n"; }); }); md += "\n"; });
    var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([md], { type: "text/markdown" })); a.download = def.id + "-bench-run.md"; a.click();
  }
  shell(); paint();
  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-a],[data-t],[data-g]"); if (!b) return;
    if (b.dataset.g) { sel = b.dataset.g; tab = "scenarios"; paint(); return; }
    if (b.dataset.t) { tab = b.dataset.t; paint(); return; }
    var a = b.dataset.a, v = b.dataset.v;
    if (a === "adv") { sb.advance(Number(v)); view(); }
    else if (a === "set") { var x = prompt("Mock time (ISO, UTC)", sb.iso()); if (x && !isNaN(Date.parse(x))) { sb.clock = Date.parse(x); view(); } }
    else if (a === "reset") { sb.reset(); results = {}; paint(); }
    else if (a === "runall") { runAll(); paint(); }
    else if (a === "export") exportMd();
    else if (a === "rungroup") { var gr = def.groups.filter(function (g) { return g.id === v; })[0]; gr.cases.forEach(function (cs) { results[cs.id] = sb.runCase(cs); }); paint(); }
    else if (a === "runcase") { e.preventDefault(); def.groups.forEach(function (g) { g.cases.forEach(function (cs) { if (cs.id === v) results[cs.id] = sb.runCase(cs); }); }); paint(); }
    else if (a === "ffsend") {
      var msg = $("#ffm").value, fault = $("#fff").value, req; try { req = JSON.parse($("#ffreq").value); } catch (err) { $("#ffres").textContent = "Request is not valid JSON"; return; }
      var res = sb.send(msg, req, { fault: fault }); ff.msg = msg; $("#ffres").textContent = JSON.stringify(res, null, 2); $("#clk").textContent = sb.iso();
    }
  });
  document.addEventListener("change", function (e) { if (e.target.id === "ffm") { ff.msg = e.target.value; var m = def.messages.filter(function (x) { return x.id === ff.msg; })[0]; $("#ffreq").value = JSON.stringify(m.template, null, 2); } });
  document.addEventListener("input", function (e) { if (e.target.id === "flt") { var q = e.target.value.toLowerCase(); [].forEach.call(document.querySelectorAll(".gi"), function (el) { el.style.display = el.textContent.toLowerCase().indexOf(q) < 0 ? "none" : ""; }); } });
})();
