import { useEffect, useState } from "react";
import { Button, Input } from "@chakra-ui/react";
import { LuSearch } from "react-icons/lu";
import {
  DirectoryConsentRequiredError,
  directorySearchScopes,
  searchEntraStudents,
} from "../../services/entra-directory.js";

export default function EntraTechnicianSearch({ instance, account, selectedUser, onSelect }) {
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [needsConsent, setNeedsConsent] = useState(false);

  useEffect(() => {
    const text = query.trim();
    if (text.length < 2) {
      setMatches([]);
      setLoading(false);
      return undefined;
    }
    let current = true;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError("");
      setNeedsConsent(false);
      try {
        const results = await searchEntraStudents(instance, account, text);
        if (current) setMatches(results);
      } catch (searchError) {
        if (!current) return;
        setMatches([]);
        setError(searchError.message || "Could not search Entra.");
        setNeedsConsent(searchError instanceof DirectoryConsentRequiredError);
      } finally {
        if (current) setLoading(false);
      }
    }, 300);
    return () => {
      current = false;
      window.clearTimeout(timer);
    };
  }, [account?.homeAccountId, instance, query]);

  const requestConsent = () => instance.acquireTokenRedirect({ scopes: directorySearchScopes, account })
    .catch((consentError) => setError(consentError.message || "Could not request Microsoft directory permission."));

  if (selectedUser) {
    return (
      <div className="entra-technician-selected">
        <div><b>{selectedUser.displayName}</b><small>{selectedUser.email || "No email address in Entra"}</small></div>
        <Button type="button" size="xs" variant="outline" onClick={() => onSelect(null)}>Change</Button>
      </div>
    );
  }

  return (
    <div className="entra-technician-search">
      <label>Find technician in Entra
        <div className="directory-search-input"><LuSearch aria-hidden="true" /><Input value={query} onChange={(event) => { setQuery(event.target.value); setError(""); }} placeholder="Search by name or email" autoComplete="off" /></div>
      </label>
      <small>Search for an existing work or school account. Selecting a match fills its Entra object ID.</small>
      {loading && <div className="directory-search-message">Searching Entra…</div>}
      {error && <div className="signin-error directory-search-error" role="alert"><span>{error}</span>{needsConsent && <Button type="button" size="xs" variant="outline" onClick={requestConsent}>Continue to Microsoft</Button>}</div>}
      {matches.length > 0 && <ul className="directory-search-results" role="listbox" aria-label="Entra technician matches">
        {matches.map((user) => <li key={user.id}><button type="button" role="option" onClick={() => onSelect(user)}><b>{user.displayName}</b><span>{user.email || "No email address"}</span></button></li>)}
      </ul>}
      {!loading && query.trim().length >= 2 && !error && matches.length === 0 && <div className="directory-search-message">No matching Entra users found.</div>}
    </div>
  );
}

