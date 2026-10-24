import { LogLevel } from "@azure/msal-browser";

export const msalConfig = {
  auth: {
    clientId: import.meta.env.VITE_ENTRA_CLIENT_ID,
    authority: import.meta.env.VITE_ENTRA_AUTHORITY,
    redirectUri: import.meta.env.VITE_ENTRA_REDIRECT_URI,
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

export const apiScopes = import.meta.env.VITE_ENTRA_API_SCOPE
  ? [import.meta.env.VITE_ENTRA_API_SCOPE]
  : [];

