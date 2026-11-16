import { Badge, Button, Heading, Text } from "@chakra-ui/react";
import { LuArrowLeft } from "react-icons/lu";
import { priorityColors, statusColors } from "../../data/demo-data.js";
import TicketConversation, { PortfolioConversation } from "../tickets/TicketConversation.jsx";
import { showcase } from "../../config/auth-config.js";

export default function StudentTicketDetailsPage({ ticket, onBack }) {
  return (
    <section className="ticket-full-page student-ticket-detail">
      <header className="ticket-full-page-head">
        <div className="student-ticket-detail-heading">
          <Button size="sm" variant="outline" onClick={onBack}><LuArrowLeft /> My submitted tickets</Button>
          <div><div className="eyebrow">Your submitted ticket</div><small>{ticket.id}</small></div>
        </div>
        <div className="badge-row">
          <Badge colorPalette={statusColors[ticket.status]} variant="subtle" rounded="full">{ticket.status}</Badge>
          <Badge colorPalette={priorityColors[ticket.priority]} variant="subtle" rounded="full">{ticket.priority} priority</Badge>
        </div>
      </header>
      <div className="ticket-full-page-body">
        <div className="ticket-full-page-main">
          <Heading size="xl" mb="2">{ticket.title}</Heading>
          <Text fontSize="sm" color="gray.600">Submitted {ticket.submitted}</Text>
          <div className="detail-label">Ticket information</div>
          <div className="info-grid ticket-information-grid">
            <div><small>Site</small><b>{ticket.site || "Campus site"}</b></div>
            <div><small>Category</small><b>{ticket.category}</b></div>
            <div><small>Assigned technician</small><b>{ticket.assignee}</b></div>
            <div><small>Priority</small><b>{ticket.priority}</b></div>
          </div>
          <div className="detail-label">Issue description</div>
          <div className="description">{ticket.description}</div>
        </div>
        {showcase ? <PortfolioConversation ticket={ticket} audience="student" /> : <TicketConversation ticket={ticket} audience="student" inline />}
      </div>
    </section>
  );
}
