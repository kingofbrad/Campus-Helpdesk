import { useEffect, useState } from "react";
import { Button, Input } from "@chakra-ui/react";
import { useMsal } from "@azure/msal-react";
import { getSites } from "../../services/ticket-api.js";
import StudentDirectorySearch from "./StudentDirectorySearch.jsx";

export const ticketCategories = ["Wi-Fi & network", "Device support", "Accounts & access", "Printing", "Classroom equipment", "Other"];

export default function TicketForm({ initialValues = {}, submitLabel, showPriority = false, lockRequester = false, enableDirectorySearch = false, onSubmit, onCancel, successMessage }) {
  const { instance, accounts } = useMsal();
  const account = instance.getActiveAccount() ?? accounts[0];
  const [sites, setSites] = useState([]);
  const [siteError, setSiteError] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [values, setValues] = useState({ requester_name: "", requester_email: "", requester_object_id: "", site_code: "", title: "", category: "", description: "", priority: "normal", ...initialValues });

  useEffect(() => {
    let active = true;
    getSites().then((result) => { if (active) setSites(result); }).catch((e) => { if (active) setSiteError(e.message || "Could not load helpdesk sites."); });
    return () => { active = false; };
  }, []);

  const change = (key) => (event) => setValues((current) => ({
    ...current,
    [key]: event.target.value,
    ...(key === "requester_name" || key === "requester_email" ? { requester_object_id: "" } : {}),
  }));
  const selectStudent = (student) => {
    setValues((current) => ({
      ...current,
      requester_name: student.displayName,
      requester_email: student.email,
      requester_object_id: student.id,
      site_code: student.siteCode,
    }));
  };
  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setBusy(true);
    try { await onSubmit(values); }
    catch (e) { setError(e.message || "The ticket could not be submitted."); }
    finally { setBusy(false); }
  };

  return <form className="request-form" onSubmit={submit}>
    {successMessage && <div className="notice success-notice">{successMessage}</div>}
    {siteError && <div className="signin-error" role="alert">{siteError} Start the API server and try again.</div>}
    <div className="form-grid">
      {enableDirectorySearch && account && (
        <StudentDirectorySearch instance={instance} account={account} sites={sites} onSelect={selectStudent} />
      )}
      <label className="form-field"><span>Student name</span><Input required maxLength={160} readOnly={lockRequester} value={values.requester_name} onChange={change("requester_name")} placeholder="Your name" /></label>
      <label className="form-field"><span>Contact email</span><Input required type="email" maxLength={254} readOnly={lockRequester} value={values.requester_email} onChange={change("requester_email")} placeholder="you@example.edu" /></label>
      <label className="form-field"><span>Campus site</span><select required value={values.site_code} onChange={change("site_code")}><option value="">Select your site</option>{sites.map((site) => <option key={site.code} value={site.code}>{site.name}</option>)}</select></label>
      <label className="form-field"><span>Issue category</span><select required value={values.category} onChange={change("category")}><option value="">Select a category</option>{ticketCategories.map((category) => <option key={category}>{category}</option>)}</select></label>
      <label className="form-field span-two"><span>What do you need help with?</span><Input required maxLength={200} value={values.title} onChange={change("title")} placeholder="A short summary of the issue" /></label>
      <label className="form-field span-two"><span>Describe the issue</span><textarea required maxLength={5000} rows={5} value={values.description} onChange={change("description")} placeholder="Include what happened, any error message, and what you have already tried." /></label>
      {showPriority && <label className="form-field"><span>Initial priority</span><select value={values.priority} onChange={change("priority")}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option></select></label>}
    </div>
    {error && <div className="signin-error" role="alert">{error}</div>}
    <div className="form-actions">{onCancel && <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>}<Button type="submit" colorPalette="blue" disabled={busy || !!siteError || !sites.length}>{busy ? "Submitting…" : submitLabel}</Button></div>
  </form>;
}

