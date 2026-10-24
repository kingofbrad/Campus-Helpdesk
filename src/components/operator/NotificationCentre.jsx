import { LuBell } from "react-icons/lu";

export default function NotificationCentre({ notifications, open, lastCheckedAt, onToggle, onClear, onSelect }) {
  const unreadCount = notifications.filter((item) => !item.read).length;

  return (
    <div className="notification-wrap">
      <button
        className="notification-trigger"
        type="button"
        aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : "Notifications"}
        aria-expanded={open}
        onClick={onToggle}
      >
        <LuBell size={17} />
        {unreadCount > 0 && <span className="notification-count">{unreadCount > 9 ? "9+" : unreadCount}</span>}
      </button>
      {open && (
        <section className="notification-panel" aria-label="Notification centre">
          <header>
            <div>
              <b>Notifications</b>
              <small>{lastCheckedAt
                ? `Last checked ${lastCheckedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                : "Checking for tickets…"}</small>
            </div>
            {notifications.length > 0 && <button type="button" onClick={onClear}>Clear all</button>}
          </header>
          {notifications.length === 0 ? (
            <div className="notification-empty">
              <LuBell size={19} />
              <b>You’re all caught up</b>
              <span>New tickets and student replies will appear here.</span>
            </div>
          ) : (
            <div className="notification-list">
              {notifications.map((item) => (
                <button
                  type="button"
                  className={`notification-item ${item.read ? "" : "unread"}`}
                  key={item.id}
                  onClick={() => onSelect(item)}
                >
                  <span className="notification-dot" />
                  <span className="notification-copy">
                    <b>{item.kind === "reply" ? "Student replied" : item.sharedQueue ? "New ticket in shared queue" : "New ticket assigned"}</b>
                    <strong>{item.kind === "reply" ? item.message : item.title}</strong>
                    <small>{item.reference} · {item.student}{item.site ? ` · ${item.site}` : ""}</small>
                  </span>
                  <time>{new Date(item.receivedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time>
                </button>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

