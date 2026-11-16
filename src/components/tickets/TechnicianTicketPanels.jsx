import { useCallback, useEffect, useState } from "react";
import { Button, Heading } from "@chakra-ui/react";
import { useMsal } from "@azure/msal-react";
import { addInternalTicketNote, getInternalTicketNotes, getTicketHistory } from "../../services/ticket-api.js";
import { LuHistory, LuLockKeyhole, LuSend } from "react-icons/lu";

function formatActor(entry, technicianName) {
  if (entry.actorType === "requester") return "Student";
  if (entry.actorType === "system") return "System";
  return entry.actorName || technicianName || "Technician";
}

export function TicketHistory({ ticket, technicianName }) {
  const { instance, accounts } = useMsal();
  const account = instance.getActiveAccount() ?? accounts[0];
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setEntries(await getTicketHistory(instance, account, ticket));
    } catch (cause) {
      setError(cause.message || "Ticket history could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [instance, account?.homeAccountId, ticket.databaseId]);

  useEffect(() => { load(); }, [load]);

  return (
    <section className="ticket-history" aria-label="Ticket history">
      <div className="ticket-panel-heading"><LuHistory /><Heading size="sm">Ticket history</Heading></div>
      {loading ? <div className="ticket-panel-empty">Loading history…</div>
        : error ? <div className="ticket-panel-error" role="alert">{error}</div>
          : entries.length === 0 ? <div className="ticket-panel-empty">No changes recorded yet.</div>
            : <ol className="ticket-history-list">
              {entries.map((entry) => (
                <li key={entry.id}>
                  <span className="ticket-history-marker" aria-hidden="true" />
                  <div><b>{entry.summary}</b><small>{formatActor(entry, technicianName)} · {entry.createdAt}</small>
                    {(entry.oldValue || entry.newValue) && <small className="ticket-history-values">{entry.fieldName ? `${entry.fieldName}: ` : ""}{entry.oldValue || "—"} → {entry.newValue || "—"}</small>}
                  </div>
                </li>
              ))}
            </ol>}
    </section>
  );
}

export function InternalNotesPanel({ ticket, technicianName, canManage }) {
  const { instance, accounts } = useMsal();
  const account = instance.getActiveAccount() ?? accounts[0];
  const [entries, setEntries] = useState([]);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setEntries(await getInternalTicketNotes(instance, account, ticket));
    } catch (cause) {
      setError(cause.message || "Internal notes could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [instance, account?.homeAccountId, ticket.databaseId]);

  useEffect(() => { load(); }, [load]);

  const submit = async (event) => {
    event.preventDefault();
    const value = note.trim();
    if (!value || saving || !canManage) return;
    setSaving(true);
    setError("");
    try {
      const created = await addInternalTicketNote(instance, account, ticket, value);
      setEntries((current) => [...current, created]);
      setNote("");
    } catch (cause) {
      setError(cause.message || "The internal note could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <aside className="internal-notes-panel" aria-label="Internal technician notes">
      <div className="ticket-panel-heading"><LuLockKeyhole /><div><Heading size="sm">Internal notes</Heading><small>Visible to technicians only</small></div></div>
      <div className="internal-note-list" aria-live="polite">
        {loading ? <div className="ticket-panel-empty">Loading notes…</div>
          : entries.length === 0 ? <div className="ticket-panel-empty">No internal notes yet.</div>
            : [...entries].reverse().map((entry) => (
              <article className="internal-note-card" key={entry.id}>
                <p>{entry.note}</p>
                <small>{entry.authorName || technicianName} · {entry.createdAt}</small>
              </article>
            ))}
      </div>
      {error && <div className="ticket-panel-error" role="alert">{error}</div>}
      {canManage ? (
        <form className="internal-note-form" onSubmit={submit}>
          <label htmlFor="ticket-internal-note">Add an internal note</label>
          <textarea id="ticket-internal-note" maxLength={5000} rows={4} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Record useful context for the next technician…" required />
          <Button type="submit" size="sm" colorPalette="brand" disabled={saving || !note.trim()}><LuSend /> {saving ? "Saving…" : "Add note"}</Button>
        </form>
      ) : <div className="notice">You can view these notes, but only the assigned technician can add one.</div>}
    </aside>
  );
}
