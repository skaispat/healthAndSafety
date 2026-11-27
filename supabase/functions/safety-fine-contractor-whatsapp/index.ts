// Supabase Edge Function (deploy with slug: safety_fine_contractor)
// Sends the WhatsApp template "safety_fine_contractor" to the CONTRACTOR's phone
// when one of their workers is fined.
//
// Invoked from the app right after a row is inserted into public.safety_fine_contractor:
//   supabase.functions.invoke('safety_fine_contractor', { body: { fine_id } })
//
// Security: the caller only sends a fine_id. Contractor name, phone, department, worker
// name, amount, reason and picture are read from the database with the service role,
// so this endpoint cannot send arbitrary content or message arbitrary numbers.
// Only fines created within the last FRESH_WINDOW_MINUTES can trigger a message.
//
// Template "safety_fine_contractor" (category: UTILITY, language: English "en", Hindi body text)
//   HEADER: IMAGE -> fine picture
//   BODY:
//     नमस्कार {{1}},                      -> contractor_name
//     *SKA ISPAT – सुरक्षा जुर्माना सूचना*
//     ...
//     *कर्मचारी का नाम:* {{2}}             -> emp_name (worker)
//     *विभाग:* {{3}}                       -> contractor.department
//     *जुर्माने की राशि:* {{4}}            -> fine_amount (₹)
//     *कारण:* {{5}}.                       -> reason
//     कृपया प्लांट के सभी सुरक्षा नियमों का पालन करें।

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"

const WHATSAPP_ACCESS_TOKEN = Deno.env.get("WHATSAPP_ACCESS_TOKEN")
const WHATSAPP_ENDPOINT = Deno.env.get("WHATSAPP_ENDPOINT")
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")

// Override via secrets if the approved template name/language differs.
const TEMPLATE_NAME = Deno.env.get("SAFETY_FINE_CONTRACTOR_TEMPLATE") || "safety_fine_contractor"
// Language code(s) to try, in order. Meta error #132001 means "no template with this name in this
// language", so we fall through to the next code. Set SAFETY_FINE_CONTRACTOR_TEMPLATE_LANG to pin one.
const TEMPLATE_LANGUAGES = (Deno.env.get("SAFETY_FINE_CONTRACTOR_TEMPLATE_LANG") || "en,en_US,en_GB,hi")
  .split(",")
  .map((s: string) => s.trim())
  .filter(Boolean)
const META_TEMPLATE_NOT_FOUND = 132001
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

    // 1. Load the contractor fine
    const { data: fine, error: fineErr } = await supabase
      .from("safety_fine_contractor")
      .select("id, created_at, con_id, emp_name, fine_amount, reason, picture")
      .eq("id", fineId)
      .maybeSingle()

    if (fineErr) {
      console.error("Fine lookup failed:", fineErr.message)
      return json({ error: "Could not load fine" }, 500)
    }
    if (!fine) return json({ error: "Fine not found" }, 404)

    const ageMinutes = (Date.now() - new Date(fine.created_at).getTime()) / 60000
    if (!(ageMinutes >= -1 && ageMinutes <= FRESH_WINDOW_MINUTES)) {
      console.warn(`Skipping contractor fine ${fineId}: created ${ageMinutes.toFixed(1)} min ago`)
      return json({ error: "Notification window for this fine has expired" }, 409)
    }

    if (fine.con_id == null) return json({ error: "Fine has no contractor" }, 422)
    if (!fine.picture || !/^https:\/\//i.test(fine.picture)) {
      return json({ error: "Fine has no public image URL" }, 422)
    }

    // 2. Load the contractor
    const { data: contractor, error: cErr } = await supabase
      .from("contractor")
      .select("id, contractor_name, department, phone_number")
      .eq("id", fine.con_id)
      .maybeSingle()

    if (cErr) {
      console.error("Contractor lookup failed:", cErr.message)
      return json({ error: "Could not load contractor" }, 500)
    }
    if (!contractor) return json({ error: "Contractor not found" }, 404)

    const to = toWhatsAppNumber(contractor.phone_number)
    if (!to) {
      console.warn(`Invalid/missing phone for contractor ${contractor.id}: "${contractor.phone_number}"`)
      return json({ error: "Contractor has no valid phone number" }, 422)
    }

    console.log(
      `Sending ${TEMPLATE_NAME} for contractor fine ${fineId} to contractor ${contractor.id} (${to.slice(0, 4)}******${to.slice(-2)})`,
    )

    // 3. Send the WhatsApp template (try each language code until Meta finds the template)
    const sendTemplate = (languageCode: string) => fetch(WHATSAPP_ENDPOINT, {
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
          language: { code: languageCode },
          components: [
            {
              type: "header",
              parameters: [{ type: "image", image: { link: fine.picture } }],
            },
            {
              type: "body",
              parameters: [
                { type: "text", text: cleanParam(contractor.contractor_name, "Contractor") }, // {{1}}
                { type: "text", text: cleanParam(fine.emp_name) },                            // {{2}}
                { type: "text", text: cleanParam(contractor.department) },                    // {{3}}
                { type: "text", text: formatAmount(fine.fine_amount) },                       // {{4}}
                { type: "text", text: cleanParam(fine.reason) },                              // {{5}}
              ],
            },
          ],
        },
      }),
    })

    let response: Response | null = null
    let result: any = {}
    let usedLanguage = ""
    for (const lang of TEMPLATE_LANGUAGES) {
      usedLanguage = lang
      response = await sendTemplate(lang)
      result = await response.json().catch(() => ({}))
      if (response.ok) break
      if (result?.error?.code === META_TEMPLATE_NOT_FOUND) {
        console.warn(`Template "${TEMPLATE_NAME}" not found in language "${lang}", trying next`)
        continue
      }
      break // any other error: stop and report it
    }

    if (!response || !response.ok) {
      console.error("WhatsApp API error:", JSON.stringify(result))
      const notFound = result?.error?.code === META_TEMPLATE_NOT_FOUND
      return json(
        {
          error: notFound
            ? `Template "${TEMPLATE_NAME}" is not approved in any of these languages: ${TEMPLATE_LANGUAGES.join(", ")}. Check its status and language in WhatsApp Manager.`
            : result?.error?.message || `WhatsApp API returned ${response?.status}`,
        },
        502,
      )
    }

    const messageId = result?.messages?.[0]?.id ?? null
    console.log(`WhatsApp sent for contractor fine ${fineId} (lang ${usedLanguage}), message id: ${messageId}`)
    return json({ success: true, message_id: messageId })
  } catch (error) {
    console.error("Critical Function Error:", (error as Error)?.message)
    return json({ error: "Internal error" }, 500)
  }
})
