import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { createPublicKey, verify } from "node:crypto";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

function loadLocalEnv() {
  try {
    const file = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
    for (const line of file.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!match || match[1].startsWith("#") || process.env[match[1]]) continue;
      process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, "$2");
    }
  } catch {}
}
loadLocalEnv();

const port = Number(process.env.PORT || process.env.API_PORT || 3001);
const distDirectory = resolve(fileURLToPath(new URL("../dist", import.meta.url)));
const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, "");
const supabaseKey = process.env.SUPABASE_SECRET_KEY;
const apiClientId = process.env.ENTRA_API_CLIENT_ID;
const allowedTenantId = process.env.ENTRA_TENANT_ID?.toLowerCase();
const jwksCache = new Map();

function json(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(body));
}

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
};

async function serveFrontend(req, res, pathname) {
  if (req.method !== "GET" && req.method !== "HEAD") return false;
  let requestedPath;
  try {
    requestedPath = decodeURIComponent(pathname);
  } catch {
    return false;
  }
  const candidate = resolve(distDirectory, `.${requestedPath}`);
  if (candidate !== distDirectory && !candidate.startsWith(`${distDirectory}${sep}`)) return false;
  let filePath = candidate;
  try {
    if (!(await stat(filePath)).isFile()) throw new Error("Not a file");
  } catch {
    // Client-side routes such as /operator and /student are handled by React.
    if (extname(requestedPath)) return false;
    filePath = resolve(distDirectory, "index.html");
    try {
      await stat(filePath);
    } catch {
      return false;
    }
  }
  const body = await readFile(filePath);
  const isHtml = filePath.endsWith(".html");
  res.writeHead(200, {
    "Content-Type": contentTypes[extname(filePath)] || "application/octet-stream",
    "Cache-Control": isHtml ? "no-cache" : "public, max-age=31536000, immutable",
  });
  res.end(req.method === "HEAD" ? undefined : body);
  return true;
}

async function readBody(req) {
  if (req.body !== undefined) {
    if (typeof req.body === "string") return req.body ? JSON.parse(req.body) : {};
    return req.body || {};
  }
  let body = "";
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 20_000) throw new Error("Request body is too large.");
  }
  return body ? JSON.parse(body) : {};
}

async function verifyAccessToken(req) {
  if (!apiClientId || !allowedTenantId) throw new Error("Set ENTRA_API_CLIENT_ID and ENTRA_TENANT_ID in .env.local.");
  const token = req.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) throw new Error("Sign in again to continue.");
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("The Microsoft access token is invalid.");
  const decode = (part) => JSON.parse(Buffer.from(part, "base64url").toString("utf8"));
  const header = decode(parts[0]);
  const claims = decode(parts[1]);
  if (header.alg !== "RS256" || !header.kid) throw new Error("The Microsoft access token uses an unsupported signing method.");
  if (!claims.tid || claims.tid.toLowerCase() !== allowedTenantId) throw new Error("This Entra tenant is not enabled for the demo.");
  if (claims.aud !== apiClientId) throw new Error("The token was not issued for the helpdesk API. Check the Entra API scope configuration.");
  if (claims.iss !== `https://login.microsoftonline.com/${claims.tid}/v2.0`) throw new Error("The Microsoft token issuer is not valid.");
  if (!claims.oid || !claims.exp || claims.exp <= Date.now() / 1000 || (claims.nbf && claims.nbf > Date.now() / 1000)) {
    throw new Error("The Microsoft access token has expired or is missing required identity claims.");
  }
  if (!String(claims.scp || "").split(" ").includes("access_as_user")) throw new Error("The token does not include the helpdesk access scope.");

  let keys = jwksCache.get(claims.tid);
  if (!keys || keys.expires < Date.now()) {
    const response = await fetch(`https://login.microsoftonline.com/${claims.tid}/discovery/v2.0/keys`);
    if (!response.ok) throw new Error("Could not verify the Microsoft sign-in token.");
    keys = { values: (await response.json()).keys, expires: Date.now() + 60 * 60 * 1000 };
    jwksCache.set(claims.tid, keys);
  }
  const jwk = keys.values.find((key) => key.kid === header.kid);
  if (!jwk) {
    jwksCache.delete(claims.tid);
    throw new Error("The Microsoft signing key could not be found. Please sign in again.");
  }
  const publicKey = createPublicKey({ key: jwk, format: "jwk" });
  const valid = verify("RSA-SHA256", Buffer.from(`${parts[0]}.${parts[1]}`), publicKey, Buffer.from(parts[2], "base64url"));
  if (!valid) throw new Error("The Microsoft access token signature is invalid.");
  return { tenantId: claims.tid, objectId: claims.oid, name: claims.name || "", email: claims.preferred_username || "" };
}

