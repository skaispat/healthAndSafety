// Supabase Edge Function (deploy with slug: observation)
// Sends the WhatsApp "observation" template to the employee an observation was assigned to.
//
// Invoked from the app right after a row is inserted into public.observations:
//   supabase.functions.invoke('observation', { body: { observation_id } })
//
// Security: the caller only sends an observation_id. Assignee name, department, area,
// description, solution, due date, priority and the phone number are all read from the
// database with the service role, so this endpoint cannot be used to send arbitrary
// content or to arbitrary numbers. Only observations created within the last
// FRESH_WINDOW_MINUTES can trigger a message (prevents replaying old IDs to spam people).
//
// Template "observation" (no media header)
//   BODY:
//     नमस्कार {{1}},                              -> users.full_name (assignee)
//     SKA ISPAT – स्वास्थ्य एवं सुरक्षा निरीक्षण सूचना
//     विभाग: {{2}}                                -> departments.dept_name (observation dept)
//     स्थान (एरिया): {{3}}                         -> observations.area
//     निरीक्षण का विवरण: {{4}}                     -> observations.observation_text
//     सुझाया गया समाधान: {{5}}                     -> observations.solution_text
//     अंतिम तिथि: {{6}}                           -> observations.due_date (IST)
//     प्राथमिकता: {{7}}                           -> observations.priority

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"

const WHATSAPP_ACCESS_TOKEN = Deno.env.get("WHATSAPP_ACCESS_TOKEN")
const WHATSAPP_ENDPOINT = Deno.env.get("WHATSAPP_ENDPOINT")
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")

// Override via secrets if the approved template name/language differs.
const TEMPLATE_NAME = Deno.env.get("OBSERVATION_TEMPLATE") || "observation"
// Language code(s) to try, in order. Meta error #132001 = "no template with this name in this
// language", so we fall through to the next code. Set OBSERVATION_TEMPLATE_LANG to pin one.
const TEMPLATE_LANGUAGES = (Deno.env.get("OBSERVATION_TEMPLATE_LANG") || "en")
  .split(",")
  .map((s: string) => s.trim())
  .filter(Boolean)
const META_TEMPLATE_NOT_FOUND = 132001
const FRESH_WINDOW_MINUTES = 15

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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

// "30 Nov 2026, 05:30 pm" in IST
const formatDueDate = (raw: unknown): string => {
  if (!raw) return "N/A"
  const d = new Date(String(raw))
  if (Number.isNaN(d.getTime())) return cleanParam(raw)
  return d.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  })
}

const PRIORITY_LABELS: Record<string, string> = {
  HIGH: "उच्च (High)",
  MEDIUM: "मध्यम (Medium)",
  LOW: "निम्न (Low)",
}
const formatPriority = (raw: unknown): string => {
  const key = String(raw ?? "").trim().toUpperCase()
  return PRIORITY_LABELS[key] || cleanParam(raw)
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

    const observationId = String(payload?.observation_id ?? "").trim()
    if (!UUID_RE.test(observationId)) {
      return json({ error: "A valid observation_id is required" }, 400)
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    })

    // 1. Load observation
    const { data: obs, error: obsErr } = await supabase
      .from("observations")
      .select("id, created_at, observation_number, dept_id, area, observation_text, solution_text, assigned_to, due_date, priority")
      .eq("id", observationId)
      .maybeSingle()

    if (obsErr) {
      console.error("Observation lookup failed:", obsErr.message)
      return json({ error: "Could not load observation" }, 500)
    }
    if (!obs) return json({ error: "Observation not found" }, 404)

    const ageMinutes = (Date.now() - new Date(obs.created_at).getTime()) / 60000
    if (!(ageMinutes >= -1 && ageMinutes <= FRESH_WINDOW_MINUTES)) {
      console.warn(`Skipping observation ${observationId}: created ${ageMinutes.toFixed(1)} min ago`)
      return json({ error: "Notification window for this observation has expired" }, 409)
    }
    if (obs.assigned_to == null) return json({ error: "Observation has no assignee" }, 422)

    // 2. Load assignee + department in parallel
    const [userRes, deptRes] = await Promise.all([
      supabase
        .from("users")
        .select("emp_id, full_name, department, mobile_number")
        .eq("emp_id", obs.assigned_to)
        .maybeSingle(),
      obs.dept_id != null
        ? supabase.from("departments").select("dept_id, dept_name").eq("dept_id", obs.dept_id).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ])

    if (userRes.error) {
      console.error("Assignee lookup failed:", userRes.error.message)
      return json({ error: "Could not load assignee" }, 500)
    }
    const user = userRes.data
    if (!user) return json({ error: "Assignee not found" }, 404)
    if (deptRes.error) console.warn("Department lookup failed:", deptRes.error.message)

    const to = toWhatsAppNumber(user.mobile_number)
    if (!to) {
      console.warn(`Invalid/missing mobile for emp ${user.emp_id}: "${user.mobile_number}"`)
      return json({ error: "Assignee has no valid mobile number" }, 422)
    }

    const deptName = (deptRes.data as any)?.dept_name || (typeof user.department === "string" ? user.department : "")

    const bodyParams = [
      cleanParam(user.full_name, "Employee"), // {{1}} Name
      cleanParam(deptName),                   // {{2}} Department
      cleanParam(obs.area),                   // {{3}} Area
      cleanParam(obs.observation_text),       // {{4}} Observation
      cleanParam(obs.solution_text),          // {{5}} Suggested solution
      formatDueDate(obs.due_date),            // {{6}} Due date
      formatPriority(obs.priority),           // {{7}} Priority
    ].map((text) => ({ type: "text", text }))

    console.log(
      `Sending ${TEMPLATE_NAME} for observation ${obs.observation_number || observationId} to emp ${user.emp_id} (${to.slice(0, 4)}******${to.slice(-2)})`,
    )

    // 3. Send the WhatsApp template (try each language code until Meta finds the template)
    const sendTemplate = (languageCode: string) =>
      fetch(WHATSAPP_ENDPOINT, {
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
            components: [{ type: "body", parameters: bodyParams }],
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
    console.log(`WhatsApp sent for observation ${observationId} (lang ${usedLanguage}), message id: ${messageId}`)
    return json({ success: true, message_id: messageId })
  } catch (error) {
    console.error("Critical Function Error:", (error as Error)?.message)
    return json({ error: "Internal error" }, 500)
  }
})
