import { useEffect, useState } from "react";
import { Button, Heading, Text } from "@chakra-ui/react";
import { InteractionStatus } from "@azure/msal-browser";
import { useMsal } from "@azure/msal-react";
import { LuLogIn, LuLogOut, LuShieldCheck } from "react-icons/lu";
import TicketConversation from "../components/tickets/TicketConversation.jsx";
import StudentRequestPanel from "../components/student/StudentRequestPanel.jsx";
import StudentTicketList from "../components/student/StudentTicketList.jsx";
import {
  databaseMode,
  getStudentTickets,
  submitStudentTicket,
} from "../services/ticket-api.js";

export default function StudentPortal() {
  const isRequestsPage = window.location.pathname.replace(/\/+$/, "") === "/student/requests";
  const { instance, accounts, inProgress } = useMsal();
  const account = instance.getActiveAccount() ?? accounts[0];
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState("");
  const [formKey, setFormKey] = useState(0);
  const [tickets, setTickets] = useState([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [ticketsError, setTicketsError] = useState("");
  const [conversationTicket, setConversationTicket] = useState(null);

  useEffect(() => {
    let active = true;

    if (!account || !databaseMode || !isRequestsPage) {
      setTicketsLoading(false);
      return () => {
        active = false;
      };
    }

    setTicketsLoading(true);
    setTicketsError("");
    getStudentTickets(instance, account)
      .then((rows) => {
        if (active) setTickets(rows);
      })
      .catch((loadError) => {
        if (active) setTicketsError(loadError.message || "Could not load your submitted tickets.");
      })
      .finally(() => {
        if (active) setTicketsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [instance, account?.homeAccountId, isRequestsPage]);

  const signIn = () => {
    setError("");
    sessionStorage.setItem("campus-helpdesk-return-path", window.location.pathname);
    instance
      .loginRedirect({ scopes: ["User.Read"], prompt: "select_account" })
      .catch((signInError) => setError(signInError.message || "Microsoft sign-in could not be started."));
  };

  const signOut = () => {
    sessionStorage.setItem("campus-helpdesk-return-path", window.location.pathname);
    return instance.logoutRedirect({ account });
  };

  const submit = async (values) => {
    if (!databaseMode) {
      throw new Error("Ticket submission is not configured yet. Set up the Entra API scope and database first.");
    }

    const ticket = await submitStudentTicket(instance, account, values);
    setReceipt(ticket.id);
    setFormKey((value) => value + 1);

    try {
      const rows = await getStudentTickets(instance, account);
      setTickets(rows);
      setTicketsError("");
    } catch {
      setTicketsError("Your request was submitted, but the list could not be refreshed. Use Refresh list to try again.");
    }
  };

  const refreshList = async () => {
    if (!account || !databaseMode) return;

    setTicketsLoading(true);
    setTicketsError("");
    try {
      setTickets(await getStudentTickets(instance, account));
    } catch (refreshError) {
      setTicketsError(refreshError.message || "Could not refresh your submitted tickets.");
    } finally {
      setTicketsLoading(false);
    }
  };

  return (
    <main className="portal-page">
      <header className="portal-top">
        <a className="signin-brand portal-brand" href="/student">
          <img className="ekc-logo ekc-logo-header" src="/assets/ekc-group-logo.png" alt="EKC Group — East Kent Colleges Group" />
          <div>
            <b>Student Helpdesk</b>
            <small>Student Support Desk</small>
          </div>
        </a>
        {account && (
          <div className="account-controls">
            <span className="account-name">{account.name || account.username}</span>
            <Button size="sm" variant="outline" onClick={signOut}>
              <LuLogOut /> Sign out
            </Button>
          </div>
        )}
      </header>

      <div className="portal-content">
        <section className="portal-intro">
          <div className="signin-icon"><LuShieldCheck size={25} /></div>
          <div className="eyebrow">Student self-service</div>
          <Heading size="2xl" mt="2" mb="2">
            {isRequestsPage ? "Your support requests" : "How can we help?"}
          </Heading>
          <Text color="gray.600" lineHeight="1.7">
            {isRequestsPage
              ? "Review the requests you have submitted and continue a conversation with the student helpdesk."
              : "Tell the student technician team what you need help with."}
          </Text>
        </section>

        {!account ? (
          <SignInCard error={error} disabled={inProgress !== InteractionStatus.None} onSignIn={signIn} />
        ) : (
          <>
            <StudentPortalNavigation isRequestsPage={isRequestsPage} />
            {isRequestsPage ? (
              <StudentTicketList
                tickets={tickets}
                loading={ticketsLoading}
                error={ticketsError}
                onRefresh={refreshList}
                onOpen={setConversationTicket}
              />
            ) : (
              <StudentRequestPanel account={account} receipt={receipt} formKey={formKey} onSubmit={submit} />
            )}
          </>
        )}

        <p className="portal-privacy">
          For your safety, do not include passwords, MFA codes, or sensitive personal information in your request.
        </p>
      </div>

      {conversationTicket && (
        <TicketConversation
          ticket={conversationTicket}
          audience="student"
          onClose={() => setConversationTicket(null)}
        />
      )}
      <footer className="portal-footer">Campus Helpdesk · Demo environment · No TOPdesk connection</footer>
    </main>
  );
}

function SignInCard({ error, disabled, onSignIn }) {
  return (
    <section className="portal-card portal-signin">
      <Heading size="lg" mb="2">Sign in to access your requests</Heading>
      <Text color="gray.600">Use your Microsoft account to view your tickets and submit a new request.</Text>
      {error && <div className="signin-error" role="alert">{error}</div>}
      <Button className="signin-button" colorPalette="ekc" size="lg" onClick={onSignIn} disabled={disabled}>
        <LuLogIn /> Sign in with Microsoft
      </Button>
      <div className="portal-link"><a href="/operator">Student technician sign in</a></div>
    </section>
  );
}

function StudentPortalNavigation({ isRequestsPage }) {
  return (
    <nav className="student-portal-nav" aria-label="Student helpdesk pages">
      <a className={!isRequestsPage ? "active" : ""} href="/student">Submit a request</a>
      <a className={isRequestsPage ? "active" : ""} href="/student/requests">My submitted tickets</a>
    </nav>
  );
}


