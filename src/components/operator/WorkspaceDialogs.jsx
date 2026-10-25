import { Button } from "@chakra-ui/react";
import Modal from "../shared/Modal.jsx";
import TicketForm from "../tickets/TicketForm.jsx";
import TicketEditForm from "../tickets/TicketEditForm.jsx";

export function GuideDialog({ guide, onClose }) {
  if (!guide) return null;
  return (
    <Modal title={guide.title} eyebrow={guide.category} onClose={onClose}>
      <p>{guide.summary}</p>
      <div className="detail-label">Suggested checks</div>
      <ol className="steps">{guide.steps.map((step) => <li key={step}>{step}</li>)}</ol>
      <div className="notice">Follow school guidance and stay within your training. If in doubt, ask a staff member.</div>
      <div className="modal-actions"><Button colorPalette="ekc" onClick={onClose}>Done</Button></div>
    </Modal>
  );
}

export function EditTicketDialog({ ticket, onSave, onClose }) {
  if (!ticket) return null;
  return (
    <Modal title="Edit ticket" eyebrow={ticket.id} onClose={onClose}>
      <p>Correct the ticket details and save the update.</p>
      <TicketEditForm ticket={ticket} onSave={onSave} onCancel={onClose} />
    </Modal>
  );
}

export function CreateTicketDialog({ open, onCreate, onClose }) {
  if (!open) return null;
  return (
    <Modal title="Create ticket for student" eyebrow="Walk-up support" onClose={onClose}>
      <p>Log the request while the student is with you. It will be routed to an active technician at the selected site.</p>
      <TicketForm showPriority enableDirectorySearch submitLabel="Create ticket" onSubmit={onCreate} onCancel={onClose} />
    </Modal>
  );
}

export function EscalationDialog({ ticket, onClose, onConfirm }) {
  if (!ticket?.showEscalation) return null;
  return (
    <Modal title="Escalate to on-site IT" eyebrow="Handover preview" onClose={onClose}>
      <p>Review the summary that would be handed to the staff IT team.</p>
      <div className="preview">
        <PreviewField label="Student helpdesk reference" value={ticket.id} />
        <PreviewField label="Issue" value={ticket.title} />
        <PreviewField label="Category / priority" value={`${ticket.category} · ${ticket.priority}`} />
        <PreviewField label="What has been tried" value={ticket.notes.join(" ")} />
        <PreviewField label="Student contact" value={`${ticket.student} · ${ticket.email}`} />
      </div>
      <div className="notice">Demo only — this does not create a TOPdesk ticket or send information anywhere.</div>
      <div className="modal-actions">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button colorPalette="ekc" onClick={onConfirm}>Mark escalated in demo</Button>
      </div>
    </Modal>
  );
}

function PreviewField({ label, value }) {
  return <div className="preview-field"><small>{label}</small><b>{value}</b></div>;
}


