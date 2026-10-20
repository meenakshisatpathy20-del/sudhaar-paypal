// Checks that your PayPal sandbox credentials work for every API Sudhaar uses.
// Usage: node --env-file=.env scripts/paypal-smoke.mjs
const base = "https://api-m.sandbox.paypal.com";
const id = process.env.PAYPAL_CLIENT_ID;
const secret = process.env.PAYPAL_CLIENT_SECRET;
if (!id || !secret) {
  console.error("Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET in .env first.");
  process.exit(1);
}

const results = [];
const check = async (name, fn) => {
  try {
    const detail = await fn();
    results.push(["OK  ", name, detail ?? ""]);
  } catch (e) {
    results.push(["FAIL", name, e.message]);
  }
};

const tokenRes = await fetch(`${base}/v1/oauth2/token`, {
  method: "POST",
  headers: { Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" },
  body: "grant_type=client_credentials",
});
const token = await tokenRes.json();
if (!tokenRes.ok) {
  console.error("Auth failed:", token);
  process.exit(1);
}
console.log("Authenticated. Scopes include payouts:", token.scope.includes("payouts"), "invoicing:", token.scope.includes("invoicing"));

const pp = async (path, method = "GET", body) => {
  const r = await fetch(`${base}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token.access_token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  const json = text ? JSON.parse(text) : {};
  if (!r.ok) throw new Error(`${r.status} ${json.name ?? ""} ${json.message ?? ""} ${json.details?.[0]?.issue ?? ""}`);
  return json;
};

await check("Orders v2: create order with intent AUTHORIZE", async () => {
  const o = await pp("/v2/checkout/orders", "POST", { intent: "AUTHORIZE", purchase_units: [{ amount: { currency_code: "USD", value: "1.00" } }] });
  return `${o.id} (${o.status})`;
});
await check("Invoicing v2: generate next invoice number", async () => (await pp("/v2/invoicing/generate-next-invoice-number", "POST")).invoice_number);
await check("Payouts v1: list endpoint reachable (scope)", async () => (token.scope.includes("payouts") ? "payouts scope present" : Promise.reject(new Error("Enable Payouts for your sandbox app"))));
await check("Webhooks v1: list webhooks", async () => `${(await pp("/v1/notifications/webhooks")).webhooks.length} webhook(s)`);
for (const r of results) console.log(r.join("  "));
process.exit(results.some((r) => r[0] === "FAIL") ? 1 : 0);
