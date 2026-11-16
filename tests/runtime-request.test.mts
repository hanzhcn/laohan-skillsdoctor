import test from "node:test";
import assert from "node:assert/strict";
import { isLocalRequest } from "../lib/runtime/request.ts";

const req = (headers: Record<string, string>) => new Request("http://127.0.0.1:3017/api/runtime", { headers });
test("允许本机同源请求，以及无Origin的本机CLI检查", () => {
  assert.equal(isLocalRequest(req({ host: "127.0.0.1:3017", origin: "http://127.0.0.1:3017" })), true);
  assert.equal(isLocalRequest(req({ host: "localhost:3017" })), true);
});
test("Next把URL规范成127后，实际恶意Host仍须拒绝", () => {
  assert.equal(isLocalRequest(req({ host: "untrusted.example" })), false);
  assert.equal(isLocalRequest(req({ host: "untrusted.example:3017" })), false);
  assert.equal(isLocalRequest(req({ host: "untrusted.example@localhost:3017" })), false);
  assert.equal(isLocalRequest(req({ host: "localhost:9999" })), false);
  assert.equal(isLocalRequest(req({ host: "localhost:99999" })), false);
});
test("拒绝跨源、跨站和缺少Host的请求", () => {
  assert.equal(isLocalRequest(req({ host: "127.0.0.1:3017", origin: "https://untrusted.example" })), false);
  assert.equal(isLocalRequest(req({ host: "127.0.0.1:3017", "sec-fetch-site": "cross-site" })), false);
  assert.equal(isLocalRequest(req({})), false);
});
