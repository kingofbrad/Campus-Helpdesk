import { Box, Flex } from "@chakra-ui/react";
import { InteractionStatus } from "@azure/msal-browser";
import useOperatorWorkspace from "../hooks/useOperatorWorkspace.js";
import useTechnicianIdentity from "../hooks/useTechnicianIdentity.js";
import TicketConversation from "../components/tickets/TicketConversation.jsx";
import OperatorHeader from "../components/operator/OperatorHeader.jsx";
import OperatorSidebar from "../components/operator/OperatorSidebar.jsx";
import TicketDetailsDrawer from "../components/operator/TicketDetailsDrawer.jsx";
import {
  KnowledgeBasePage,
  MyTicketsPage,
  StudentGuidancePage,
  TicketQueuePage,
} from "../components/operator/OperatorPages.jsx";
import {
  CreateTicketDialog,
  EditTicketDialog,
  EscalationDialog,
  GuideDialog,
} from "../components/operator/WorkspaceDialogs.jsx";
import { AuthRedirectPage, OperatorSignInPage, ProfileLoadingPage } from "../components/auth/OperatorAuthScreens.jsx";
import { technicianInitials } from "../utils/helpdesk.js";
import ContentEditorDialog from "../components/operator/ContentEditorDialog.jsx";
import { LuX } from "react-icons/lu";
import DirectoryManagementPage from "./DirectoryManagementPage.jsx";

