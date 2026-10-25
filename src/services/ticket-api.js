import { apiScopes } from "../config/auth-config.js";
import { InteractionRequiredAuthError } from "@azure/msal-browser";

export const databaseMode = apiScopes.length > 0;

function asRows(value, label, identifyingFields = ["id", "ticket_id"]) {
  if (Array.isArray(value)) return value;
  // A single related row can occasionally be returned as an object by an API
  // adapter. Accept that shape for list views while rejecting error envelopes.
  if (value && typeof value === "object" && identifyingFields.some((field) => field in value)) return [value];
  throw new Error(`The helpdesk API returned an unexpected ${label} response. Refresh the page, and contact the demo owner if it continues.`);
}

async function request(instance, account, path, options = {}) {
  if (!databaseMode) throw new Error("Database mode is not configured yet.");
  let accessToken;
  try {
    ({ accessToken } = await instance.acquireTokenSilent({ scopes: apiScopes, account }));
  } catch (error) {
    if (error instanceof InteractionRequiredAuthError) {
      await instance.acquireTokenRedirect({ scopes: apiScopes, account });
      return;
    }
    throw error;
  }
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Helpdesk API returned ${response.status}.`);
  return data;
}

function mapTicket(row) {
  const statusLabels = {
    new: "New",
    in_progress: "In progress",
    waiting_for_student: "Waiting for student",
    student_updated: "Updated by student",
    resolved: "Resolved",
    escalated: "Escalated",
  };
  const priorityLabels = { low: "Low", normal: "Normal", high: "High" };
  const student = row.requester_name || "Unknown requester";
  const initials = student.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  const created = new Date(row.updated_at);
  const submittedAt = new Date(row.created_at);
  const updated = Number.isNaN(created.getTime()) ? "Recently" : created.toLocaleString();
  const submitted = Number.isNaN(submittedAt.getTime()) ? "Recently" : submittedAt.toLocaleString();
  const activityRows = Array.isArray(row.ticket_activity)
    ? row.ticket_activity
    : row.ticket_activity && typeof row.ticket_activity === "object"
      ? [row.ticket_activity]
      : [];
  return {
    id: row.ticket_reference || `SH-${String(row.ticket_number).padStart(4, "0")}`,
    databaseId: row.id,
    title: row.title,
    student,
    initials,
    email: row.requester_email,
    site: row.sites?.name || "",
    category: row.category,
    priority: priorityLabels[row.priority] || "Normal",
    status: statusLabels[row.status] || "New",
    assignee: row.technicians?.display_name || "Assigned technician",
    assigneeId: row.assigned_technician_id,
    updated,
    updatedAt: row.updated_at || null,
    unreadCommentCount: Number(row.unread_comment_count) || 0,
    latestUnreadCommentAt: row.latest_unread_comment_at || null,
    submitted,
    description: row.description,
    notes: activityRows.map((item) => item.note).filter(Boolean),
  };
}

export async function getTickets(instance, account) {
  const rows = asRows(await request(instance, account, "/tickets"), "ticket list");
  return rows.map(mapTicket);
}

export async function getOperatorProfile(instance, account) {
  return request(instance, account, "/operator/profile");
}

export async function getOperatorContent(instance, account) {
  return request(instance, account, "/operator/content");
}
export async function createKnowledgeGuide(instance, account, values) {
  return request(instance, account, "/admin/knowledge-guides", { method: "POST", body: JSON.stringify(values) });
}
export async function updateKnowledgeGuide(instance, account, id, values) {
  return request(instance, account, "/admin/knowledge-guides/" + encodeURIComponent(id), { method: "PATCH", body: JSON.stringify(values) });
}
export async function deleteKnowledgeGuide(instance, account, id) {
  return request(instance, account, "/admin/knowledge-guides/" + encodeURIComponent(id), { method: "DELETE" });
}
export async function updateStudentGuidance(instance, account, values) {
  return request(instance, account, "/admin/student-guidance", { method: "PUT", body: JSON.stringify(values) });
}
export async function getDirectory(instance, account) {
  return request(instance, account, "/admin/directory");
}

export async function createDirectorySite(instance, account, values) {
  return request(instance, account, "/admin/sites", { method: "POST", body: JSON.stringify(values) });
}

export async function updateDirectorySite(instance, account, siteId, values) {
  return request(instance, account, `/admin/sites/${encodeURIComponent(siteId)}`, { method: "PATCH", body: JSON.stringify(values) });
}

export async function createDirectoryTechnician(instance, account, values) {
  return request(instance, account, "/admin/technicians", { method: "POST", body: JSON.stringify(values) });
}

export async function updateDirectoryTechnician(instance, account, technicianId, values) {
  return request(instance, account, `/admin/technicians/${encodeURIComponent(technicianId)}`, { method: "PATCH", body: JSON.stringify(values) });
}

export async function getStudentTickets(instance, account) {
  const rows = asRows(await request(instance, account, "/student/tickets"), "student ticket list");
  return rows.map(mapTicket);
}

export async function getSites() {
  if (!databaseMode) return [{ code: "sheppey", name: "Sheppey" }, { code: "canterbury", name: "Canterbury" }];
  const response = await fetch("/api/sites");
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Helpdesk API returned ${response.status}.`);
  return asRows(data, "site list", ["code"]);
}

