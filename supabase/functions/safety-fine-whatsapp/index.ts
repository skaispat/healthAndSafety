// Supabase Edge Function: safety-fine-whatsapp
// Sends the WhatsApp template "safety_fine" to the fined employee.
//
// Invoked from the app right after a row is inserted into public.safety_fines:
//   supabase.functions.invoke('safety-fine-whatsapp', { body: { fine_id } })
//
// Security: the caller only sends a fine_id. Name, department, amount, reason,
// picture and phone number are all read from the database with the service role,
// so this endpoint cannot be used to send arbitrary content or to arbitrary numbers.
// Only fines created within the last FRESH_WINDOW_MINUTES can trigger a message,
// which prevents replaying old fine IDs to spam employees.
//
// Template "safety_fine" (language: en)
//   HEADER: IMAGE  -> fine picture
//   BODY:
//     Safety Rule Break!!
//     Name  :  {{1}}
//     Department   : {{2}}
//     Fine Amount : {{3}}
//     Reason : {{4}}.
//     You have break the safety rule.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"

const WHATSAPP_ACCESS_TOKEN = Deno.env.get("WHATSAPP_ACCESS_TOKEN")
const WHATSAPP_ENDPOINT = Deno.env.get("WHATSAPP_ENDPOINT")
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")

const TEMPLATE_NAME = "safety_fine"
const TEMPLATE_LANGUAGE = "en"
const FRESH_WINDOW_MINUTES = 15

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })

// WhatsApp template params may not contain newlines/tabs or >4 consecutive spaces.
const cleanParam = (value: unknown, fallback = "N/A", max = 900): string => {
  const s = String(value ?? "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/ {2,}/g, " ")
    .trim()
  if (!s) return fallback
  return s.length > max ? `${s.slice(0, max - 1)}…` : s
}

// Normalise an Indian phone number to 91XXXXXXXXXX. Returns null if invalid.
const toWhatsAppNumber = (raw: unknown): string | null => {
  let d = String(raw ?? "").replace(/\D/g, "")
  if (d.startsWith("00")) d = d.slice(2)
  if (d.length === 11 && d.startsWith("0")) d = d.slice(1)
  if (d.length === 10) return `91${d}`
  if (d.length === 12 && d.startsWith("91")) return d
  return null
}

const formatAmount = (raw: unknown): string => {
  const n = Number(raw)
  if (!Number.isFinite(n)) return cleanParam(raw)
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405)

  try {
    if (!WHATSAPP_ENDPOINT || !WHATSAPP_ACCESS_TOKEN) {
      console.error("Missing WhatsApp credentials")
      return json({ error: "WhatsApp configuration missing" }, 500)
    }
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error("Missing Supabase credentials")
      return json({ error: "Supabase configuration missing" }, 500)
    }

    let payload: any
    try {
      payload = await req.json()
    } catch {
      return json({ error: "Invalid JSON body" }, 400)
    }

    const fineId = Number(payload?.fine_id)
    if (!Number.isSafeInteger(fineId) || fineId <= 0) {
      return json({ error: "A valid fine_id is required" }, 400)
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    })

    // 1. Load fine
    const { data: fine, error: fineErr } = await supabase
      .from("safety_fines")
      .select("id, created_at, emp_id, fine_amount, reason, picture")
      .eq("id", fineId)
      .maybeSingle()

    if (fineErr) {
      console.error("Fine lookup failed:", fineErr.message)
      return json({ error: "Could not load fine" }, 500)
    }
    if (!fine) return json({ error: "Fine not found" }, 404)

    const ageMinutes = (Date.now() - new Date(fine.created_at).getTime()) / 60000
    if (!(ageMinutes >= -1 && ageMinutes <= FRESH_WINDOW_MINUTES)) {
      console.warn(`Skipping fine ${fineId}: created ${ageMinutes.toFixed(1)} min ago`)
      return json({ error: "Notification window for this fine has expired" }, 409)
    }

    if (!fine.emp_id) return json({ error: "Fine has no employee" }, 422)
    if (!fine.picture || !/^https:\/\//i.test(fine.picture)) {
      return json({ error: "Fine has no public image URL" }, 422)
    }

    // 2. Load employee
    const { data: emp, error: empErr } = await supabase
      .from("users2")
      .select("emp_id, full_name, department, phone_number")
      .eq("emp_id", fine.emp_id)
      .maybeSingle()

    if (empErr) {
      console.error("Employee lookup failed:", empErr.message)
      return json({ error: "Could not load employee" }, 500)
    }
    if (!emp) return json({ error: "Employee not found" }, 404)

    const to = toWhatsAppNumber(emp.phone_number)
    if (!to) {
      console.warn(`Invalid/missing phone for emp ${emp.emp_id}: "${emp.phone_number}"`)
      return json({ error: "Employee has no valid phone number" }, 422)
    }

    console.log(`Sending ${TEMPLATE_NAME} for fine ${fineId} to emp ${emp.emp_id} (${to.slice(0, 4)}******${to.slice(-2)})`)

    // 3. Send WhatsApp template
    const response = await fetch(WHATSAPP_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: {
          name: TEMPLATE_NAME,
          language: { code: TEMPLATE_LANGUAGE },
          components: [
            {
              type: "header",
              parameters: [{ type: "image", image: { link: fine.picture } }],
            },
            {
              type: "body",
              parameters: [
                { type: "text", text: cleanParam(emp.full_name, "Employee") }, // {{1}} Name
                { type: "text", text: cleanParam(emp.department) },            // {{2}} Department
                { type: "text", text: formatAmount(fine.fine_amount) },        // {{3}} Fine Amount
                { type: "text", text: cleanParam(fine.reason) },               // {{4}} Reason
              ],
            },
          ],
        },
      }),
    })

    const result = await response.json().catch(() => ({}))
    if (!response.ok) {
      console.error("WhatsApp API error:", JSON.stringify(result))
      return json(
        { error: result?.error?.message || `WhatsApp API returned ${response.status}` },
        502,
      )
    }

    const messageId = result?.messages?.[0]?.id ?? null
    console.log(`WhatsApp sent for fine ${fineId}, message id: ${messageId}`)
    return json({ success: true, message_id: messageId })
  } catch (error) {
    console.error("Critical Function Error:", (error as Error)?.message)
    return json({ error: "Internal error" }, 500)
  }
})