async function supabase(path, options = {}) {
  if (!supabaseUrl || !supabaseKey) throw new Error("Set SUPABASE_URL and SUPABASE_SECRET_KEY in .env.local.");
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: supabaseKey,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  const raw = await response.text();
  let data;
  try { data = raw ? JSON.parse(raw) : null; } catch { data = raw; }
  if (!response.ok) {
    const error = new Error(data?.message || data?.hint || `Database request returned ${response.status}.`);
    error.status = 502;
    throw error;
  }
  return data;
}

async function requireTechnician(req) {
  const identity = await verifyAccessToken(req);
  const query = new URLSearchParams({
    select: "id,display_name,site_id,can_view_all_tickets",
    entra_tenant_id: `eq.${identity.tenantId}`,
    entra_object_id: `eq.${identity.objectId}`,
    is_active: "eq.true",
    limit: "1",
  });
  const rows = await supabase(`technicians?${query}`);
  if (!rows?.length) {
    const error = new Error("Your signed-in account is not registered as a student technician yet. Add its Entra tenant ID and object ID to the technicians table.");
    error.status = 403;
    throw error;
  }
  return { ...rows[0], tenantId: identity.tenantId };
}

const ticketSelect = "id,ticket_number,ticket_reference,requester_name,requester_email,site_id,title,description,category,priority,status,assigned_technician_id,created_at,updated_at,sites(name),technicians(display_name),ticket_activity(note,created_at)";

async function createTicket(input, actor) {
  const name = String(input.requester_name || "").trim();
  const email = String(input.requester_email || "").trim();
  const title = String(input.title || "").trim();
  const description = String(input.description || "").trim();
  const category = String(input.category || "").trim();
  const siteCode = String(input.site_code || "").trim().toLowerCase();
  const priority = actor.type === "technician" ? String(input.priority || "normal").toLowerCase() : "normal";
  const requesterObjectId = actor.type === "technician" ? String(input.requester_object_id || "").trim().toLowerCase() : "";
  if (requesterObjectId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requesterObjectId)) {
    const error = new Error("Select a student from the Entra search results, or clear the student details and enter them manually.");
    error.status = 400;
    throw error;
  }
  if (!name || !email || !title || !description || !category || !siteCode || !["low", "normal", "high"].includes(priority)) {
    const error = new Error("Complete each required field before submitting the ticket.");
    error.status = 400;
    throw error;
  }
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    const error = new Error("Enter a valid student contact email address.");
    error.status = 400;
    throw error;
  }
  const sites = await supabase(`sites?${new URLSearchParams({ select: "id,code,name", code: `eq.${siteCode}`, limit: "1" })}`);
  if (!sites?.length) {
    const error = new Error("Choose one of the available helpdesk sites.");
    error.status = 400;
    throw error;
  }
  const site = sites[0];
  const technicians = await supabase(`technicians?${new URLSearchParams({ select: "id,display_name", site_id: `eq.${site.id}`, is_active: "eq.true", order: "created_at.asc", limit: "1" })}`);
  if (!technicians?.length) {
    const error = new Error(`There are no active student technicians at ${site.name} yet. Please contact the helpdesk directly.`);
    error.status = 409;
    throw error;
  }
  const technician = technicians[0];
  const inserted = await supabase("tickets?select=id", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      requester_name: name.slice(0, 160), requester_email: email.slice(0, 254),
      ...(actor.type === "requester"
        ? { requester_tenant_id: actor.identity.tenantId, requester_object_id: actor.identity.objectId }
        : requesterObjectId
          ? { requester_tenant_id: actor.tenantId, requester_object_id: requesterObjectId }
          : {}),
      title: title.slice(0, 200), description: description.slice(0, 5000),
      category: category.slice(0, 100), priority, status: "new",
      assigned_technician_id: technician.id, site_id: site.id,
    }),
  });
  const ticketId = inserted[0].id;
  await supabase("ticket_activity", {
    method: "POST", headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      ticket_id: ticketId,
      actor_type: actor.type,
      ...(actor.type === "technician" ? { actor_technician_id: actor.technicianId } : {}),
      activity_type: "created",
      note: actor.type === "technician" ? `Logged by ${actor.displayName} on behalf of the student.` : "Submitted through the student self-service portal.",
    }),
  });
  const query = new URLSearchParams({ select: ticketSelect, id: `eq.${ticketId}`, limit: "1" });
  return (await supabase(`tickets?${query}`))[0];
}

async function findTicketForTechnician(ticketId, technicianId) {
  const query = new URLSearchParams({
    select: "id,ticket_number,requester_name,requester_email,site_id,title,description,category,priority,status,assigned_technician_id",
    id: `eq.${ticketId}`,
    assigned_technician_id: `eq.${technicianId}`,
    limit: "1",
  });
  const rows = await supabase(`tickets?${query}`);
  return rows?.[0];
}

