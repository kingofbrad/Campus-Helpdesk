import { Badge, Button, Heading, Text } from "@chakra-ui/react";
import { LuArrowUpRight, LuMessageSquare } from "react-icons/lu";
import { priorityColors, statusColors } from "../../data/demo-data.js";

export default function TicketDetailsDrawer({ ticket, technicianName, displayAssignee, databaseMode, canManage, onComments, onEdit, onAction, onEscalate }) {
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
      <div className="ticket-full-page-body">
        <div className="ticket-full-page-main">
          <Heading size="xl" mb="2">{ticket.title}</Heading>
          <Text fontSize="sm" color="gray.600">Submitted by {ticket.student} · {ticket.updated}</Text>
          <div className="detail-label">Issue description</div>
          <div className="description">{ticket.description}</div>
          <div className="detail-label">Activity &amp; notes</div>
          <div className="timeline">
            {ticket.notes.map((note, index) => (
              <div key={`${ticket.databaseId || ticket.id}-${index}`}>
                <small>{index === 0 ? "Ticket activity" : `${technicianName} · student technician`}</small>
                {note}
              </div>
            ))}
          </div>
        </div>
        <aside className="ticket-full-page-side">
          <div className="detail-label">Ticket information</div>
          <div className="info-grid">
            <div><small>Category</small><b>{ticket.category}</b></div>
            <div><small>Assigned to</small><b>{displayAssignee(ticket)}</b></div>
            <div><small>Contact</small><b>{ticket.email}</b></div>
            <div><small>Priority</small><b>{ticket.priority}</b></div>
          </div>
        </aside>
      </div>
      <div className="ticket-actions ticket-full-page-actions">
        {databaseMode && <Button size="sm" variant="outline" onClick={onComments}><LuMessageSquare /> Comments</Button>}
        {canManage && <>
          <Button size="sm" variant="outline" onClick={onEdit}>Edit ticket</Button>
          <Button size="sm" variant="outline" onClick={() => onAction("progress")}>Mark in progress</Button>
          <Button size="sm" variant="outline" onClick={() => onAction("waiting")}>Waiting for student</Button>
          <Button size="sm" variant="outline" onClick={() => onAction("resolve")}>Resolve</Button>
          <Button size="sm" colorPalette="ekc" onClick={onEscalate}><LuArrowUpRight /> Escalate to IT</Button>
        </>}
        {!canManage && <small className="detail-readonly-note">You can view this ticket, but only its assigned technician can update it.</small>}
      </div>
    </section>
  );
}

