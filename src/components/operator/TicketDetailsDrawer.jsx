import { useEffect, useState } from "react";
import { Badge, Button, Heading, Text } from "@chakra-ui/react";
import { LuArrowUpRight, LuLockKeyhole } from "react-icons/lu";
import TicketConversation from "../tickets/TicketConversation.jsx";
import { InternalNotesPanel, TicketHistory } from "../tickets/TechnicianTicketPanels.jsx";
import { priorityColors, statusColors } from "../../data/demo-data.js";
import { showcase } from "../../config/auth-config.js";
import { PortfolioConversation } from "../tickets/TicketConversation.jsx";

export default function TicketDetailsDrawer({ ticket, technicianName, displayAssignee, databaseMode, canManage, onEdit, onAction, onEscalate }) {
  const [notesOpen, setNotesOpen] = useState(false);
  useEffect(() => setNotesOpen(false), [ticket?.databaseId]);
  if (!ticket) return null;

  return (
    <section className="ticket-full-page">
      <header className="ticket-full-page-head">
        <div><div className="eyebrow">Ticket details</div><small>{ticket.id}</small></div>
        <div className="badge-row">
          <Badge colorPalette={statusColors[ticket.status]} variant="subtle" rounded="full">{ticket.status}</Badge>
          <Badge colorPalette={priorityColors[ticket.priority]} variant="subtle" rounded="full">{ticket.priority} priority</Badge>
        </div>
      </header>
      <div className={`ticket-full-page-body ${databaseMode || showcase ? "" : "single-column"} ${notesOpen ? "ticket-with-notes" : ""}`}>
        <div className="ticket-full-page-main">
          <Heading size="xl" mb="2">{ticket.title}</Heading>
          <Text fontSize="sm" color="gray.600">Submitted by {ticket.student} · {ticket.updated}</Text>
          <div className="detail-label">Ticket information</div>
          <div className="info-grid ticket-information-grid">
            <div><small>Category</small><b>{ticket.category}</b></div>
            <div><small>Assigned to</small><b>{displayAssignee(ticket)}</b></div>
            <div><small>Contact</small><b>{ticket.email}</b></div>
            <div><small>Priority</small><b>{ticket.priority}</b></div>
          </div>
          <div className="detail-label">Issue description</div>
          <div className="description">{ticket.description}</div>
          {databaseMode ? <TicketHistory ticket={ticket} technicianName={technicianName} /> : (
            <>
              <div className="detail-label">Ticket activity</div>
              <div className="timeline">
                {ticket.notes.map((note, index) => <div key={`${ticket.databaseId || ticket.id}-${index}`}><small>{index === 0 ? "Ticket activity" : `${technicianName} · student technician`}</small>{note}</div>)}
              </div>
            </>
          )}
        </div>
        {databaseMode && <TicketConversation ticket={ticket} audience="technician" readOnly={!canManage} inline />}
        {showcase && <PortfolioConversation ticket={ticket} audience="technician" />}
        {databaseMode && notesOpen && <InternalNotesPanel ticket={ticket} technicianName={technicianName} canManage={canManage} />}
        {showcase && notesOpen && <aside className="internal-notes-panel" aria-label="Example internal technician notes"><div className="ticket-panel-heading"><LuLockKeyhole /><div><Heading size="sm">Internal notes</Heading><small>Visible to technicians only</small></div></div><div className="internal-note-list"><article className="internal-note-card"><p>The slowdown began after a recent system update. Ask for the device model and operating system version, and confirm the student has saved their work before suggesting a restart.</p><small>Alex Morgan · Today, 10:20</small></article></div><form className="internal-note-form"><label htmlFor="showcase-note">Add an internal note</label><textarea id="showcase-note" rows={4} placeholder="Record useful context for the next technician…" /><Button type="button" size="sm" colorPalette="brand" disabled><LuLockKeyhole /> Sample only</Button></form></aside>}
      </div>
      <div className="ticket-actions ticket-full-page-actions">
        {(databaseMode || showcase) && <Button size="sm" variant={notesOpen ? "subtle" : "outline"} onClick={() => setNotesOpen((open) => !open)}><LuLockKeyhole /> {notesOpen ? "Hide internal notes" : "Internal notes"}</Button>}
        {canManage && <>
          <Button size="sm" variant="outline" onClick={onEdit}>Edit ticket</Button>
          <Button size="sm" variant="outline" onClick={() => onAction("progress")}>Mark in progress</Button>
          <Button size="sm" variant="outline" onClick={() => onAction("waiting")}>Waiting for student</Button>
          <Button size="sm" variant="outline" onClick={() => onAction("resolve")}>Resolve</Button>
          <Button size="sm" colorPalette="brand" onClick={onEscalate}><LuArrowUpRight /> Escalate to IT</Button>
        </>}
        {!canManage && <small className="detail-readonly-note">You can view this ticket, but only its assigned technician can update it.</small>}
      </div>
    </section>
  );
}

