import { LogLevel } from "@azure/msal-browser";

// Keep this public portfolio build permanently in fictional-data showcase mode.
const showcase = true;

export const msalConfig = {
  auth: {
    clientId: "00000000-0000-0000-0000-000000000000",
    authority: "https://login.microsoftonline.com/common/",
    redirectUri: window.location.origin,
  },
  cache: {
    cacheLocation: "sessionStorage",
    storeAuthStateInCookie: false,
  },
  system: {
    loggerOptions: {
      logLevel: LogLevel.Warning,
      piiLoggingEnabled: false,
      loggerCallback: (level, message, containsPii) => {
        if (containsPii) return;
        if (level === LogLevel.Error) console.error(`[MSAL] ${message}`);
        else if (level === LogLevel.Warning) console.warn(`[MSAL] ${message}`);
      },
    },
  },
};

export const apiScopes = !showcase && import.meta.env.VITE_ENTRA_API_SCOPE
  ? [import.meta.env.VITE_ENTRA_API_SCOPE]
  : [];

export { showcase };

