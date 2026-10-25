import { LuBookOpen, LuClock3, LuFileText, LuLayoutDashboard, LuSettings2 } from "react-icons/lu";

function NavigationItem({ icon: Icon, label, active, count, onClick }) {
  return (
    <button className={`nav-item ${active ? "active" : ""}`} onClick={onClick}>
      <Icon size={17} />
      <span>{label}</span>
      {count != null && <b className="nav-count">{count}</b>}
    </button>
  );
}

export default function OperatorSidebar({ page, openCount, technicianName, initials, onNavigate, canManageDirectory }) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <img className="ekc-logo ekc-logo-sidebar" src="/assets/EKC_Group_Footer.svg" alt="EKC Group — East Kent Colleges Group" />
        <div><b>Student Helpdesk</b><small>Student Support Desk</small></div>
      </div>
      <div className="nav-label">Workspace</div>
      <NavigationItem icon={LuLayoutDashboard} label="Ticket queue" count={openCount} active={page === "queue"} onClick={() => onNavigate("queue")} />
      <NavigationItem icon={LuBookOpen} label="Knowledge base" active={page === "knowledge"} onClick={() => onNavigate("knowledge")} />
      <NavigationItem icon={LuClock3} label="My tickets" active={page === "mine"} onClick={() => onNavigate("mine")} />
      <div className="nav-label resources">Resources</div>
      <NavigationItem icon={LuFileText} label="Student guidance" active={page === "guidance"} onClick={() => onNavigate("guidance")} />
      {canManageDirectory && <NavigationItem icon={LuSettings2} label="Sites & technicians" active={page === "directory"} onClick={() => onNavigate("directory")} />}
      <div className="profile">
        <div className="person-avatar">{initials}</div>
        <div><b>{technicianName}</b><small>Student technician</small></div>
      </div>
    </aside>
  );
}

