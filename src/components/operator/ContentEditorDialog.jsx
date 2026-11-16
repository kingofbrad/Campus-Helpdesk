import { useState } from "react";
import { Button, Input } from "@chakra-ui/react";
import Modal from "../shared/Modal.jsx";

const blankGuide = { title: "", category: "", summary: "", icon_key: "help", steps: [""] };

export default function ContentEditorDialog({ editor, onClose, onSave, onDelete }) {
  if (!editor) return null;
  return editor.type === "guide"
    ? <GuideEditor key={editor.guide?.id || "new-guide"} guide={editor.guide} onClose={onClose} onSave={onSave} onDelete={onDelete} />
    : <GuidanceEditor key="student-guidance" guidance={editor.guidance} onClose={onClose} onSave={onSave} />;
}

function GuideEditor({ guide, onClose, onSave, onDelete }) {
  const [values, setValues] = useState(() => guide ? { ...guide, steps: [...guide.steps] } : blankGuide);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const change = (key) => (event) => setValues((current) => ({ ...current, [key]: event.target.value }));
  const submit = async (event) => {
    event.preventDefault(); setBusy(true); setError("");
    try { await onSave({ ...values, steps: values.steps.map((step) => step.trim()).filter(Boolean) }); }
    catch (cause) { setError(cause.message || "The guide could not be saved."); }
    finally { setBusy(false); }
  };
  return <Modal title={guide ? "Edit knowledge guide" : "Add knowledge guide"} eyebrow="Admin content" onClose={onClose}>
    <form className="request-form" onSubmit={submit}>
      <div className="form-grid">
        <label className="form-field span-two"><span>Title</span><Input required maxLength={140} value={values.title} onChange={change("title")} /></label>
        <label className="form-field"><span>Category</span><Input required maxLength={80} value={values.category} onChange={change("category")} /></label>
        <label className="form-field"><span>Icon</span><select value={values.icon_key || "help"} onChange={change("icon_key")}><option value="wifi">Wi-Fi</option><option value="laptop">Laptop</option><option value="shield">Account security</option><option value="printer">Printing</option><option value="volume">Room equipment</option><option value="help">General help</option></select></label>
        <label className="form-field span-two"><span>Short summary</span><textarea required maxLength={500} rows={3} value={values.summary} onChange={change("summary")} /></label>
        <div className="form-field span-two"><span>Steps</span>{values.steps.map((step, index) => <div className="content-step-row" key={index}><Input required maxLength={500} value={step} onChange={(event) => setValues((current) => ({ ...current, steps: current.steps.map((item, i) => i === index ? event.target.value : item) }))} placeholder={`Step ${index + 1}`} />{values.steps.length > 1 && <Button type="button" variant="outline" onClick={() => setValues((current) => ({ ...current, steps: current.steps.filter((_, i) => i !== index) }))}>Remove</Button>}</div>)}<Button mt="2" type="button" variant="outline" onClick={() => setValues((current) => ({ ...current, steps: [...current.steps, ""] }))}>Add step</Button></div>
      </div>
      {error && <div className="signin-error" role="alert">{error}</div>}
      <div className="form-actions">{guide && <Button type="button" colorPalette="red" variant="outline" disabled={busy} onClick={async () => { if (!window.confirm("Delete this knowledge guide? This removes it for every technician.")) return; setBusy(true); try { await onDelete(guide); } catch (cause) { setError(cause.message); setBusy(false); } }}>Delete guide</Button>}<Button type="button" variant="outline" disabled={busy} onClick={onClose}>Cancel</Button><Button type="submit" colorPalette="brand" disabled={busy}>{busy ? "Saving…" : "Save guide"}</Button></div>
    </form>
  </Modal>;
}

function GuidanceEditor({ guidance, onClose, onSave }) {
  const [values, setValues] = useState(() => ({ title: guidance?.title || "Student guidance", subtitle: guidance?.subtitle || "", items: guidance?.items?.map((item) => ({ ...item })) || [{ heading: "", text: "" }] }));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (event) => {
    event.preventDefault(); setBusy(true); setError("");
    try { await onSave(values); }
    catch (cause) { setError(cause.message || "Student guidance could not be saved."); }
    finally { setBusy(false); }
  };
  const updateItem = (index, key, value) => setValues((current) => ({ ...current, items: current.items.map((item, i) => i === index ? { ...item, [key]: value } : item) }));
  return <Modal title="Edit student guidance" eyebrow="Admin content" onClose={onClose}>
    <form className="request-form" onSubmit={submit}>
      <div className="form-grid">
        <label className="form-field span-two"><span>Page title</span><Input required maxLength={140} value={values.title} onChange={(event) => setValues((current) => ({ ...current, title: event.target.value }))} /></label>
        <label className="form-field span-two"><span>Introduction</span><textarea required maxLength={500} rows={2} value={values.subtitle} onChange={(event) => setValues((current) => ({ ...current, subtitle: event.target.value }))} /></label>
        {values.items.map((item, index) => <div className="form-field span-two guidance-edit-item" key={index}><span>Guidance point {index + 1}</span><Input required maxLength={140} aria-label="Heading" placeholder="Heading" value={item.heading} onChange={(event) => updateItem(index, "heading", event.target.value)} /><textarea required maxLength={1000} rows={3} aria-label="Guidance" placeholder="Guidance text" value={item.text} onChange={(event) => updateItem(index, "text", event.target.value)} />{values.items.length > 1 && <Button type="button" variant="outline" onClick={() => setValues((current) => ({ ...current, items: current.items.filter((_, i) => i !== index) }))}>Remove point</Button>}</div>)}
        {values.items.length < 12 && <Button type="button" variant="outline" onClick={() => setValues((current) => ({ ...current, items: [...current.items, { heading: "", text: "" }] }))}>Add guidance point</Button>}
      </div>
      {error && <div className="signin-error" role="alert">{error}</div>}
      <div className="form-actions"><Button type="button" variant="outline" disabled={busy} onClick={onClose}>Cancel</Button><Button type="submit" colorPalette="brand" disabled={busy}>{busy ? "Saving…" : "Save guidance"}</Button></div>
    </form>
  </Modal>;
}

