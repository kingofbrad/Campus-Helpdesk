import { sampleTickets } from "../data/demo-data.js";

export function technicianInitials(name) {
  return String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "ST";
}

export function formatGreeting(hour) {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function technicianIdFor(account) {
  return String(account?.username || account?.homeAccountId || "")
    .trim()
    .toLowerCase();
}

export function initialTicketsFor(account) {
  const technicianId = technicianIdFor(account);
  return sampleTickets.map((ticket) => ({
    ...ticket,
    assigneeId: ticket.assignee === "__current_technician__"
      ? technicianId
      : ticket.assignee === "Staff IT review"
        ? "staff-it"
        : null,
  }));
}

export function nextDemoTicketReference(tickets, date = new Date()) {
  const day = [
    String(date.getFullYear()).slice(-2),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
  const nextNumber = tickets.filter((ticket) => ticket.id?.startsWith(`${day}-`)).length + 1;
  return `${day}-${String(nextNumber).padStart(4, "0")}`;
}