export async function submitTechnicianTicket(instance, account, ticket) {
  const row = await request(instance, account, "/tickets", {
    method: "POST",
    body: JSON.stringify(ticket),
  });
  return mapTicket(row);
}

export async function submitStudentTicket(instance, account, ticket) {
  const row = await request(instance, account, "/student/tickets", {
    method: "POST",
    body: JSON.stringify(ticket),
  });
  return mapTicket(row);
}

export async function updateTicketDetails(instance, account, ticket, updates) {
  const row = await request(instance, account, `/tickets/${encodeURIComponent(ticket.databaseId)}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
  return mapTicket(row);
}

export async function getTicketComments(instance, account, ticket, audience) {
  const prefix = audience === "student" ? "/student/tickets/" : "/tickets/";
  const rows = asRows(await request(instance, account, `${prefix}${encodeURIComponent(ticket.databaseId)}/comments`), "ticket comments");
  return rows.map((row) => ({
    id: row.id,
    authorType: row.author_type,
    authorName: row.technicians?.display_name || "Helpdesk technician",
    message: row.message,
    createdAt: new Date(row.created_at).toLocaleString(),
  }));
}

export async function addTicketComment(instance, account, ticket, audience, message) {
  const prefix = audience === "student" ? "/student/tickets/" : "/tickets/";
  const rows = asRows(await request(instance, account, `${prefix}${encodeURIComponent(ticket.databaseId)}/comments`, {
    method: "POST",
    body: JSON.stringify({ message }),
  }), "created comment");
  return rows.map((row) => ({
    id: row.id,
    authorType: row.author_type,
    authorName: row.technicians?.display_name || "Helpdesk technician",
    message: row.message,
    createdAt: new Date(row.created_at).toLocaleString(),
  }));
}

export async function getStudentReplies(instance, account, since) {
  const rows = asRows(await request(instance, account, `/ticket-replies?since=${encodeURIComponent(since)}`), "student reply list");
  return rows.map((row) => ({
    id: row.id,
    kind: "reply",
    ticketDatabaseId: row.tickets.id,
    title: row.tickets.title,
    student: row.tickets.requester_name,
    reference: row.tickets.ticket_reference || `SH-${String(row.tickets.ticket_number).padStart(4, "0")}`,
    message: row.message,
    receivedAt: row.created_at,
  }));
}

export async function performTicketAction(instance, account, ticket, action) {
  return updateTicket(instance, account, ticket, action);
}

export async function updateTicket(instance, account, ticket, action) {
  return request(instance, account, `/tickets/${encodeURIComponent(ticket.databaseId)}/actions`, {
    method: "POST",
    body: JSON.stringify({ action }),
  });
}