async function findTicketVisibleToTechnician(ticketId, technician) {
  const filters = {
    select: "id",
    id: `eq.${ticketId}`,
    limit: "1",
  };
  if (!technician.can_view_all_tickets) {
    filters.assigned_technician_id = `eq.${technician.id}`;
  }
  const rows = await supabase(`tickets?${new URLSearchParams(filters)}`);
  return rows?.[0];
}

async function findTicketForRequester(ticketId, identity) {
  const query = new URLSearchParams({
    select: "id",
    id: `eq.${ticketId}`,
    requester_tenant_id: `eq.${identity.tenantId}`,
    requester_object_id: `eq.${identity.objectId}`,
    limit: "1",
  });
  const rows = await supabase(`tickets?${query}`);
  return rows?.[0];
}

async function getTicketComments(ticketId) {
  const query = new URLSearchParams({
    select: "id,author_type,author_technician_id,message,created_at,technicians(display_name)",
    ticket_id: `eq.${ticketId}`,
    order: "created_at.asc",
  });
  return supabase(`ticket_comments?${query}`);
}

async function addTicketComment(ticketId, input, author) {
  const message = String(input.message || "").trim();
  if (!message || message.length > 5000) {
    const error = new Error("Write a comment of up to 5,000 characters before sending.");
    error.status = 400;
    throw error;
  }
  await supabase("ticket_comments", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      ticket_id: ticketId,
      author_type: author.type,
      ...(author.type === "technician" ? { author_technician_id: author.technicianId } : {}),
      message,
    }),
  });
  return getTicketComments(ticketId);
}

