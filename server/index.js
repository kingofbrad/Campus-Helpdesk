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
    select: "id,display_name,site_id,can_view_all_tickets,can_manage_directory",
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

function validateGuideInput(input, partial = false) {
  const updates = {};
  if (!partial || input.title !== undefined) updates.title = requiredText(input.title, "Guide title", 140);
  if (!partial || input.category !== undefined) updates.category = requiredText(input.category, "Guide category", 80);
  if (!partial || input.summary !== undefined) updates.summary = requiredText(input.summary, "Guide summary", 500);
  if (!partial || input.steps !== undefined) {
    if (!Array.isArray(input.steps) || input.steps.length < 1 || input.steps.length > 20) throw invalid("Add between 1 and 20 guide steps.");
    updates.steps = input.steps.map((step) => requiredText(step, "Guide step", 500));
  }
  if (!partial || input.icon_key !== undefined) {
    const icon = requiredText(input.icon_key, "Guide icon", 24);
    if (!["wifi", "laptop", "shield", "printer", "volume", "help"].includes(icon)) throw invalid("Choose a supported guide icon.");
    updates.icon_key = icon;
  }
  return updates;
}
function requireDirectoryAdmin(technician) {
  if (!technician.can_manage_directory) {
    const error = new Error("You do not have permission to manage helpdesk sites or technicians.");
    error.status = 403;
    throw error;
  }
}

function invalid(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

function requiredText(value, label, maxLength) {
  const text = String(value || "").trim();
  if (!text || text.length > maxLength) throw invalid(`${label} is required and must be ${maxLength} characters or fewer.`);
  return text;
}

async function getDirectorySites() {
  return supabase(`sites?${new URLSearchParams({ select: "id,code,name,created_at", order: "name.asc" })}`);
}

async function getDirectoryTechnicians() {
  return supabase(`technicians?${new URLSearchParams({ select: "id,entra_tenant_id,entra_object_id,display_name,site_id,is_active,can_view_all_tickets,sites(name)", order: "display_name.asc" })}`);
}

const ticketSelect = "id,ticket_number,ticket_reference,requester_name,requester_email,site_id,title,description,category,priority,status,assigned_technician_id,created_at,updated_at,sites(name),technicians(display_name)";

async function addTicketHistory(ticketId, entries) {
  const rows = (Array.isArray(entries) ? entries : [entries]).filter(Boolean).map((entry) => ({
    ticket_id: ticketId,
    actor_type: entry.actorType || "system",
    ...(entry.actorTechnicianId ? { actor_technician_id: entry.actorTechnicianId } : {}),
    event_type: entry.eventType,
    summary: entry.summary,
    ...(entry.fieldName ? { field_name: entry.fieldName } : {}),
    ...(entry.oldValue !== undefined ? { old_value: entry.oldValue } : {}),
    ...(entry.newValue !== undefined ? { new_value: entry.newValue } : {}),
  }));
  if (rows.length) await supabase("ticket_history", {
    method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify(rows),
  });
}

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
  await addTicketHistory(ticketId, [
    {
      actorType: actor.type,
      actorTechnicianId: actor.type === "technician" ? actor.technicianId : undefined,
      eventType: "created",
      summary: actor.type === "technician" ? "Ticket logged by " + actor.displayName + " on behalf of the student." : "Ticket submitted through the student self-service portal.",
    },
    {
      eventType: "assigned", fieldName: "Assigned technician", newValue: technician.display_name,
      summary: "Assigned to " + technician.display_name + " at " + site.name + ".",
    },
  ]);
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
    select: "id,status",
    id: `eq.${ticketId}`,
    requester_tenant_id: `eq.${identity.tenantId}`,
    requester_object_id: `eq.${identity.objectId}`,
    limit: "1",
  });
  const rows = await supabase(`tickets?${query}`);
  return rows?.[0];
}

