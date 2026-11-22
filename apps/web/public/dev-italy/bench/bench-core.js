// Bench core: sandbox, transport (stored reply, faults), case runner. Plain JS, runs in the browser and in Node.
(function (g) {
  function clone(o) { return o === undefined ? undefined : JSON.parse(JSON.stringify(o)); }
  function Sandbox(def) { this.def = def; this.reset(); }
  Sandbox.prototype.reset = function () {
    this.clock = new Date(this.def.startTime || "2026-11-20T09:00:00Z").getTime();
    this.state = this.def.init(this);
    this.trace = []; this.last = {};
  };
  Sandbox.prototype.advance = function (ms) { this.clock += ms; };
  Sandbox.prototype.iso = function () { return new Date(this.clock).toISOString().replace(".000Z", "Z"); };
  Sandbox.prototype.send = function (msg, req, opts) {
    opts = opts || {}; req = clone(req) || {};
    var rec = { t: this.iso(), msg: msg, req: clone(req), fault: opts.fault || null }, res;
    if (opts.fault === "closed") {
      res = { code: this.def.closedCode, rule: "Service closed: the request is not processed" };
    } else {
      var tag = String(req.tag || "0"), key = req.id_transazione, prev = this.last[tag];
      if (key && prev && prev.id === key) {
        res = clone(prev.res); res.rule = "Same transaction ID again: the stored reply is returned, nothing is processed twice"; res.replayed = true;
      } else {
        res = this.def.handle(this.state, msg, req, this);
        if (key) this.last[tag] = { id: key, res: clone(res) };
      }
      if (opts.fault === "drop-response") {
        rec.res = { code: null, rule: "Reply lost on the way; the request was processed", dropped: true };
        this.trace.push(rec); return rec.res;
      }
    }
    rec.res = res; this.trace.push(rec); return res;
  };
  Sandbox.prototype.runCase = function (c) {
    this.reset();
    var out = { id: c.id, title: c.title, steps: [], pass: true };
    for (var i = 0; i < c.steps.length; i++) {
      var s = c.steps[i];
      if (s.advance) this.advance(s.advance);
      if (s.do) s.do(this);
      var res = null, ok = true, why = "";
      if (s.msg) {
        var req = typeof s.req === "function" ? s.req(this) : s.req;
        res = this.send(s.msg, req, { fault: s.fault });
        if (s.expect !== undefined && res.code !== s.expect) { ok = false; why = "expected " + s.expect + ", got " + res.code; }
      }
      if (ok && s.assert) { var a = s.assert(this.state, res, this); if (a !== true && a !== undefined) { ok = false; why = typeof a === "string" ? a : "check failed"; } }
      out.steps.push({ n: i + 1, label: s.label, msg: s.msg || "", expect: s.expect, code: res ? res.code : null, rule: res ? res.rule : "", ok: ok, why: why });
      if (!ok) out.pass = false;
    }
    return out;
  };
  Sandbox.prototype.runAll = function () {
    var self = this, all = [];
    this.def.groups.forEach(function (gr) { gr.cases.forEach(function (c) { var r = self.runCase(c); r.group = gr.id; all.push(r); }); });
    return all;
  };
  g.BenchCore = { Sandbox: Sandbox, clone: clone, ok: function (extra, rule) { var r = { code: 1024, rule: rule || "Accepted" }; if (extra) for (var k in extra) r[k] = extra[k]; return r; }, no: function (code, rule) { return { code: code, rule: rule }; } };
  if (typeof module !== "undefined") module.exports = g.BenchCore;
})(typeof window !== "undefined" ? window : globalThis);
