import { Badge, Button, Heading, Input, Text } from "@chakra-ui/react";
import { LuPlus, LuSearch } from "react-icons/lu";
import {
  knowledgeGuides,
  priorityColors,
  statusColors,
} from "../../data/demo-data.js";
import PageHeading from "../shared/PageHeading.jsx";
import StatCard from "../shared/StatCard.jsx";

export function TicketQueuePage({
  databaseMode,
  ticketError,
  ticketLoading,
  firstName,
  greeting,
  technicianName,
  canViewAllTickets,
  queueTickets,
  openCount,
  filteredTickets,
  query,
  status,
  priority,
  onQueryChange,
  onStatusChange,
  onPriorityChange,
  onSelectTicket,
  onCreateTicket,
  displayAssignee,
}) {
  return (
    <>
      {databaseMode && ticketError && (
        <div className="notice" role="alert">
          {ticketError}
        </div>
      )}
      {databaseMode && ticketLoading && (
        <div className="notice">Loading your tickets from Supabase…</div>
      )}
      <PageHeading
        eyebrow={`${greeting}, ${firstName}`}
        title={canViewAllTickets ? "All site tickets" : "Your ticket queue"}
        subtitle={
          canViewAllTickets
            ? "Review requests from every site, regardless of their current assignment."
            : "Work on requests assigned to your signed-in account, and escalate when needed."
        }
      >
        <Button colorPalette="#00413e" onClick={onCreateTicket}>
          <LuPlus /> Create ticket for student
        </Button>
      </PageHeading>

      <div className="stats">
        <StatCard
          icon="▦"
          label="Open tickets"
          value={openCount}
          note="Assigned to your account"
        />
        <StatCard
          icon="◎"
          label="In progress"
          value={
            queueTickets.filter((ticket) => ticket.status === "In progress")
              .length
          }
          note="Tickets currently being worked on"
        />
        <StatCard
          icon="◷"
          label="Needs attention"
          value={
            queueTickets.filter(
              (ticket) => ticket.status === "Waiting for student",
            ).length
          }
          note="Waiting for a reply or next step"
        />
        <StatCard
          icon="✓"
          label="Resolved"
          value={
            queueTickets.filter((ticket) => ticket.status === "Resolved").length
          }
          note="Resolved tickets in this queue"
        />
      </div>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <b>
              {canViewAllTickets
                ? "All site tickets"
                : "Tickets assigned to you"}
            </b>
            <small>
              {canViewAllTickets
                ? "Includes requests assigned to every student technician."
                : `Only requests assigned to ${technicianName} are shown.`}
            </small>
          </div>
          <Badge colorPalette="blue" variant="subtle" rounded="full">
            {canViewAllTickets
              ? `${queueTickets.length} tickets`
              : `${queueTickets.length} assigned`}
          </Badge>
        </div>
        <div className="filters">
          <div className="search-box">
            <LuSearch />
            <Input
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Search tickets or students…"
              variant="outline"
              size="sm"
            />
          </div>
          <select
            value={status}
            onChange={(event) => onStatusChange(event.target.value)}
          >
            <option>All statuses</option>
            {[
              "New",
              "In progress",
              "Waiting for student",
              "Resolved",
              "Escalated",
            ].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
          <select
            value={priority}
            onChange={(event) => onPriorityChange(event.target.value)}
          >
            <option>All priorities</option>
            {["High", "Normal", "Low"].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </div>
        <TicketTable
          tickets={filteredTickets}
          onSelectTicket={onSelectTicket}
          displayAssignee={displayAssignee}
        />
        <div className="table-foot">
          <span>Showing {filteredTickets.length} tickets</span>
          <span>
            {databaseMode
              ? "Supabase database · demo"
              : "Sample data · no live systems connected"}
          </span>
        </div>
      </section>
    </>
  );
}

export function MyTicketsPage({ tickets, technicianName, onSelectTicket }) {
  const activeTickets = tickets.filter(
    (ticket) => ticket.status !== "Resolved",
  );
  return (
    <>
      <PageHeading
        eyebrow="Your workload"
        title="My tickets"
        subtitle="Active requests assigned to your signed-in account."
      />
      <section className="panel">
        <div className="panel-heading">
          <div>
            <b>Assigned to {technicianName}</b>
            <small>Active cases</small>
          </div>
        </div>
        <TicketTable
          tickets={activeTickets}
          onSelectTicket={onSelectTicket}
          showAssignee={false}
        />
      </section>
    </>
  );
}

export function KnowledgeBasePage({ query, onQueryChange, onOpenGuide }) {
  const matchingGuides = knowledgeGuides.filter((guide) =>
    `${guide.title} ${guide.category} ${guide.summary}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  return (
    <>
      <PageHeading
        eyebrow="Student technician resources"
        title="Knowledge base"
        subtitle="Quick guides for common campus IT issues."
      />
      <div className="guide-filter">
        <div className="search-box">
          <LuSearch />
          <Input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search troubleshooting guides…"
            size="sm"
          />
        </div>
        <small>Guidance for student technicians</small>
      </div>
      <div className="guide-grid">
        {matchingGuides.map((guide) => (
          <GuideCard
            key={guide.title}
            guide={guide}
            onOpen={() => onOpenGuide(guide)}
          />
        ))}
      </div>
    </>
  );
}

export function StudentGuidancePage() {
  const principles = [
    [
      "1. Understand the issue",
      "Read the request carefully. Ask clear follow-up questions if anything is missing.",
    ],
    [
      "2. Use approved guidance",
      "Follow the knowledge base. Record what you tried and what happened.",
    ],
    [
      "3. Protect privacy",
      "Only access information needed to help. Never ask for passwords or share sensitive details.",
    ],
    [
      "4. Escalate when needed",
      "If an issue is outside your training, affects safety or security, or remains unresolved, hand it to staff.",
    ],
  ];
  return (
    <>
      <PageHeading
        eyebrow="Working safely and professionally"
        title="Student guidance"
        subtitle="A few principles for supporting your fellow students."
      />
      <section className="panel guidance">
        <Heading size="md" mb="5">
          How we work
        </Heading>
        <div className="principles">
          {principles.map(([heading, text]) => (
            <div key={heading}>
              <b>{heading}</b>
              <p>{text}</p>
            </div>
          ))}
        </div>
        <div className="notice">
          Portfolio prototype with sample data. It is not connected to school
          systems or real student records.
        </div>
      </section>
    </>
  );
}

function TicketTable({
  tickets,
  onSelectTicket,
  showAssignee = true,
  displayAssignee = (ticket) => ticket.assignee,
}) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Ticket</th>
            <th>Student</th>
            <th>Category</th>
            <th>Priority</th>
            <th>Status</th>
            {showAssignee && <th>Assigned to</th>}
            <th>Updated</th>
          </tr>
        </thead>
        <tbody>
          {tickets.map((ticket) => (
            <tr
              key={ticket.databaseId || ticket.id}
              onClick={() => onSelectTicket(ticket)}
            >
              <td>
                <b>{ticket.title}</b>
                <small className="ticket-id">{ticket.id}</small>
              </td>
              <td>
                {showAssignee ? (
                  <span className="student-cell">
                    <i>{ticket.initials}</i>
                    {ticket.student}
                  </span>
                ) : (
                  ticket.student
                )}
              </td>
              <td>{ticket.category}</td>
              <td>
                <Badge
                  colorPalette={priorityColors[ticket.priority]}
                  variant="subtle"
                  rounded="full"
                >
                  {ticket.priority}
                </Badge>
              </td>
              <td>
                <Badge
                  colorPalette={statusColors[ticket.status]}
                  variant="subtle"
                  rounded="full"
                >
                  {ticket.status}
                </Badge>
              </td>
              {showAssignee && <td>{displayAssignee(ticket)}</td>}
              <td className={showAssignee ? "muted" : ""}>{ticket.updated}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {tickets.length === 0 && (
        <div className="empty">
          {showAssignee
            ? "You have no tickets assigned yet."
            : "You have no active tickets assigned."}
        </div>
      )}
    </div>
  );
}

function GuideCard({ guide, onOpen }) {
  const Icon = guide.icon;
  return (
    <article className="guide-card">
      <div className="guide-icon">
        <Icon size={21} />
      </div>
      <div className="eyebrow category-label">{guide.category}</div>
      <h3>{guide.title}</h3>
      <p>{guide.summary}</p>
      <button onClick={onOpen}>Open guide →</button>
    </article>
  );
}
