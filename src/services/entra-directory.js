import { InteractionRequiredAuthError } from "@azure/msal-browser";

export const directorySearchScopes = ["User.Read.All"];

export class DirectoryConsentRequiredError extends Error {
  constructor(message) {
    super(message);
    this.name = "DirectoryConsentRequiredError";
  }
}

export async function searchEntraStudents(instance, account, searchText) {
  let accessToken;

  try {
    ({ accessToken } = await instance.acquireTokenSilent({
      scopes: directorySearchScopes,
      account,
    }));
  } catch (error) {
    if (error instanceof InteractionRequiredAuthError) {
      throw new DirectoryConsentRequiredError(
        "Microsoft needs permission to search the student directory. Continue to Microsoft to request access.",
      );
    }
    throw error;
  }

  const escapedSearchText = searchText.trim().replaceAll("'", "''");
  const filter = ["displayName", "mail", "userPrincipalName"]
    .map((property) => `startswith(${property},'${escapedSearchText}')`)
    .join(" or ");
  const url = new URL("https://graph.microsoft.com/v1.0/users");
  url.searchParams.set("$filter", filter);
  url.searchParams.set("$select", "id,displayName,mail,userPrincipalName,companyName");
  url.searchParams.set("$top", "10");
  url.searchParams.set("$count", "true");

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ConsistencyLevel: "eventual",
    },
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 403) {
      throw new DirectoryConsentRequiredError(
        "Entra denied directory search. A tenant administrator must grant Microsoft Graph delegated User.Read.All consent to this app.",
      );
    }
    throw new Error(data.error?.message || `Microsoft Graph search returned ${response.status}.`);
  }

  return (data.value || []).map((user) => ({
    id: user.id,
    displayName: user.displayName || "Unnamed student",
    email: user.mail || user.userPrincipalName || "",
    companyName: user.companyName || "",
  }));
}

