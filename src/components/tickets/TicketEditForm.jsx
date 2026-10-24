import { useState } from "react";
import { Button, Input } from "@chakra-ui/react";
import { ticketCategories } from "./TicketForm.jsx";

export default function TicketEditForm({ ticket, onSave, onCancel }) {
  const [values, setValues] = useState({
    requester_name: ticket.student,
    requester_email: ticket.email,
    title: ticket.title,
    description: ticket.description,
    category: ticket.category,
    priority: ticket.priority.toLowerCase(),
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const change = (field) => (event) => setValues((current) => ({ ...current, [field]: event.target.value }));
  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setBusy(true);
    try { await onSave(values); }
    catch (e) { setError(e.message || "The ticket could not be updated."); }
    finally { setBusy(false); }
  };

  return <form className="request-form" onSubmit={submit}>
    <div className="notice">You can update the request details. Site and technician assignment stay unchanged.</div>
    <div className="form-grid">
      <label className="form-field"><span>Student name</span><Input required maxLength={160} value={values.requester_name} onChange={change("requester_name")} /></label>
      <label className="form-field"><span>Contact email</span><Input required type="email" maxLength={254} value={values.requester_email} onChange={change("requester_email")} /></label>
      <label className="form-field"><span>Issue category</span><select required value={values.category} onChange={change("category")}>{ticketCategories.map((category) => <option key={category}>{category}</option>)}</select></label>
      <label className="form-field"><span>Priority</span><select value={values.priority} onChange={change("priority")}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option></select></label>
      <label className="form-field span-two"><span>Issue summary</span><Input required maxLength={200} value={values.title} onChange={change("title")} /></label>
      <label className="form-field span-two"><span>Description</span><textarea required maxLength={5000} rows={5} value={values.description} onChange={change("description")} /></label>
    </div>
    {error && <div className="signin-error" role="alert">{error}</div>}
    <div className="form-actions"><Button type="button" variant="outline" onClick={onCancel} disabled={busy}>Cancel</Button><Button type="submit" colorPalette="blue" disabled={busy}>{busy ? "Saving…" : "Save changes"}</Button></div>
  </form>;
}

