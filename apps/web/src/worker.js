// One Worker serves stakeholders.cc, www, italy and dev.italy.stakeholders.cc.
// Files: italy -> public/italy/, dev.italy -> public/dev-italy/.
const SUBSITES = {
  "italy.stakeholders.cc": "/italy",
  "dev.italy.stakeholders.cc": "/dev-italy",
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const prefix = SUBSITES[url.hostname];
    if (prefix) {
      url.pathname = prefix + url.pathname;
      const res = await env.ASSETS.fetch(new Request(url, request));
      const loc = res.headers.get("Location");
      if (loc) {
        // Redirects from the assets layer must not leak the internal prefix.
        const target = new URL(loc, url);
        if (target.pathname === prefix || target.pathname.startsWith(prefix + "/")) {
          target.pathname = target.pathname.slice(prefix.length) || "/";
        }
        const headers = new Headers(res.headers);
        headers.set("Location", target.pathname + target.search);
        return new Response(null, { status: res.status, headers });
      }
      return res;
    }
    // Sub-site folders are not reachable on the main domain.
    if (Object.values(SUBSITES).some((p) => url.pathname === p || url.pathname.startsWith(p + "/"))) {
      return new Response("Not found", { status: 404 });
    }
    return env.ASSETS.fetch(request);
  },
};
