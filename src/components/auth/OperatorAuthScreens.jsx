import { useState } from "react";
import { Button, Heading, Text } from "@chakra-ui/react";
import { useMsal } from "@azure/msal-react";
import { LuLogIn, LuShieldCheck } from "react-icons/lu";

export function OperatorSignInPage({ authError = "" }) {
  const { instance } = useMsal();
  const [error, setError] = useState("");
  const signIn = () => {
    setError("");
    sessionStorage.setItem("campus-helpdesk-return-path", "/operator");
    instance.loginRedirect({ scopes: ["User.Read"], prompt: "select_account" })
      .catch((signInError) => setError(signInError.message || "Microsoft sign-in could not be started. Please try again."));
  };

  return (
    <main className="signin-page">
      <Brand />
      <section className="signin-card">
        <div className="signin-icon"><LuShieldCheck size={25} /></div>
        <div className="eyebrow">Student technician workspace</div>
        <Heading size="xl" mt="2" mb="2">Sign in to continue</Heading>
        <Text color="gray.600" lineHeight="1.65">Use your Microsoft account to access the student helpdesk demo.</Text>
        <Button className="signin-button" colorPalette="blue" size="lg" onClick={signIn}><LuLogIn /> Sign in with Microsoft</Button>
        {(error || authError) && <div className="signin-error" role="alert">{error || authError}</div>}
        <div className="signin-foot"><LuShieldCheck /><span>Sign-in is handled by Microsoft. Ticket access is limited to your assigned queue.</span></div>
      </section>
      <div className="portal-link"><a href="/student">Need help? Submit a student request</a></div>
      <div className="signin-caption">Campus Helpdesk · Demo environment</div>
    </main>
  );
}

export function AuthRedirectPage() {
  return (
    <AuthStatusPage eyebrow="Student technician workspace" title="Completing sign-in" message="Microsoft is returning you to the helpdesk. This can take a moment." />
  );
}

export function ProfileLoadingPage() {
  return (
    <AuthStatusPage eyebrow="Student technician workspace" title="Loading your profile" message="We’re loading your Microsoft profile before opening your assigned ticket queue." />
  );
}

function AuthStatusPage({ eyebrow, title, message }) {
  return (
    <main className="signin-page">
      <Brand />
      <section className="signin-card">
        <div className="signin-icon"><LuShieldCheck size={25} /></div>
        <div className="eyebrow">{eyebrow}</div>
        <Heading size="xl" mt="2" mb="2">{title}</Heading>
        <Text color="gray.600" lineHeight="1.65">{message}</Text>
      </section>
      <div className="signin-caption">Campus Helpdesk · Demo environment</div>
    </main>
  );
}

function Brand() {
  return (
    <div className="signin-brand">
      <div className="brand-mark">C</div>
      <div><b>Campus Helpdesk</b><small>Student Support Desk</small></div>
    </div>
  );
}

