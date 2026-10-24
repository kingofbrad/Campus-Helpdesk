import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { InteractionStatus, PublicClientApplication } from "@azure/msal-browser";
import { MsalProvider, useMsal } from "@azure/msal-react";
import { msalConfig } from "./config/auth-config.js";
import App from "./App.jsx";
import StudentPortal from "./pages/StudentPortal.jsx";
import "./styles/main.css";

const msalInstance = new PublicClientApplication(msalConfig);
function RootApp() {
  const [path, setPath] = useState(() => window.location.pathname.replace(/\/+$/, "") || "/");
  const { inProgress } = useMsal();

  useEffect(() => {
    if (path !== "/" || inProgress !== InteractionStatus.None) return;

    const savedPath = sessionStorage.getItem("campus-helpdesk-return-path");
    const returnPath = savedPath && (/^\/student(?:\/requests)?$/.test(savedPath) || savedPath === "/operator") ? savedPath : "/operator";
    sessionStorage.removeItem("campus-helpdesk-return-path");
    window.history.replaceState(null, "", returnPath);
    setPath(returnPath);
  }, [inProgress, path]);

  return path === "/student" || path.startsWith("/student/") ? <StudentPortal /> : <App />;
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <MsalProvider instance={msalInstance}>
      <ChakraProvider value={defaultSystem}>
        <RootApp />
      </ChakraProvider>
    </MsalProvider>
  </React.StrictMode>
);

