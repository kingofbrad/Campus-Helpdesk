import { Button } from "@chakra-ui/react";
import { useMsal } from "@azure/msal-react";
import { LuLogOut, LuRefreshCw } from "react-icons/lu";
import NotificationCentre from "./NotificationCentre.jsx";
import { showcase } from "../../config/auth-config.js";
import { showcaseTechnician } from "../../config/showcase.js";

export default function OperatorHeader({
  title,
  databaseMode,
  refreshing,
  ticketLoading,
  onRefresh,
  notifications,
  notificationsOpen,
  lastCheckedAt,
  onToggleNotifications,
  onClearNotifications,
  onSelectNotification,
}) {
  const { instance, accounts } = useMsal();
  const account = showcase ? showcaseTechnician : instance.getActiveAccount() ?? accounts[0];
  const signOut = () => {
    if (showcase) return;
    sessionStorage.setItem("campus-helpdesk-return-path", "/operator");
    return instance.logoutRedirect({ account });
  };

  return (
    <header className="topbar">
      <div className="breadcrumb">Student Support <span>/</span><b>{title}</b></div>
      <div className="top-right">
        <span className="demo-tag">● Portfolio preview · Sample data</span>
        {databaseMode && (
          <>
            <Button className="refresh-button" size="sm" variant="outline" onClick={onRefresh} disabled={refreshing || ticketLoading}>
              <LuRefreshCw className={refreshing ? "spin" : ""} /> {refreshing ? "Refreshing…" : "Refresh"}
            </Button>
            <NotificationCentre
              notifications={notifications}
              open={notificationsOpen}
              lastCheckedAt={lastCheckedAt}
              onToggle={onToggleNotifications}
              onClear={onClearNotifications}
              onSelect={onSelectNotification}
            />
          </>
        )}
        <div className="account-controls">
          <span className="account-name">{account.name || account.username}</span>
          {!showcase && <Button size="sm" variant="outline" onClick={signOut}><LuLogOut /> Sign out</Button>}
        </div>
      </div>
    </header>
  );
}

