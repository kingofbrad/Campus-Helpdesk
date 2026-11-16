import { useEffect, useState } from "react";
import { Button, Heading } from "@chakra-ui/react";
import { useMsal } from "@azure/msal-react";
import { addTicketComment, getTicketComments } from "../../services/ticket-api.js";
import { LuMessageSquare, LuSend, LuX } from "react-icons/lu";
import { showcase } from "../../config/auth-config.js";

export function PortfolioConversation({ audience, ticket }) {
  const isNetworkIssue = /eduroam|network/i.test(ticket.title);
  const messages = isNetworkIssue
    ? [
        { author: "Alex Morgan", time: "Today · 10:32", text: "Please forget the campus network, then reconnect with your student account. Let me know if the sign-in prompt returns." },
        { author: "You", time: "Today · 10:41", text: "That worked after I reconnected. Thank you!" },
      ]
    : [
        { author: "Alex Morgan", time: "Today · 10:32", text: "Could you let me know which operating system you use and whether the slowdown affects every app? Save your work before restarting." },
        { author: "You", time: "Today · 10:41", text: "It is a Windows laptop. The slowdown started after yesterday’s update." },
      ];
  const comments = audience === "student"
    ? messages
    : messages.map((message) => ({ ...message, author: message.author === "You" ? `Student · ${ticket.student}` : message.author }));
  return (
    <section className="conversation-inline" aria-label="Example ticket conversation">
      <div className="conversation-inline-head"><div className="eyebrow">Ticket conversation</div><Heading size="md" mt="1">{audience === "student" ? "Conversation with the helpdesk" : "Comments with the student"}</Heading></div>
      <div className="conversation-summary">Messages are shared between the student and helpdesk technician.</div>
      <div className="conversation-list">
        {comments.map((comment) => <article className={`comment-bubble ${comment.author === "You" || comment.author === "Alex Morgan" && audience === "technician" ? "mine" : ""}`} key={`${comment.author}-${comment.time}`}><div className="comment-meta"><b>{comment.author}</b><time>{comment.time}</time></div><p>{comment.text}</p></article>)}
      </div>
      <div className="notice">Sample conversation shown in portfolio preview.</div>
    </section>
  );
}

export default function TicketConversation({ ticket, audience, readOnly = false, onClose, inline = false }) {
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
      .catch((cause) => { if (active) setError(cause.message || "Could not load the ticket comments."); })
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
    } catch (cause) {
      setError(cause.message || "Your comment could not be sent.");
    } finally {
      setSending(false);
    }
  };

  const content = <>
    {inline ? (
      <div className="conversation-inline-head">
        <div className="eyebrow">Ticket conversation</div>
        <Heading size="md" mt="1">{audience === "student" ? "Conversation with the helpdesk" : "Comments with the student"}</Heading>
      </div>
    ) : (
      <div className="modal-head">
        <div><div className="eyebrow">{ticket.id} · Student helpdesk</div><Heading size="lg" mt="1">{ticket.title}</Heading></div>
        <button className="icon-button" type="button" onClick={onClose} aria-label="Close comments"><LuX /></button>
      </div>
    )}
    <div className="conversation-summary">Comments are visible to the student and the assigned helpdesk technician.</div>
    <div className="conversation-list" aria-live="polite">
      {loading ? <div className="conversation-empty">Loading comments…</div>
        : comments.length === 0 ? <div className="conversation-empty"><LuMessageSquare size={22} /><b>No comments yet</b><span>Send a message to start the conversation.</span></div>
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
        <label htmlFor={inline ? "inline-ticket-comment" : "ticket-comment"}>{audience === "student" ? "Reply to the helpdesk" : "Add a comment for the student"}</label>
        <textarea id={inline ? "inline-ticket-comment" : "ticket-comment"} maxLength={5000} rows={3} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Write a comment…" required />
        <div className="comment-form-foot">
          <small>Comments are shared with the student and assigned technician.</small>
          <Button type="submit" colorPalette="brand" disabled={sending || !message.trim()}><LuSend /> {sending ? "Sending…" : audience === "student" ? "Send reply" : "Send comment"}</Button>
        </div>
      </form>
    )}
  </>;

  if (showcase) return <PortfolioConversation audience={audience} ticket={ticket} />;

  if (inline) return <section className="conversation-inline" aria-label="Ticket comments">{content}</section>;
  return <div className="modal-scrim conversation-scrim" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="modal conversation-modal" aria-label="Ticket comments">{content}</section></div>;
}