export default function OperatorWorkspace() {
  const identity = useTechnicianIdentity();
  const activeAccount = identity.activeAccount;
  const workspace = useOperatorWorkspace({
    instance: identity.instance,
    activeAccount,
    technicianName: identity.technicianName,
  });

  if (!activeAccount) {
    return identity.inProgress !== InteractionStatus.None
      ? <AuthRedirectPage />
      : <OperatorSignInPage authError={identity.authError} />;
  }
  if (identity.profileLoading) return <ProfileLoadingPage />;

  const pageTitles = {
    queue: "Ticket queue",
    knowledge: "Knowledge base",
    mine: "My tickets",
    guidance: "Student guidance",
    directory: "Sites & technicians",
  };
  const firstName = identity.technicianName.trim().split(/\s+/)[0];
  const selected = workspace.selected;

  return (
    <Flex minH="100vh" bg="#f5f7fa" color="#152235">
      <OperatorSidebar
        page={workspace.page}
        openCount={workspace.openCount}
        technicianName={identity.technicianName}
        initials={technicianInitials(identity.technicianName)}
        canManageDirectory={workspace.canManageDirectory}
        onNavigate={workspace.changePage}
      />
      <Box flex="1" minW="0">
        <OperatorHeader
          title={pageTitles[workspace.page]}
          databaseMode={workspace.databaseMode}
          refreshing={workspace.refreshing}
          ticketLoading={workspace.ticketLoading}
          onRefresh={() => workspace.refreshTickets({ manual: true })}
          notifications={workspace.notifications}
          notificationsOpen={workspace.notificationsOpen}
          lastCheckedAt={workspace.lastCheckedAt}
          onToggleNotifications={() => {
            const nextOpen = !workspace.notificationsOpen;
            workspace.setNotificationsOpen(nextOpen);
            if (nextOpen) workspace.setNotifications((items) => items.map((item) => ({ ...item, read: true })));
          }}
          onClearNotifications={() => workspace.setNotifications([])}
          onSelectNotification={workspace.selectNotification}
        />
        {workspace.ticketTabs.length > 0 && (
          <div className="ticket-workspace-tabs" role="tablist" aria-label="Open tickets">
            {workspace.ticketTabs.map((tab) => (
              <div className={`ticket-workspace-tab ${workspace.activeTicketTabId === tab.id ? "active" : ""}`} key={tab.id}>
                <button className="ticket-workspace-tab-select" type="button" role="tab" aria-selected={workspace.activeTicketTabId === tab.id} title={`${tab.ticket.id} · ${tab.ticket.title}`} onClick={() => workspace.activateTicketTab(tab.id)}>
                  <strong>{tab.ticket.id}</strong><span>{tab.ticket.title}</span>
                </button>
                <button className="ticket-workspace-tab-close" type="button" aria-label={`Close ${tab.ticket.id}`} title={`Close ${tab.ticket.id}`} onClick={() => workspace.closeTicketTab(tab.id)}><LuX /></button>
              </div>
            ))}
          </div>
        )}
        <main className={`content ${!workspace.selected && ["queue", "mine"].includes(workspace.page) ? "queue-content" : ""}`}>
          {workspace.selected ? (
            <TicketDetailsDrawer
              ticket={workspace.selected}
              technicianName={identity.technicianName}
              displayAssignee={workspace.displayAssignee}
              databaseMode={workspace.databaseMode}
              canManage={workspace.isAssignedToMe(workspace.selected)}
              onComments={() => workspace.setConversationTicket(workspace.selected)}
              onEdit={() => workspace.setEditing(true)}
              onAction={workspace.updateStatus}
              onEscalate={() => workspace.setSelected({ ...workspace.selected, showEscalation: true })}
            />
          ) : <>
          {workspace.page === "queue" && (
            <TicketQueuePage
              databaseMode={workspace.databaseMode}
              ticketError={workspace.ticketError}
              ticketLoading={workspace.ticketLoading}
              firstName={firstName}
              greeting={workspace.greeting}
              technicianName={identity.technicianName}
              canViewAllTickets={workspace.canViewAllTickets}
              queueTickets={workspace.queueTickets}
              openCount={workspace.openCount}
              filteredTickets={workspace.filteredTickets}
              query={workspace.query}
              status={workspace.status}
              priority={workspace.priority}
              onQueryChange={workspace.setQuery}
              onStatusChange={workspace.setStatus}
              onPriorityChange={workspace.setPriority}
              onSelectTicket={workspace.openTicket}
              onCreateTicket={() => workspace.setCreateOpen(true)}
              displayAssignee={workspace.displayAssignee}
            />
          )}
          {workspace.page === "knowledge" && (
            <KnowledgeBasePage
              query={workspace.guideQuery}
              onQueryChange={workspace.setGuideQuery}
              onOpenGuide={workspace.setActiveGuide}
              guides={workspace.contentGuides}
              contentError={workspace.contentError}
              canManageContent={workspace.canManageDirectory}
              onAddGuide={() => workspace.setContentEditor({ type: "guide" })}
              onEditGuide={(guide) => workspace.setContentEditor({ type: "guide", guide })}
            />
          )}
          {workspace.page === "mine" && (
            <MyTicketsPage tickets={workspace.myTickets} technicianName={identity.technicianName} onSelectTicket={workspace.openTicket} />
          )}
          {workspace.page === "guidance" && (
            <StudentGuidancePage
              guidance={workspace.studentGuidance}
              contentError={workspace.contentError}
              canManageContent={workspace.canManageDirectory}
              onEdit={() => workspace.setContentEditor({ type: "guidance", guidance: workspace.studentGuidance })}
            />
          )}
          {workspace.page === "directory" && workspace.canManageDirectory && (
            <DirectoryManagementPage instance={identity.instance} account={activeAccount} />
          )}
          </>}
        </main>
      </Box>

      {workspace.conversationTicket && (
        <TicketConversation
          ticket={workspace.conversationTicket}
          audience="technician"
          readOnly={!workspace.isAssignedToMe(workspace.conversationTicket)}
          onClose={() => workspace.setConversationTicket(null)}
        />
      )}
      <GuideDialog guide={workspace.activeGuide} onClose={() => workspace.setActiveGuide(null)} />
      <ContentEditorDialog
        editor={workspace.contentEditor}
        onClose={() => workspace.setContentEditor(null)}
        onSave={workspace.contentEditor?.type === "guidance" ? workspace.saveGuidance : workspace.saveGuide}
        onDelete={workspace.removeGuide}
      />
      <EditTicketDialog ticket={workspace.editing ? selected : null} onSave={workspace.saveTicketDetails} onClose={() => workspace.setEditing(false)} />
      <CreateTicketDialog open={workspace.createOpen} onCreate={workspace.createTicket} onClose={() => workspace.setCreateOpen(false)} />
      <EscalationDialog
        ticket={selected}
        onClose={() => workspace.setSelected({ ...selected, showEscalation: false })}
        onConfirm={() => {
          workspace.setSelected(null);
          workspace.updateStatus("escalate");
        }}
      />
      {workspace.toast && <div className="toast">{workspace.toast}</div>}
    </Flex>
  );
}
















