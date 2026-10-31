import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { AsyncLocalStorage } from "node:async_hooks";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";

globalThis.AsyncLocalStorage = AsyncLocalStorage;

// Load the pinned server modules after supplying Next's runtime global; the
// transpiled proxy below also resolves its CommonJS imports through this loader.
const loadModule = createRequire(import.meta.url);
const { NextRequest } = loadModule("next/server");
const clerk = loadModule("@clerk/nextjs/server");
const { unstable_doesMiddlewareMatch } = loadModule("next/experimental/testing/server");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const base = new URL(process.env.BASE_URL || "http://localhost:3020");

// This suite must never send synthetic callback values to a deployed service.
assert.equal(base.protocol, "http:");
assert(["localhost", "127.0.0.1", "[::1]"].includes(base.hostname));

async function main() {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, ".next/prerender-manifest.json"), "utf8"));
  for (const route of ["sign-in", "sign-up"]) {
    assert.equal(manifest.routes[`/${route}`].initialRevalidateSeconds, false);
    assert.equal(manifest.dynamicRoutes[`/${route}/[...${route}]`], undefined);
    for (const extension of ["html", "rsc"]) {
      const content = fs.readFileSync(path.join(root, `.next/server/app/${route}.${extension}`), "utf8");
      assert(!/sessionClaims|sessionId|userId/.test(content));
    }
  }

  // Exercise the real proxy callback and route matcher with auth-result fixtures.
  // This does not replace real Clerk session verification in preview QA.
  const proxyModule = { exports: {} };
  const compiled = ts.transpileModule(fs.readFileSync(path.join(root, "proxy.ts"), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  vm.runInNewContext(compiled, {
    URL,
    exports: proxyModule.exports,
    module: proxyModule,
    require: (name) => name === "@clerk/nextjs/server"
      ? { ...clerk, clerkMiddleware: (callback) => callback }
      : loadModule(name),
  });

  let proxyCases = 0;
  for (const userId of [null, "user_local_fixture"]) {
    for (const pathname of ["/", "/sign-in", "/sign-up", "/sign-in/sso-callback", "/sign-up/verify-email-address", "/home", "/home/projects"]) {
      const url = new URL(pathname, base);
      assert(unstable_doesMiddlewareMatch({ config: proxyModule.exports.config, url: url.href }));
      const response = await proxyModule.exports.default(async () => ({ userId }), new NextRequest(url));
      const protectedRoute = pathname.startsWith("/home");
      const destination = userId ? (protectedRoute ? null : "/home") : (protectedRoute ? "/sign-in" : null);
      assert.equal(response.status, destination ? 307 : 200);
      assert.equal(response.headers.get("location"), destination ? new URL(destination, base).href : null);
      assert.equal(response.headers.get("cache-control"), null);
      proxyCases++;
    }
  }

  let httpCases = 0;
  for (const route of ["sign-in", "sign-up"]) {
    for (const variant of ["a", "b"]) {
      for (const rsc of [false, true]) {
        const headers = rsc ? { RSC: "1" } : {};
        const response = await fetch(new URL(`/${route}?redirect_url=%2Fhome&canary=local-root-${variant}`, base), { headers, redirect: "manual" });
        const content = await response.text();
        assert.equal(response.status, 200);
        assert.equal(response.headers.get("x-nextjs-cache"), "HIT");
        assert(!/local-root-[ab]|sessionClaims|sessionId|userId/.test(content));
        if (rsc) assert.match(response.headers.get("content-type"), /text\/x-component/);
        httpCases++;

        const callback = await fetch(new URL(`/${route}/sso-callback?code=local-code-${variant}&state=local-state-${variant}`, base), { headers, redirect: "manual" });
        const callbackContent = await callback.text();
        assert.equal(callback.status, 200);
        assert.match(callback.headers.get("cache-control"), /private.*no-store/);
        assert.equal(callback.headers.get("x-nextjs-cache"), null);
        assert(callbackContent.includes(`local-code-${variant}`));
        assert(callbackContent.includes(`local-state-${variant}`));
        const other = variant === "a" ? "b" : "a";
        assert(!callbackContent.includes(`local-code-${other}`));
        assert(!callbackContent.includes(`local-state-${other}`));
        httpCases++;
      }
    }
  }
  for (const pathname of ["/sign-in/factor-one", "/sign-up/verify-email-address", "/home", "/home/projects"]) {
    const response = await fetch(new URL(pathname, base), { redirect: "manual" });
    if (pathname.startsWith("/home")) {
      assert.equal(response.status, 307);
      assert.equal(new URL(response.headers.get("location"), base).pathname, "/sign-in");
    } else {
      assert.equal(response.status, 200);
      assert.match(response.headers.get("cache-control"), /private.*no-store/);
    }
    await response.arrayBuffer();
    httpCases++;
  }
  console.log(`PASS: static auth manifests, ${proxyCases} proxy cases, ${httpCases} local HTTP/RSC cases.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
