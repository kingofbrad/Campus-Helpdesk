import { useEffect, useState } from "react";
import { EventType, InteractionRequiredAuthError } from "@azure/msal-browser";
import { useMsal } from "@azure/msal-react";
import { portfolioShowcase, showcaseTechnician } from "../config/showcase.js";

export default function useTechnicianIdentity() {
  const { instance, accounts, inProgress } = useMsal();
  const [authError, setAuthError] = useState("");
  const [profileName, setProfileName] = useState("");
  const [profileLoading, setProfileLoading] = useState(true);
  const activeAccount = portfolioShowcase ? showcaseTechnician : instance.getActiveAccount() ?? accounts[0];

  useEffect(() => {
    const callbackId = instance.addEventCallback((event) => {
      if (event.eventType === EventType.LOGIN_SUCCESS && event.payload?.account) {
        instance.setActiveAccount(event.payload.account);
        setAuthError("");
      }
      if (event.eventType === EventType.LOGIN_FAILURE) {
        setAuthError(event.error?.message || "Microsoft sign-in failed. Check the account and app registration, then try again.");
      }
    });
    return () => { if (callbackId) instance.removeEventCallback(callbackId); };
  }, [instance]);

  useEffect(() => {
    if (!instance.getActiveAccount() && accounts.length) instance.setActiveAccount(accounts[0]);
  }, [instance, accounts]);

  useEffect(() => {
    let cancelled = false;
    if (portfolioShowcase) {
      setProfileName(showcaseTechnician.name);
      setProfileLoading(false);
      return () => { cancelled = true; };
    }
    if (!activeAccount) {
      setProfileName("");
      setProfileLoading(false);
      return () => { cancelled = true; };
    }

    setProfileName("");
    setProfileLoading(true);
    instance.acquireTokenSilent({ scopes: ["User.Read"], account: activeAccount })
      .then(({ accessToken }) => fetch("https://graph.microsoft.com/v1.0/me?$select=displayName", {
        headers: { Authorization: `Bearer ${accessToken}` },
      }))
      .then((response) => {
        if (!response.ok) throw new Error(`Microsoft Graph returned ${response.status}`);
        return response.json();
      })
      .then((profile) => { if (!cancelled) setProfileName(profile.displayName || ""); })
      .catch((error) => {
        if (cancelled) return;
        if (error instanceof InteractionRequiredAuthError) {
          instance.acquireTokenRedirect({ scopes: ["User.Read"], account: activeAccount }).catch(() => {});
        }
      })
      .finally(() => { if (!cancelled) setProfileLoading(false); });

    return () => { cancelled = true; };
  }, [instance, activeAccount?.homeAccountId]);

  const technicianName = profileName || activeAccount?.name || activeAccount?.username?.split("@")[0] || "Student technician";
  return { instance, accounts, inProgress, activeAccount, authError, technicianName, profileLoading };
}

