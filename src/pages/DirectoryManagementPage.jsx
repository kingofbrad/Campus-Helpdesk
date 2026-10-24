import { useCallback, useEffect, useState } from "react";
import { Button } from "@chakra-ui/react";
import PageHeading from "../components/shared/PageHeading.jsx";
import EntraTechnicianSearch from "../components/operator/EntraTechnicianSearch.jsx";
import {
  createDirectorySite,
  createDirectoryTechnician,
  getDirectory,
  updateDirectorySite,
  updateDirectoryTechnician,
} from "../services/ticket-api.js";

export default function DirectoryManagementPage({ instance, account }) {
  const [directory, setDirectory] = useState({ sites: [], technicians: [], tenantId: "" });
  const [tab, setTab] = useState("sites");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editingSite, setEditingSite] = useState(null);
  const [editingTechnician, setEditingTechnician] = useState(null);
  const [selectedEntraUser, setSelectedEntraUser] = useState(null);

  const loadDirectory = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setDirectory(await getDirectory(instance, account));
    } catch (loadError) {
      setError(loadError.message || "Could not load the directory.");
    } finally {
      setLoading(false);
    }
  }, [instance, account?.homeAccountId]);

  useEffect(() => { loadDirectory(); }, [loadDirectory]);

  const save = async (operation, message) => {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await operation();
      await loadDirectory();
      setNotice(message);
      setEditingSite(null);
      setEditingTechnician(null);
    } catch (saveError) {
      setError(saveError.message || "The change could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  const addSite = (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    save(() => createDirectorySite(instance, account, values), "Site added.");
    event.currentTarget.reset();
  };

  const addTechnician = (event) => {
    event.preventDefault();
    if (!selectedEntraUser) {
      setError("Search Entra and select the technician account before adding it.");
      return;
    }
    const values = Object.fromEntries(new FormData(event.currentTarget));
    values.display_name = selectedEntraUser.displayName;
    values.entra_object_id = selectedEntraUser.id;
    values.is_active = true;
    values.can_view_all_tickets = event.currentTarget.elements.can_view_all_tickets.checked;
    save(() => createDirectoryTechnician(instance, account, values), "Technician added.");
    event.currentTarget.reset();
    setSelectedEntraUser(null);
  };

  return (
    <>
      <PageHeading eyebrow="Restricted to the directory administrator" title="Sites and technicians" subtitle="Manage the records used by the helpdesk. Create user accounts in Entra first, then add their Entra object ID here." />
      <div className="directory-tabs" role="tablist" aria-label="Directory sections">
        <button className={tab === "sites" ? "active" : ""} onClick={() => setTab("sites")}>Sites <span>{directory.sites.length}</span></button>
        <button className={tab === "technicians" ? "active" : ""} onClick={() => setTab("technicians")}>Technicians <span>{directory.technicians.length}</span></button>
        <Button size="sm" variant="outline" onClick={loadDirectory} disabled={loading}>Refresh</Button>
      </div>
      {error && <div className="notice" role="alert">{error}</div>}
      {notice && <div className="directory-success" role="status">{notice}</div>}
      {loading ? <div className="notice">Loading Supabase directory…</div> : tab === "sites" ? (
        <>
          <section className="panel directory-panel">
            <div className="panel-heading"><div><b>Add a site</b><small>New sites appear in the ticket forms.</small></div></div>
            <form className="directory-form site-form" onSubmit={addSite}>
              <label>Site name<input name="name" placeholder="For example, Ashford" required maxLength="100" /></label>
              <label>Site code<input name="code" placeholder="ashford" required maxLength="40" pattern="[a-z0-9]+(-[a-z0-9]+)*" title="Use lowercase letters, numbers, and hyphens." /></label>
              <Button type="submit" colorPalette="blue" disabled={saving}>{saving ? "Saving…" : "Add site"}</Button>
            </form>
          </section>
          <section className="panel directory-panel">
            <div className="panel-heading"><div><b>Helpdesk sites</b><small>Renaming a site updates how its tickets are labelled.</small></div></div>
            <div className="table-scroll"><table><thead><tr><th>Site</th><th>Code</th><th>Technicians</th><th></th></tr></thead><tbody>
              {directory.sites.map((site) => {
                const count = directory.technicians.filter((tech) => tech.site_id === site.id && tech.is_active).length;
                return <tr key={site.id}>
                  <td>{editingSite?.id === site.id ? <input className="directory-inline" value={editingSite.name} onChange={(event) => setEditingSite({ ...editingSite, name: event.target.value })} /> : <b>{site.name}</b>}</td>
                  <td>{editingSite?.id === site.id ? <input className="directory-inline" value={editingSite.code} onChange={(event) => setEditingSite({ ...editingSite, code: event.target.value })} /> : <code>{site.code}</code>}</td>
                  <td>{count} active</td>
                  <td className="directory-actions">{editingSite?.id === site.id ? <><button onClick={() => save(() => updateDirectorySite(instance, account, site.id, { name: editingSite.name, code: editingSite.code }), "Site updated.")} disabled={saving}>Save</button><button onClick={() => setEditingSite(null)}>Cancel</button></> : <button onClick={() => setEditingSite({ ...site })}>Edit</button>}</td>
                </tr>;
              })}
            </tbody></table></div>
          </section>
        </>
      ) : (
        <>
          <section className="panel directory-panel">
            <div className="panel-heading"><div><b>Add a technician</b><small>They must already exist as a member in this Entra tenant.</small></div></div>
            <form className="directory-form technician-form" onSubmit={addTechnician}>
              <div className="directory-form-span-two"><EntraTechnicianSearch instance={instance} account={account} selectedUser={selectedEntraUser} onSelect={setSelectedEntraUser} /></div>
              <label>Site<select name="site_id" required defaultValue=""><option value="" disabled>Select a site</option>{directory.sites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}</select></label>
              <label className="directory-check"><input name="can_view_all_tickets" type="checkbox" /> Can view tickets across all sites</label>
              <Button type="submit" colorPalette="blue" disabled={saving || !directory.sites.length || !selectedEntraUser}>{saving ? "Saving…" : "Add technician"}</Button>
            </form>
            <p className="directory-hint">Tenant ID: <code>{directory.tenantId || "Unavailable"}</code> (filled in automatically)</p>
          </section>
          <section className="panel directory-panel">
            <div className="panel-heading"><div><b>Technician accounts</b><small>Deactivate accounts when access should be removed. Records are retained for ticket history.</small></div></div>
            <div className="table-scroll"><table><thead><tr><th>Name and Entra ID</th><th>Site</th><th>Access</th><th>Status</th><th></th></tr></thead><tbody>
              {directory.technicians.map((tech) => <tr key={tech.id}>
                <td>{editingTechnician?.id === tech.id ? <div className="directory-edit-fields"><input className="directory-inline" value={editingTechnician.display_name} onChange={(event) => setEditingTechnician({ ...editingTechnician, display_name: event.target.value })} /><input className="directory-inline" value={editingTechnician.entra_object_id} onChange={(event) => setEditingTechnician({ ...editingTechnician, entra_object_id: event.target.value })} /></div> : <><b>{tech.display_name}</b><small className="directory-object-id">{tech.entra_object_id}</small></>}</td>
                <td>{editingTechnician?.id === tech.id ? <select className="directory-inline" value={editingTechnician.site_id} onChange={(event) => setEditingTechnician({ ...editingTechnician, site_id: event.target.value })}>{directory.sites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}</select> : tech.sites?.name || "Unknown"}</td>
                <td>{editingTechnician?.id === tech.id ? <label className="directory-check"><input type="checkbox" checked={editingTechnician.can_view_all_tickets} onChange={(event) => setEditingTechnician({ ...editingTechnician, can_view_all_tickets: event.target.checked })} /> All sites</label> : tech.can_view_all_tickets ? "All sites" : "Assigned queue"}</td>
                <td>{editingTechnician?.id === tech.id ? <label className="directory-check"><input type="checkbox" checked={editingTechnician.is_active} onChange={(event) => setEditingTechnician({ ...editingTechnician, is_active: event.target.checked })} /> Active</label> : tech.is_active ? "Active" : "Inactive"}</td>
                <td className="directory-actions">{editingTechnician?.id === tech.id ? <><button onClick={() => save(() => updateDirectoryTechnician(instance, account, tech.id, editingTechnician), "Technician updated.")} disabled={saving}>Save</button><button onClick={() => setEditingTechnician(null)}>Cancel</button></> : <button onClick={() => setEditingTechnician({ ...tech })}>Edit</button>}</td>
              </tr>)}
            </tbody></table></div>
          </section>
        </>
      )}
    </>
  );
}

