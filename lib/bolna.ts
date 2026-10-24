import { FlowError } from "./orders";

// Bolna's REST API: place an outbound call from the Sudhaar phone agent ("Call me" on the website).
// POST https://api.bolna.ai/call  { agent_id, recipient_phone_number (E.164), user_data }

export const bolnaConfig = () => ({
  apiKey: (process.env.BOLNA_API_KEY ?? "").trim(),
  agentId: (process.env.BOLNA_AGENT_ID ?? "").trim(),
  fromNumber: (process.env.BOLNA_FROM_NUMBER ?? "").trim(),
  /** The number customers dial, shown on the website (e.g. +91 80 1234 5678). */
  phoneNumber: (process.env.VOICE_PHONE_NUMBER ?? "").trim(),
});
export const callbackEnabled = () => Boolean(bolnaConfig().apiKey && bolnaConfig().agentId);

export async function placeCall(phone10: string, userData: Record<string, string>): Promise<{ callId?: string; status?: string }> {
  const c = bolnaConfig();
  if (!callbackEnabled()) throw new FlowError("Call-back isn't set up on this server.", 503);
  const res = await fetch(`${process.env.BOLNA_API_BASE?.trim() || "https://api.bolna.ai"}/call`, {
    method: "POST",
    headers: { Authorization: `Bearer ${c.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ agent_id: c.agentId, recipient_phone_number: `+91${phone10}`, ...(c.fromNumber ? { from_phone_number: c.fromNumber } : {}), user_data: userData }),
  });
  const json = (await res.json().catch(() => ({}))) as { execution_id?: string; call_id?: string; status?: string; message?: string; detail?: string };
  if (!res.ok) throw new FlowError(`Bolna could not place the call (${res.status}) ${json.message ?? json.detail ?? ""}`.trim(), 502);
  return { callId: json.execution_id ?? json.call_id, status: json.status };
}
