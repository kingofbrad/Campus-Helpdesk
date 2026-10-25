import { Badge, Button } from "@chakra-ui/react";
import { LuInbox } from "react-icons/lu";

export default function StudentTicketList({ tickets, loading, error, onRefresh, onOpen }) {
  return (
    <section className="portal-card student-requests-card">
      <div className="portal-card-heading">
        <div><b>My submitted tickets</b><small>Requests submitted using your signed-in Microsoft account.</small></div>
        <div className="request-list-actions">
          <span className="request-total">{tickets.length} {tickets.length === 1 ? "request" : "requests"}</span>
          <Button size="sm" variant="outline" onClick={onRefresh} disabled={loading}>{loading ? "Refreshing…" : "Refresh list"}</Button>
        </div>
      </div>
      {error && <div className="signin-error" role="alert">{error}</div>}
      {loading && tickets.length === 0
        ? <EmptyState>Loading your requests…</EmptyState>
        : tickets.length === 0
          ? <EmptyState icon><b>No tickets yet</b><span>When you submit a request, it will appear here.</span></EmptyState>
          : <div className="student-ticket-list">{tickets.map((ticket) => <TicketCard key={ticket.databaseId} ticket={ticket} onOpen={() => onOpen(ticket)} />)}</div>}
    </section>
  );
}

function TicketCard({ ticket, onOpen }) {
  const readKey = `campus-helpdesk-student-read-${ticket.databaseId}`;
  const isUnread = ticket.unreadCommentCount > 0 && sessionStorage.getItem(readKey) !== ticket.latestUnreadCommentAt;
  const open = () => {
    if (ticket.latestUnreadCommentAt) sessionStorage.setItem(readKey, ticket.latestUnreadCommentAt);
    onOpen();
  };
  const handleKeyDown = (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    open();
  };

  return (
    <article
      className="student-ticket"
      role="button"
      tabIndex={0}
      onClick={open}
      onKeyDown={handleKeyDown}
      aria-label={`Open ticket ${ticket.title}`}
    >
      <div className="student-ticket-main">
        <div className="student-ticket-title">
          <b>{ticket.title}</b>
          <small>{ticket.id} · {ticket.category}</small>
          {isUnread && <Badge mt="2" colorPalette="orange" variant="subtle" rounded="full">{ticket.unreadCommentCount} new {ticket.unreadCommentCount === 1 ? "helpdesk reply" : "helpdesk replies"}</Badge>}
        </div>
        <span className={`student-status status-${ticket.status.toLowerCase().replaceAll(" ", "-")}`}>{ticket.status}</span>
      </div>
      <p>{ticket.description}</p>
      <div className="student-ticket-meta">
        <span>{ticket.site || "Campus site"}</span>
        <span>Submitted {ticket.submitted}</span>
        <span>{ticket.assignee}</span>
        <span className="student-ticket-comments">Open ticket →</span>
      </div>
    </article>
  );
}

function EmptyState({ children, icon = false }) {
  return <div className="student-list-empty">{icon && <LuInbox size={22} />}{children}</div>;
}


