var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// ../netlify/functions/visits.mjs
var visits_exports = {};
__export(visits_exports, {
  config: () => config,
  handler: () => handler
});
module.exports = __toCommonJS(visits_exports);
var config = { path: "/.netlify/functions/visits" };
var COUNTERAPI_KEY = process.env.COUNTERAPI_KEY || "ut_7Uo9GPMvyfkWksgyQ76McMTUQ50SE43bNDSyGaZp";
var COUNTERAPI_COUNTER = process.env.COUNTERAPI_COUNTER || "First Counter";
var TIMEOUT_MS = 4e3;
var COUNTAPI_NS = "lindabout.com";
var COUNTAPI_KEY_FALLBACK = "visits";
function timeoutFetch(input, init, ms = TIMEOUT_MS) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  return fetch(input, { ...init, signal: ctrl.signal }).finally(
    () => clearTimeout(id)
  );
}
async function counterapiHit() {
  const url = `https://counterapi.dev/api/v1/${COUNTERAPI_COUNTER}/increment`;
  const res = await timeoutFetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${COUNTERAPI_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ amount: 1 })
  });
  const txt = await res.text();
  let json;
  try {
    json = JSON.parse(txt);
  } catch {
    json = { raw: txt };
  }
  if (!res.ok)
    throw new Error(`CounterAPI.dev ${res.status}: ${txt.slice(0, 100)}`);
  const value = Number(json?.value ?? json?.count ?? json?.total ?? 0);
  if (!Number.isFinite(value)) throw new Error("invalid numeric response");
  return value;
}
async function counterapiGet() {
  const url = `https://counterapi.dev/api/v1/${COUNTERAPI_COUNTER}`;
  const res = await timeoutFetch(url, {
    headers: { Authorization: `Bearer ${COUNTERAPI_KEY}` }
  });
  const txt = await res.text();
  let json;
  try {
    json = JSON.parse(txt);
  } catch {
    json = { raw: txt };
  }
  if (!res.ok)
    throw new Error(`CounterAPI.dev ${res.status}: ${txt.slice(0, 100)}`);
  const value = Number(json?.value ?? json?.count ?? json?.total ?? 0);
  if (!Number.isFinite(value)) throw new Error("invalid numeric response");
  return value;
}
async function countapiXYZHit() {
  const url = `https://api.countapi.xyz/hit/${COUNTAPI_NS}/${COUNTAPI_KEY_FALLBACK}`;
  const res = await timeoutFetch(url);
  const j = await res.json().catch(() => ({}));
  const value = Number(j?.value ?? 0);
  if (!Number.isFinite(value)) throw new Error("invalid countapi.xyz response");
  return value;
}
async function countapiXYZGet() {
  const url = `https://api.countapi.xyz/get/${COUNTAPI_NS}/${COUNTAPI_KEY_FALLBACK}`;
  const res = await timeoutFetch(url);
  const j = await res.json().catch(() => ({}));
  const value = Number(j?.value ?? 0);
  if (!Number.isFinite(value)) throw new Error("invalid countapi.xyz response");
  return value;
}
async function handler(event) {
  const mode = (event.queryStringParameters?.mode || "hit").toLowerCase();
  const useCounterApi = Boolean(COUNTERAPI_KEY);
  try {
    let value;
    if (mode === "get") {
      value = useCounterApi ? await counterapiGet() : await countapiXYZGet();
    } else {
      value = useCounterApi ? await counterapiHit() : await countapiXYZHit();
    }
    return {
      statusCode: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        value,
        backend: useCounterApi ? "CounterAPI.dev" : "CountAPI.xyz"
      })
    };
  } catch (err) {
    return {
      statusCode: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        value: 0,
        backend: useCounterApi ? "CounterAPI.dev" : "CountAPI.xyz",
        error: String(err?.message || err)
      })
    };
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  config,
  handler
});
//# sourceMappingURL=visits.js.map
