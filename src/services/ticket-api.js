import { apiScopes } from "../config/auth-config.js";
import { InteractionRequiredAuthError } from "@azure/msal-browser";

export const databaseMode = apiScopes.length > 0;

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
    resolved: "Resolved",
    escalated: "Escalated",
  };
  const priorityLabels = { low: "Low", normal: "Normal", high: "High" };
  const student = row.requester_name;
  const initials = student.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  const created = new Date(row.updated_at);
  const submittedAt = new Date(row.created_at);
  const updated = Number.isNaN(created.getTime()) ? "Recently" : created.toLocaleString();
  const submitted = Number.isNaN(submittedAt.getTime()) ? "Recently" : submittedAt.toLocaleString();
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
    submitted,
    description: row.description,
    notes: (row.ticket_activity || []).map((item) => item.note),
  };
}

export async function getTickets(instance, account) {
  const rows = await request(instance, account, "/tickets");
  return rows.map(mapTicket);
}

export async function getOperatorProfile(instance, account) {
  return request(instance, account, "/operator/profile");
}

export async function getStudentTickets(instance, account) {
  const rows = await request(instance, account, "/student/tickets");
  return rows.map(mapTicket);
}

export async function getSites() {
  if (!databaseMode) return [{ code: "sheppey", name: "Sheppey" }, { code: "canterbury", name: "Canterbury" }];
  const response = await fetch("/api/sites");
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Helpdesk API returned ${response.status}.`);
  return data;
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
  const rows = await request(instance, account, `${prefix}${encodeURIComponent(ticket.databaseId)}/comments`);
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
  const rows = await request(instance, account, `${prefix}${encodeURIComponent(ticket.databaseId)}/comments`, {
    method: "POST",
    body: JSON.stringify({ message }),
  });
  return rows.map((row) => ({
    id: row.id,
    authorType: row.author_type,
    authorName: row.technicians?.display_name || "Helpdesk technician",
    message: row.message,
    createdAt: new Date(row.created_at).toLocaleString(),
  }));
}

export async function getStudentReplies(instance, account, since) {
  const rows = await request(instance, account, `/ticket-replies?since=${encodeURIComponent(since)}`);
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