async function markTicketCommentsRead(ticketId, readerType) {
  const otherAuthor = readerType === "technician" ? "requester" : "technician";
  const query = new URLSearchParams({
    ticket_id: `eq.${ticketId}`,
    author_type: `eq.${otherAuthor}`,
    read_at: "is.null",
  });
  await supabase(`ticket_comments?${query}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ read_at: new Date().toISOString() }),
  });
}

async function getTicketComments(ticketId) {
  const query = new URLSearchParams({
    select: "id,author_type,author_technician_id,message,created_at,read_at,technicians(display_name)",
    ticket_id: `eq.${ticketId}`,
    order: "created_at.asc",
  });
  return supabase(`ticket_comments?${query}`);
}

async function getUnreadCommentCounts(ticketIds, authorType) {
  if (!ticketIds.length) return {};
  const query = new URLSearchParams({
    select: "ticket_id,created_at",
    ticket_id: `in.(${ticketIds.join(",")})`,
    author_type: `eq.${authorType}`,
    read_at: "is.null",
  });
  const comments = await supabase(`ticket_comments?${query}`);
  return (comments || []).reduce((counts, comment) => {
    const current = counts[comment.ticket_id] || { count: 0, latestAt: null };
    current.count += 1;
    if (!current.latestAt || comment.created_at > current.latestAt) current.latestAt = comment.created_at;
    counts[comment.ticket_id] = current;
    return counts;
  }, {});
}

function withUnreadCommentCounts(tickets, counts) {
  return tickets.map((ticket) => ({
    ...ticket,
    unread_comment_count: counts[ticket.id]?.count || 0,
    latest_unread_comment_at: counts[ticket.id]?.latestAt || null,
  }));
}

async function addTicketComment(ticketId, input, author, previousStatus = null) {
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
  if (author.type === "requester") {
    await supabase(`tickets?id=eq.${ticketId}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "student_updated" }),
    });
    const statusChanged = previousStatus !== "student_updated";
    await addTicketHistory(ticketId, {
      actorType: "requester",
      eventType: statusChanged ? "status_changed" : "note",
      summary: statusChanged ? "Student replied; status changed to Updated by student." : "Student replied to the ticket.",
      ...(statusChanged ? { fieldName: "Status", oldValue: previousStatus || "Unknown", newValue: "Updated by student" } : {}),
    });
  }
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
      if (req.method === "GET") { await markTicketCommentsRead(ticket.id, "requester"); return json(res, 200, await getTicketComments(ticket.id)); }
      return json(res, 201, await addTicketComment(ticket.id, await readBody(req), { type: "requester" }, ticket.status));
    }
    if (req.method === "GET" && url.pathname === "/api/student/tickets") {
      const identity = await verifyAccessToken(req);
      const query = new URLSearchParams({
        select: ticketSelect,
        requester_tenant_id: `eq.${identity.tenantId}`,
        requester_object_id: `eq.${identity.objectId}`,
        order: "created_at.desc",
      });
      const tickets = await supabase(`tickets?${query}`);
      const counts = await getUnreadCommentCounts(tickets.map((ticket) => ticket.id), "technician");
      return json(res, 200, withUnreadCommentCounts(tickets, counts));
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

    if (url.pathname.startsWith("/api/admin/")) {
      requireDirectoryAdmin(technician);
      if (req.method === "GET" && url.pathname === "/api/admin/directory") {
        const [sites, technicians] = await Promise.all([getDirectorySites(), getDirectoryTechnicians()]);
        return json(res, 200, { sites, technicians, tenantId: technician.tenantId });
      }
      if (req.method === "POST" && url.pathname === "/api/admin/knowledge-guides") {
        const input = await readBody(req);
        const id = requiredText(input.id, "Guide ID", 80).toLowerCase();
        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) throw invalid("Guide ID may contain lowercase letters, numbers, and hyphens.");
        const rows = await supabase("knowledge_guides?select=id,title,category,summary,steps,icon_key,sort_order,is_published", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ id, ...validateGuideInput(input), sort_order: Number.isInteger(input.sort_order) ? input.sort_order : 100 }) });
        return json(res, 201, rows[0]);
      }
      const guideMatch = url.pathname.match(/^\/api\/admin\/knowledge-guides\/([a-z0-9-]+)$/i);
      if (guideMatch && req.method === "PATCH") {
        const input = await readBody(req);
        const updates = validateGuideInput(input, true);
        if (input.sort_order !== undefined) updates.sort_order = Number(input.sort_order) || 0;
        if (input.is_published !== undefined) updates.is_published = Boolean(input.is_published);
        if (!Object.keys(updates).length) throw invalid("Provide guide content to update.");
        updates.updated_at = new Date().toISOString();
        const rows = await supabase(`knowledge_guides?${new URLSearchParams({ id: `eq.${guideMatch[1]}`, select: "id,title,category,summary,steps,icon_key,sort_order,is_published" })}`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(updates) });
        if (!rows?.length) return json(res, 404, { error: "That guide could not be found." });
        return json(res, 200, rows[0]);
      }
      if (guideMatch && req.method === "DELETE") {
        await supabase(`knowledge_guides?${new URLSearchParams({ id: `eq.${guideMatch[1]}` })}`, { method: "DELETE" });
        return json(res, 200, { ok: true });
      }
      if (req.method === "PUT" && url.pathname === "/api/admin/student-guidance") {
        const input = await readBody(req);
        const title = requiredText(input.title, "Page title", 140);
        const subtitle = requiredText(input.subtitle, "Page subtitle", 500);
        if (!Array.isArray(input.items) || input.items.length < 1 || input.items.length > 12) throw invalid("Add between 1 and 12 guidance items.");
        const items = input.items.map((item) => ({ heading: requiredText(item.heading, "Guidance heading", 140), text: requiredText(item.text, "Guidance text", 1000) }));
        const rows = await supabase("student_guidance?on_conflict=id&select=id,title,subtitle,items", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=representation" }, body: JSON.stringify({ id: true, title, subtitle, items, updated_at: new Date().toISOString() }) });
        return json(res, 200, rows[0]);
      }
      if (req.method === "POST" && url.pathname === "/api/admin/sites") {
        const input = await readBody(req);
        const code = requiredText(input.code, "Site code", 40).toLowerCase();
        const name = requiredText(input.name, "Site name", 100);
        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(code)) throw invalid("Use lowercase letters, numbers, and single hyphens for the site code.");
        const rows = await supabase("sites?select=id,code,name", {
          method: "POST", headers: { Prefer: "return=representation" },
          body: JSON.stringify({ code, name }),
        });
        return json(res, 201, rows[0]);
      }
      const siteMatch = url.pathname.match(/^\/api\/admin\/sites\/([0-9a-f-]+)$/i);
      if (req.method === "PATCH" && siteMatch) {
        const input = await readBody(req);
        const updates = {};
        if (input.code !== undefined) {
          updates.code = requiredText(input.code, "Site code", 40).toLowerCase();
          if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(updates.code)) throw invalid("Use lowercase letters, numbers, and single hyphens for the site code.");
        }
        if (input.name !== undefined) updates.name = requiredText(input.name, "Site name", 100);
        if (!Object.keys(updates).length) throw invalid("Provide a site name or code to update.");
        const rows = await supabase(`sites?${new URLSearchParams({ id: `eq.${siteMatch[1]}`, select: "id,code,name" })}`, {
          method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(updates),
        });
        if (!rows?.length) return json(res, 404, { error: "That site could not be found." });
        return json(res, 200, rows[0]);
      }
      if (req.method === "POST" && url.pathname === "/api/admin/technicians") {
        const input = await readBody(req);
        const entraObjectId = requiredText(input.entra_object_id, "Entra object ID", 100).toLowerCase();
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(entraObjectId)) throw invalid("Enter a valid Entra object ID in GUID format.");
        const siteId = requiredText(input.site_id, "Site", 100);
        const rows = await supabase("technicians?select=id,entra_tenant_id,entra_object_id,display_name,site_id,is_active,can_view_all_tickets,sites(name)", {
          method: "POST", headers: { Prefer: "return=representation" },
          body: JSON.stringify({
            entra_tenant_id: technician.tenantId,
            entra_object_id: entraObjectId,
            display_name: requiredText(input.display_name, "Display name", 120),
            site_id: siteId,
            is_active: input.is_active !== false,
            can_view_all_tickets: input.can_view_all_tickets === true,
          }),
        });
        return json(res, 201, rows[0]);
      }
      const technicianMatch = url.pathname.match(/^\/api\/admin\/technicians\/([0-9a-f-]+)$/i);
      if (req.method === "PATCH" && technicianMatch) {
        const input = await readBody(req);
        const updates = {};
        if (input.entra_object_id !== undefined) {
          updates.entra_object_id = requiredText(input.entra_object_id, "Entra object ID", 100).toLowerCase();
          if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(updates.entra_object_id)) throw invalid("Enter a valid Entra object ID in GUID format.");
        }
        if (input.display_name !== undefined) updates.display_name = requiredText(input.display_name, "Display name", 120);
        if (input.site_id !== undefined) updates.site_id = requiredText(input.site_id, "Site", 100);
        if (input.is_active !== undefined) updates.is_active = Boolean(input.is_active);
        if (input.can_view_all_tickets !== undefined) updates.can_view_all_tickets = Boolean(input.can_view_all_tickets);
        if (!Object.keys(updates).length) throw invalid("Provide technician details to update.");
        const rows = await supabase(`technicians?${new URLSearchParams({ id: `eq.${technicianMatch[1]}`, select: "id,entra_tenant_id,entra_object_id,display_name,site_id,is_active,can_view_all_tickets,sites(name)" })}`, {
          method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(updates),
        });
        if (!rows?.length) return json(res, 404, { error: "That technician could not be found." });
        return json(res, 200, rows[0]);
      }
      return json(res, 404, { error: "Not found." });
    }

    const technicianHistoryMatch = url.pathname.match(/^\/api\/tickets\/([0-9a-f-]+)\/history$/i);
    if (req.method === "GET" && technicianHistoryMatch) {
      const ticket = await findTicketVisibleToTechnician(technicianHistoryMatch[1], technician);
      if (!ticket) return json(res, 404, { error: "That ticket is not visible to your account." });
      const query = new URLSearchParams({
        select: "id,actor_type,actor_technician_id,event_type,summary,field_name,old_value,new_value,created_at,technicians(display_name)",
        ticket_id: `eq.${ticket.id}`, order: "created_at.asc",
      });
      return json(res, 200, await supabase(`ticket_history?${query}`));
    }

    const technicianNotesMatch = url.pathname.match(/^\/api\/tickets\/([0-9a-f-]+)\/internal-notes$/i);
    if (technicianNotesMatch && ["GET", "POST"].includes(req.method)) {
      const ticket = req.method === "GET"
        ? await findTicketVisibleToTechnician(technicianNotesMatch[1], technician)
        : await findTicketForTechnician(technicianNotesMatch[1], technician.id);
      if (!ticket) return json(res, 404, { error: "That ticket is not visible to your account." });
      if (req.method === "GET") {
        const query = new URLSearchParams({
          select: "id,note,created_at,technicians(display_name)",
          ticket_id: `eq.${ticket.id}`, order: "created_at.asc",
        });
        return json(res, 200, await supabase(`ticket_internal_notes?${query}`));
      }
      const input = await readBody(req);
      const note = requiredText(input.note, "Internal note", 5000);
      const query = new URLSearchParams({ select: "id,note,created_at,technicians(display_name)" });
      const rows = await supabase(`ticket_internal_notes?${query}`, {
        method: "POST", headers: { Prefer: "return=representation" },
        body: JSON.stringify({ ticket_id: ticket.id, author_technician_id: technician.id, note }),
      });
      await addTicketHistory(ticket.id, {
        actorType: "technician", actorTechnicianId: technician.id, eventType: "note",
        summary: "Internal note added by " + technician.display_name + ".",
      });
      return json(res, 201, rows[0]);
    }

    const technicianCommentsMatch = url.pathname.match(/^\/api\/tickets\/([0-9a-f-]+)\/comments$/i);
    if (technicianCommentsMatch && ["GET", "POST"].includes(req.method)) {
      const ticket = req.method === "GET"
        ? await findTicketVisibleToTechnician(technicianCommentsMatch[1], technician)
        : await findTicketForTechnician(technicianCommentsMatch[1], technician.id);
      if (!ticket) return json(res, 404, { error: "That ticket is not assigned to your account." });
      if (req.method === "GET") { await markTicketCommentsRead(ticket.id, "technician"); return json(res, 200, await getTicketComments(ticket.id)); }
      return json(res, 201, await addTicketComment(ticket.id, await readBody(req), { type: "technician", technicianId: technician.id }, ticket.status));
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

    if (req.method === "GET" && url.pathname === "/api/operator/content") {
      const [guides, guidanceRows] = await Promise.all([
        supabase(`knowledge_guides?${new URLSearchParams({ select: "id,title,category,summary,steps,icon_key,sort_order,is_published", is_published: "eq.true", order: "sort_order.asc,title.asc" })}`),
        supabase(`student_guidance?${new URLSearchParams({ select: "id,title,subtitle,items", id: "eq.true", limit: "1" })}`),
      ]);
      return json(res, 200, { knowledgeGuides: guides || [], studentGuidance: guidanceRows?.[0] || null });
    }
    if (req.method === "GET" && url.pathname === "/api/operator/profile") {
      return json(res, 200, {
        id: technician.id,
        tenantId: technician.tenantId,
        canViewAllTickets: Boolean(technician.can_view_all_tickets),
        canManageDirectory: Boolean(technician.can_manage_directory),
      });
    }

    if (req.method === "GET" && url.pathname === "/api/tickets") {
      const filters = { select: ticketSelect, order: "created_at.desc" };
      if (!technician.can_view_all_tickets) {
        filters.assigned_technician_id = `eq.${technician.id}`;
      }
      const query = new URLSearchParams(filters);
      const tickets = await supabase(`tickets?${query}`);
      const counts = await getUnreadCommentCounts(tickets.map((ticket) => ticket.id), "requester");
      return json(res, 200, withUnreadCommentCounts(tickets, counts));
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
      const fieldLabels = {
        requester_name: "Student name", requester_email: "Student email", title: "Title",
        description: "Description", category: "Category", priority: "Priority",
      };
      const requestedValues = {
        requester_name: name.slice(0, 160), requester_email: email.slice(0, 254),
        title: title.slice(0, 200), description: description.slice(0, 5000),
        category: category.slice(0, 100), priority,
      };
      const historyEntries = Object.entries(requestedValues)
        .filter(([field, value]) => String(ticket[field] ?? "") !== String(value))
        .map(([field, value]) => ({
          actorType: "technician", actorTechnicianId: technician.id, eventType: "field_changed",
          summary: fieldLabels[field] + " updated by " + technician.display_name + ".",
          fieldName: fieldLabels[field], oldValue: String(ticket[field] ?? ""), newValue: String(value),
        }));
      const filter = new URLSearchParams({ id: `eq.${ticket.id}`, assigned_technician_id: `eq.${technician.id}` });
      await supabase(`tickets?${filter}`, {
        method: "PATCH",
        body: JSON.stringify(requestedValues),
      });
      await addTicketHistory(ticket.id, historyEntries);
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
        waiting: ["waiting_for_student", "Status changed to Waiting for student."],
        resolve: ["resolved", `Marked resolved by ${technician.display_name}.`],
        escalate: ["escalated", "Escalation handover preview marked ready for on-site support."],
      };
      if (!actionMap[action]) return json(res, 400, { error: "That ticket action is not supported." });
      const [status, note] = actionMap[action];
      if (ticket.status === status) return json(res, 200, { ok: true });
      const updateQuery = new URLSearchParams({ id: `eq.${ticket.id}`, assigned_technician_id: `eq.${technician.id}` });
      await supabase(`tickets?${updateQuery}`, { method: "PATCH", body: JSON.stringify({ status }) });
      const statusLabels = { new: "New", in_progress: "In progress", waiting_for_student: "Waiting for student", student_updated: "Updated by student", resolved: "Resolved", escalated: "Escalated" };
      await addTicketHistory(ticket.id, {
        actorType: "technician", actorTechnicianId: technician.id,
        eventType: action === "escalate" ? "escalated" : "status_changed",
        summary: note, fieldName: "Status", oldValue: statusLabels[ticket.status] || ticket.status,
        newValue: statusLabels[status] || status,
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