export async function handleRequest(req, res) {
  try {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    if (req.method === "GET" && url.pathname === "/api/health") return json(res, 200, { ok: true });
    if (!url.pathname.startsWith("/api/")) {
      if (await serveFrontend(req, res, url.pathname)) return;
      return json(res, 404, { error: "Not found." });
    }
    if (req.method === "GET" && url.pathname === "/api/sites") {
      const query = new URLSearchParams({ select: "code,name", order: "name.asc" });
      return json(res, 200, await supabase(`sites?${query}`));
    }
    const studentCommentsMatch = url.pathname.match(/^\/api\/student\/tickets\/([0-9a-f-]+)\/comments$/i);
    if (studentCommentsMatch && ["GET", "POST"].includes(req.method)) {
      const identity = await verifyAccessToken(req);
      const ticket = await findTicketForRequester(studentCommentsMatch[1], identity);
      if (!ticket) return json(res, 404, { error: "That ticket does not belong to your account." });
      if (req.method === "GET") return json(res, 200, await getTicketComments(ticket.id));
      return json(res, 201, await addTicketComment(ticket.id, await readBody(req), { type: "requester" }));
    }
    if (req.method === "GET" && url.pathname === "/api/student/tickets") {
      const identity = await verifyAccessToken(req);
      const query = new URLSearchParams({
        select: ticketSelect,
        requester_tenant_id: `eq.${identity.tenantId}`,
        requester_object_id: `eq.${identity.objectId}`,
        order: "created_at.desc",
      });
      return json(res, 200, await supabase(`tickets?${query}`));
    }
    if (req.method === "POST" && url.pathname === "/api/student/tickets") {
      const identity = await verifyAccessToken(req);
      const input = await readBody(req);
      return json(res, 201, await createTicket({
        ...input,
        requester_name: identity.name || input.requester_name,
        requester_email: identity.email || input.requester_email,
      }, { type: "requester", identity }));
    }
    const technician = await requireTechnician(req);

    const technicianCommentsMatch = url.pathname.match(/^\/api\/tickets\/([0-9a-f-]+)\/comments$/i);
    if (technicianCommentsMatch && ["GET", "POST"].includes(req.method)) {
      const ticket = req.method === "GET"
        ? await findTicketVisibleToTechnician(technicianCommentsMatch[1], technician)
        : await findTicketForTechnician(technicianCommentsMatch[1], technician.id);
      if (!ticket) return json(res, 404, { error: "That ticket is not assigned to your account." });
      if (req.method === "GET") return json(res, 200, await getTicketComments(ticket.id));
      return json(res, 201, await addTicketComment(ticket.id, await readBody(req), { type: "technician", technicianId: technician.id }));
    }

    if (req.method === "GET" && url.pathname === "/api/ticket-replies") {
      const since = url.searchParams.get("since");
      const sinceDate = new Date(since || "");
      if (!since || Number.isNaN(sinceDate.getTime())) return json(res, 400, { error: "A valid since timestamp is required." });
      const query = new URLSearchParams({
        select: "id,ticket_id,message,created_at,tickets!inner(id,ticket_number,ticket_reference,title,requester_name,assigned_technician_id)",
        author_type: "eq.requester",
        created_at: `gt.${sinceDate.toISOString()}`,
        "tickets.assigned_technician_id": `eq.${technician.id}`,
        order: "created_at.asc",
      });
      return json(res, 200, await supabase(`ticket_comments?${query}`));
    }

    if (req.method === "GET" && url.pathname === "/api/operator/profile") {
      return json(res, 200, {
        id: technician.id,
        canViewAllTickets: Boolean(technician.can_view_all_tickets),
      });
    }

    if (req.method === "GET" && url.pathname === "/api/tickets") {
      const filters = { select: ticketSelect, order: "created_at.desc" };
      if (!technician.can_view_all_tickets) {
        filters.assigned_technician_id = `eq.${technician.id}`;
      }
      const query = new URLSearchParams(filters);
      return json(res, 200, await supabase(`tickets?${query}`));
    }

    if (req.method === "POST" && url.pathname === "/api/tickets") {
      return json(res, 201, await createTicket(await readBody(req), { type: "technician", technicianId: technician.id, tenantId: technician.tenantId, displayName: technician.display_name }));
    }

    const editMatch = url.pathname.match(/^\/api\/tickets\/([0-9a-f-]+)$/i);
    if (req.method === "PATCH" && editMatch) {
      const ticket = await findTicketForTechnician(editMatch[1], technician.id);
      if (!ticket) return json(res, 404, { error: "That ticket is not assigned to your account." });
      const input = await readBody(req);
      const name = String(input.requester_name || "").trim();
      const email = String(input.requester_email || "").trim();
      const title = String(input.title || "").trim();
      const description = String(input.description || "").trim();
      const category = String(input.category || "").trim();
      const priority = String(input.priority || "").toLowerCase();
      if (!name || !email || !title || !description || !category || !["low", "normal", "high"].includes(priority)) {
        return json(res, 400, { error: "Complete each required field before saving your changes." });
      }
      if (!/^\S+@\S+\.\S+$/.test(email)) return json(res, 400, { error: "Enter a valid student contact email address." });
      const filter = new URLSearchParams({ id: `eq.${ticket.id}`, assigned_technician_id: `eq.${technician.id}` });
      await supabase(`tickets?${filter}`, {
        method: "PATCH",
        body: JSON.stringify({
          requester_name: name.slice(0, 160), requester_email: email.slice(0, 254),
          title: title.slice(0, 200), description: description.slice(0, 5000),
          category: category.slice(0, 100), priority,
        }),
      });
      await supabase("ticket_activity", {
        method: "POST", headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ ticket_id: ticket.id, actor_type: "technician", actor_technician_id: technician.id, activity_type: "note", note: `Ticket details updated by ${technician.display_name}.` }),
      });
      const query = new URLSearchParams({ select: ticketSelect, id: `eq.${ticket.id}`, limit: "1" });
      return json(res, 200, (await supabase(`tickets?${query}`))[0]);
    }

    const actionMatch = url.pathname.match(/^\/api\/tickets\/([0-9a-f-]+)\/actions$/i);
    if (req.method === "POST" && actionMatch) {
      const ticket = await findTicketForTechnician(actionMatch[1], technician.id);
      if (!ticket) return json(res, 404, { error: "That ticket is not assigned to your account." });
      const { action } = await readBody(req);
      const actionMap = {
        progress: ["in_progress", "Status changed to In progress."],
        resolve: ["resolved", `Marked resolved by ${technician.display_name}.`],
        escalate: ["escalated", "Escalation handover preview marked ready for on-site support."],
      };
      if (!actionMap[action]) return json(res, 400, { error: "That ticket action is not supported." });
      const [status, note] = actionMap[action];
      const updateQuery = new URLSearchParams({ id: `eq.${ticket.id}`, assigned_technician_id: `eq.${technician.id}` });
      await supabase(`tickets?${updateQuery}`, { method: "PATCH", body: JSON.stringify({ status }) });
      await supabase("ticket_activity", {
        method: "POST", headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ ticket_id: ticket.id, actor_type: "technician", actor_technician_id: technician.id, activity_type: action === "escalate" ? "escalated" : action === "progress" ? "status_changed" : "status_changed", note }),
      });
      return json(res, 200, { ok: true });
    }
    return json(res, 404, { error: "Not found." });
  } catch (error) {
    const status = error.status || (error.message?.includes("Set ") ? 503 : error instanceof SyntaxError ? 400 : 401);
    console.error(`[API] ${req.method} ${(req.url || "").split("?")[0]}: ${error.message || "Request failed."}`);
    return json(res, status, { error: error.message || "The request could not be completed." });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  createServer(handleRequest).listen(port, () => console.log(`Campus Helpdesk listening on port ${port}`));
}

export default handleRequest;

