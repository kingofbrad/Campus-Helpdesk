import { useEffect, useState } from "react";
import { Button, Heading } from "@chakra-ui/react";
import { useMsal } from "@azure/msal-react";
import { addTicketComment, getTicketComments } from "../../services/ticket-api.js";
import { LuMessageSquare, LuSend, LuX } from "react-icons/lu";

export default function TicketConversation({ ticket, audience, readOnly = false, onClose }) {
  const { instance, accounts } = useMsal();
  const account = instance.getActiveAccount() ?? accounts[0];
  const [comments, setComments] = useState([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    getTicketComments(instance, account, ticket, audience)
      .then((rows) => { if (active) setComments(rows); })
      .catch((e) => { if (active) setError(e.message || "Could not load the ticket comments."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [instance, account?.homeAccountId, ticket.databaseId, audience]);

  const submit = async (event) => {
    event.preventDefault();
    const text = message.trim();
    if (!text || sending) return;
    setSending(true);
    setError("");
    try {
      setComments(await addTicketComment(instance, account, ticket, audience, text));
      setMessage("");
    } catch (e) {
      setError(e.message || "Your comment could not be sent.");
    } finally {
      setSending(false);
    }
  };

  return <div className="modal-scrim conversation-scrim" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="modal conversation-modal" aria-label="Ticket comments">
      <div className="modal-head"><div><div className="eyebrow">{ticket.id} · {audience === "student" ? "Student helpdesk" : "Ticket conversation"}</div><Heading size="lg" mt="1">{ticket.title}</Heading></div><button className="icon-button" type="button" onClick={onClose} aria-label="Close comments"><LuX/></button></div>
      <div className="conversation-summary">{audience === "student" ? "Replies from you and the student helpdesk are visible in this conversation." : "Comments are visible to the student and the assigned helpdesk technician."}</div>
      <div className="conversation-list" aria-live="polite">
        {loading ? <div className="conversation-empty">Loading comments…</div>
          : comments.length === 0 ? <div className="conversation-empty"><LuMessageSquare size={22}/><b>No comments yet</b><span>Send a message to start the conversation.</span></div>
            : comments.map((comment) => {
              const isStudent = comment.authorType === "requester";
              const author = isStudent ? (audience === "student" ? "You" : `Student · ${ticket.student}`) : comment.authorName;
              const mine = audience === "student" ? isStudent : comment.authorName === ticket.assignee;
              return <article className={`comment-bubble ${mine ? "mine" : ""}`} key={comment.id}><div className="comment-meta"><b>{author}</b><time>{comment.createdAt}</time></div><p>{comment.message}</p></article>;
            })}
      </div>
      {error && <div className="signin-error" role="alert">{error}</div>}
      {readOnly ? (
        <div className="notice">You can review this conversation. Only the assigned technician can reply.</div>
      ) : (
        <form className="comment-form" onSubmit={submit}>
          <label htmlFor="ticket-comment">{audience === "student" ? "Reply to the helpdesk" : "Add a comment for the student"}</label>
          <textarea id="ticket-comment" maxLength={5000} rows={3} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Write a comment…" required />
          <div className="comment-form-foot">
            <small>Comments are shared with the student and assigned technician.</small>
            <Button type="submit" colorPalette="blue" disabled={sending || !message.trim()}>
              <LuSend /> {sending ? "Sending…" : audience === "student" ? "Send reply" : "Send comment"}
            </Button>
          </div>
        </form>
      )}
    </section>
  </div>;
}

