import { useEffect, useState } from "react";
import { Button, Heading, Text } from "@chakra-ui/react";
import { InteractionStatus } from "@azure/msal-browser";
import { useMsal } from "@azure/msal-react";
import { LuLogIn, LuLogOut, LuShieldCheck } from "react-icons/lu";
import StudentRequestPanel from "../components/student/StudentRequestPanel.jsx";
import StudentTicketList from "../components/student/StudentTicketList.jsx";
import StudentTicketDetailsPage from "../components/student/StudentTicketDetailsPage.jsx";
import { portfolioShowcase, showcaseStudent } from "../config/showcase.js";
import { sampleTickets } from "../data/demo-data.js";
import {
  databaseMode,
  getStudentTickets,
  submitStudentTicket,
} from "../services/ticket-api.js";

export default function StudentPortal() {
  const isRequestsPage =
    window.location.pathname.replace(/\/+$/, "") === "/student/requests";
  const { instance, accounts, inProgress } = useMsal();
  const account = portfolioShowcase ? showcaseStudent : instance.getActiveAccount() ?? accounts[0];
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState("");
  const [formKey, setFormKey] = useState(0);
  const [tickets, setTickets] = useState([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [ticketsError, setTicketsError] = useState("");
  const [selectedTicket, setSelectedTicket] = useState(null);

  useEffect(() => {
    let active = true;

    if (portfolioShowcase && isRequestsPage) {
      setTickets(sampleTickets.filter((ticket) => ticket.student === showcaseStudent.name).map((ticket) => ({ ...ticket, submitted: "14 Nov 2026, 10:24", unreadCommentCount: 1, latestUnreadCommentAt: "2026-11-14T10:25:00Z" })));
      setTicketsLoading(false);
      return () => { active = false; };
    }

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
        if (active)
          setTicketsError(
            loadError.message || "Could not load your submitted tickets.",
          );
      })
      .finally(() => {
        if (active) setTicketsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [instance, account?.homeAccountId, isRequestsPage]);

  const signIn = () => {
    if (portfolioShowcase) return;
    setError("");
    sessionStorage.setItem(
      "campus-helpdesk-return-path",
      window.location.pathname,
    );
    instance
      .loginRedirect({ scopes: ["User.Read"], prompt: "select_account" })
      .catch((signInError) =>
        setError(
          signInError.message || "Microsoft sign-in could not be started.",
        ),
      );
  };

  const signOut = () => {
    if (portfolioShowcase) return;
    sessionStorage.setItem(
      "campus-helpdesk-return-path",
      window.location.pathname,
    );
    return instance.logoutRedirect({ account });
  };

  const submit = async (values) => {
    if (portfolioShowcase) {
      const ticket = {
        id: "26-11-14-0009",
        title: values.title,
        student: showcaseStudent.name,
        initials: "AK",
        email: showcaseStudent.username,
        site: values.site_code === "north_campus" ? "North Campus" : "Riverside Campus",
        category: values.category,
        priority: values.priority || "Normal",
        status: "New",
        assignee: "Jordan Lee",
        updated: "Just now",
        submitted: "14 Nov 2026, just now",
        description: values.description,
        notes: ["Request submitted in portfolio preview."],
        databaseId: "portfolio-ticket-9",
      };
      setReceipt(ticket.id);
      setFormKey((value) => value + 1);
      setTickets((current) => [ticket, ...current]);
      return;
    }

    if (!databaseMode) {
      throw new Error(
        "Ticket submission is not configured yet. Set up the Entra API scope and database first.",
      );
    }

    const ticket = await submitStudentTicket(instance, account, values);
    setReceipt(ticket.id);
    setFormKey((value) => value + 1);

    try {
      const rows = await getStudentTickets(instance, account);
      setTickets(rows);
      setTicketsError("");
    } catch {
      setTicketsError(
        "Your request was submitted, but the list could not be refreshed. Use Refresh list to try again.",
      );
    }
  };

  const refreshList = async () => {
    if (portfolioShowcase) {
      setTickets(sampleTickets.filter((ticket) => ticket.student === showcaseStudent.name).map((ticket) => ({ ...ticket, submitted: "14 Nov 2026, 10:24", unreadCommentCount: 1, latestUnreadCommentAt: "2026-11-14T10:25:00Z" })));
      return;
    }
    if (!account || !databaseMode) return;

    setTicketsLoading(true);
    setTicketsError("");
    try {
      setTickets(await getStudentTickets(instance, account));
    } catch (refreshError) {
      setTicketsError(
        refreshError.message || "Could not refresh your submitted tickets.",
      );
    } finally {
      setTicketsLoading(false);
    }
  };

  return (
    <main
      className={`portal-page${selectedTicket ? " student-ticket-open" : ""}`}
    >
      <header className="portal-top">
        <a className="signin-brand portal-brand" href="/student">
          <span className="brand-mark portal-brand-mark" aria-hidden="true">C</span>
          <div>
            <b>Campus Support Desk</b>
            <small>Student Services Demo</small>
          </div>
        </a>
        {account && (
          <div className="account-controls">
            <span className="account-name">
              {account.name || account.username}
            </span>
            {!portfolioShowcase && <Button size="sm" variant="outline" onClick={signOut}><LuLogOut /> Sign out</Button>}
          </div>
        )}
      </header>

      <div
        className={`portal-content${selectedTicket ? " student-ticket-content" : ""}`}
      >
        {!selectedTicket && (
          <section className="portal-intro">
            <div className="signin-icon">
              <LuShieldCheck size={25} />
            </div>
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
        )}

        {!account ? (
          <SignInCard
            error={error}
            disabled={inProgress !== InteractionStatus.None}
            onSignIn={signIn}
          />
        ) : (
          <>
            <StudentPortalNavigation isRequestsPage={isRequestsPage} />
            {isRequestsPage ? (
              selectedTicket ? (
                <StudentTicketDetailsPage
                  ticket={selectedTicket}
                  onBack={() => setSelectedTicket(null)}
                />
              ) : (
                <StudentTicketList
                  tickets={tickets}
                  loading={ticketsLoading}
                  error={ticketsError}
                  onRefresh={refreshList}
                  onOpen={setSelectedTicket}
                />
              )
            ) : (
              <StudentRequestPanel
                account={account}
                receipt={receipt}
                formKey={formKey}
                onSubmit={submit}
              />
            )}
          </>
        )}

        <p className="portal-privacy">
          For your safety, do not include passwords, MFA codes, or sensitive
          personal information in your request.
        </p>
      </div>

      <footer className="portal-footer">
        Portfolio preview · Sample data only
      </footer>
    </main>
  );
}

function SignInCard({ error, disabled, onSignIn }) {
  return (
    <section className="portal-card portal-signin">
      <Heading size="lg" mb="2">
        Sign in to access your requests
      </Heading>
      <Text color="gray.600">
        Use your Microsoft account to view your tickets and submit a new
        request.
      </Text>
      {error && (
        <div className="signin-error" role="alert">
          {error}
        </div>
      )}
      <Button
        className="signin-button"
        colorPalette="brand"
        size="lg"
        onClick={onSignIn}
        disabled={disabled}
      >
        <LuLogIn /> Sign in with Microsoft
      </Button>
      <div className="portal-link">
        <a href="/operator">Student technician sign in</a>
      </div>
    </section>
  );
}

function StudentPortalNavigation({ isRequestsPage }) {
  return (
    <nav className="student-portal-nav" aria-label="Student helpdesk pages">
      <a className={!isRequestsPage ? "active" : ""} href="/student">
        Submit a request
      </a>
      <a className={isRequestsPage ? "active" : ""} href="/student/requests">
        My submitted tickets
      </a>
    </nav>
  );
}
