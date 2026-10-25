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
        <main className={`content ${["queue", "mine"].includes(workspace.page) ? "queue-content" : ""}`}>
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
              onSelectTicket={workspace.setSelected}
              onCreateTicket={() => workspace.setCreateOpen(true)}
              displayAssignee={workspace.displayAssignee}
            />
          )}
          {workspace.page === "knowledge" && (
            <KnowledgeBasePage query={workspace.guideQuery} onQueryChange={workspace.setGuideQuery} onOpenGuide={workspace.setActiveGuide} />
          )}
          {workspace.page === "mine" && (
            <MyTicketsPage tickets={workspace.myTickets} technicianName={identity.technicianName} onSelectTicket={workspace.setSelected} />
          )}
          {workspace.page === "guidance" && <StudentGuidancePage />}
          {workspace.page === "directory" && workspace.canManageDirectory && (
            <DirectoryManagementPage instance={identity.instance} account={activeAccount} />
          )}
        </main>
      </Box>

      <TicketDetailsDrawer
        ticket={selected}
        technicianName={identity.technicianName}
        displayAssignee={workspace.displayAssignee}
        databaseMode={workspace.databaseMode}
        canManage={workspace.isAssignedToMe(selected)}
        onClose={() => workspace.setSelected(null)}
        onComments={() => workspace.setConversationTicket(selected)}
        onEdit={() => workspace.setEditing(true)}
        onAction={workspace.updateStatus}
        onEscalate={() => workspace.setSelected({ ...selected, showEscalation: true })}
      />
      {workspace.conversationTicket && (
        <TicketConversation
          ticket={workspace.conversationTicket}
          audience="technician"
          readOnly={!workspace.isAssignedToMe(workspace.conversationTicket)}
          onClose={() => workspace.setConversationTicket(null)}
        />
      )}
      <GuideDialog guide={workspace.activeGuide} onClose={() => workspace.setActiveGuide(null)} />
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


