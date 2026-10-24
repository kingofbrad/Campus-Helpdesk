import { useEffect, useState } from "react";
import { Button, Input } from "@chakra-ui/react";
import { LuSearch } from "react-icons/lu";
import {
  DirectoryConsentRequiredError,
  directorySearchScopes,
  searchEntraStudents,
} from "../../services/entra-directory.js";

export default function StudentDirectorySearch({ instance, account, sites, onSelect }) {
  const [query, setQuery] = useState("");
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [needsConsent, setNeedsConsent] = useState(false);
  const [selectionNotice, setSelectionNotice] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState("");

  useEffect(() => {
    const searchText = query.trim();
    if (searchText.length < 2 || selectedStudentId) {
      setStudents([]);
      setLoading(false);
      return undefined;
    }

    setError("");
    setNeedsConsent(false);
    let active = true;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError("");
      setNeedsConsent(false);
      try {
        const matches = await searchEntraStudents(instance, account, searchText);
        if (active) setStudents(matches);
      } catch (searchError) {
        if (!active) return;
        setStudents([]);
        setError(searchError.message || "Could not search the student directory.");
        setNeedsConsent(searchError instanceof DirectoryConsentRequiredError);
      } finally {
        if (active) setLoading(false);
      }
    }, 350);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [account?.homeAccountId, instance, query, selectedStudentId]);

  const selectStudent = (student) => {
    const normalizedCompany = student.companyName.toLowerCase();
    const matchingSite = sites.find((site) => {
      const name = site.name.toLowerCase();
      const code = site.code.toLowerCase();
      return normalizedCompany.includes(name) || normalizedCompany.includes(code);
    });

    onSelect({ ...student, siteCode: matchingSite?.code || "" });
    setSelectedStudentId(student.id);
    setSelectionNotice(matchingSite
      ? `Selected ${student.displayName}; site set to ${matchingSite.name}. You can change it below.`
      : `Selected ${student.displayName}; no helpdesk site matched “${student.companyName || "company name not set"}”, so choose a site below.`);
    setQuery(`${student.displayName} · ${student.email}`);
    setStudents([]);
  };

  const requestConsent = () => {
    instance.acquireTokenRedirect({ scopes: directorySearchScopes, account })
      .catch((consentError) => setError(consentError.message || "Could not request Microsoft directory permission."));
  };

  return (
    <div className="student-directory-search span-two">
      <label className="form-field" htmlFor="student-directory-query">
        <span>Find student in Entra</span>
        <div className="directory-search-input">
          <LuSearch aria-hidden="true" />
          <Input
            id="student-directory-query"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setSelectedStudentId("");
              setSelectionNotice("");
            }}
            placeholder="Search by student name or email"
            autoComplete="off"
          />
        </div>
      </label>
      <small className="directory-search-help">Enter at least 2 characters. Select a match to fill in the student name, email, and site.</small>
      {loading && <div className="directory-search-message">Searching Entra…</div>}
      {error && (
        <div className="signin-error directory-search-error" role="alert">
          <span>{error}</span>
          {needsConsent && <Button size="xs" variant="outline" onClick={requestConsent}>Continue to Microsoft</Button>}
        </div>
      )}
      {selectionNotice && <div className="directory-search-message" role="status">{selectionNotice}</div>}
      {students.length > 0 && (
        <ul className="directory-search-results" role="listbox" aria-label="Entra student matches">
          {students.map((student) => {
            const company = student.companyName || "No company/site set";
            return (
              <li key={student.id}>
                <button type="button" role="option" onClick={() => selectStudent(student)}>
                  <b>{student.displayName}</b>
                  <span>{student.email || "No email address"}</span>
                  <small>{company}</small>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {!loading && query.trim().length >= 2 && !error && students.length === 0 && !selectionNotice && (
        <div className="directory-search-message">No matching students found.</div>
      )}
    </div>
  );
}

