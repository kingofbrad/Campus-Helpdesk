import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  databaseMode,
  getStudentReplies,
  getOperatorProfile,
  getOperatorContent,
  createKnowledgeGuide,
  updateKnowledgeGuide,
  deleteKnowledgeGuide,
  updateStudentGuidance,
  getTickets,
  performTicketAction,
  submitTechnicianTicket,
  updateTicketDetails,
} from "../services/ticket-api.js";
import {
  formatGreeting,
  initialTicketsFor,
  nextDemoTicketReference,
  technicianIdFor,
  technicianInitials,
} from "../utils/helpdesk.js";

export default function useOperatorWorkspace({ instance, activeAccount, technicianName }) {
  const [tickets, setTickets] = useState(() => databaseMode ? [] : initialTicketsFor(activeAccount));
  const [ticketLoading, setTicketLoading] = useState(databaseMode);
  const [ticketError, setTicketError] = useState("");
  const [operatorProfile, setOperatorProfile] = useState(null);
  const [content, setContent] = useState(null);
  const [contentError, setContentError] = useState("");
  const [contentEditor, setContentEditor] = useState(null);
  const [page, setPage] = useState("queue");
  const [selected, setSelected] = useState(null);
  const [conversationTicket, setConversationTicket] = useState(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All statuses");
  const [priority, setPriority] = useState("All priorities");
  const [guideQuery, setGuideQuery] = useState("");
  const [activeGuide, setActiveGuide] = useState(null);
  const [toast, setToast] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [lastCheckedAt, setLastCheckedAt] = useState(null);
  const knownTicketIds = useRef(null);
  const refreshInFlight = useRef(false);
  const replyCursor = useRef(null);
  const seenReplyIds = useRef(new Set());

  const technicianId = databaseMode ? operatorProfile?.id : technicianIdFor(activeAccount);
  const canViewAllTickets = Boolean(operatorProfile?.canViewAllTickets);
  const canViewAllTicketsRef = useRef(canViewAllTickets);
  canViewAllTicketsRef.current = canViewAllTickets;
  const displayAssignee = (ticket) => ticket.assigneeId === technicianId ? technicianName : ticket.assignee;
  const notify = (message) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 3000);
  };

  const refreshTickets = useCallback(async ({ manual = false } = {}) => {
    if (!databaseMode || !activeAccount || refreshInFlight.current) return;
    refreshInFlight.current = true;
    if (manual) setRefreshing(true);
    if (knownTicketIds.current === null) setTicketLoading(true);
    const checkStartedAt = new Date().toISOString();

    try {
      const rows = await getTickets(instance, activeAccount);
      const currentIds = new Set(rows.map((ticket) => ticket.databaseId));
      const firstCheck = knownTicketIds.current === null;
      if (firstCheck) replyCursor.current = new Date().toISOString();

      if (knownTicketIds.current !== null) {
        const arrivals = rows.filter((ticket) => !knownTicketIds.current.has(ticket.databaseId));
        if (arrivals.length) {
          const receivedAt = new Date().toISOString();
          const ticketAlerts = arrivals.map((ticket) => ({
            id: `ticket-${ticket.databaseId || ticket.id}`,
            kind: "ticket",
            ticketDatabaseId: ticket.databaseId,
            title: ticket.title,
            student: ticket.student,
            site: ticket.site,
            reference: ticket.id,
            receivedAt,
            read: false,
            sharedQueue: canViewAllTicketsRef.current,
          }));
          setNotifications((current) => [...ticketAlerts, ...current].slice(0, 30));
          notify(arrivals.length === 1
            ? `${canViewAllTicketsRef.current ? "New ticket in shared queue" : "New ticket assigned"}: ${arrivals[0].title}`
            : canViewAllTicketsRef.current
              ? `${arrivals.length} new tickets have been added to the shared queue.`
              : `${arrivals.length} new tickets have been assigned to you.`);
        }
      }

      if (!firstCheck && replyCursor.current) {
        try {
          const replies = await getStudentReplies(instance, activeAccount, replyCursor.current);
          const unseenReplies = replies.filter((reply) => !seenReplyIds.current.has(reply.id));
          unseenReplies.forEach((reply) => seenReplyIds.current.add(reply.id));
          if (unseenReplies.length) {
            setNotifications((current) => [...unseenReplies.map((reply) => ({ ...reply, read: false })), ...current].slice(0, 30));
            notify(unseenReplies.length === 1 ? `New reply on ${unseenReplies[0].reference}` : `${unseenReplies.length} new student replies`);
          }
          replyCursor.current = checkStartedAt;
        } catch (error) {
          console.warn("Could not check for student replies.", error);
        }
      }

      knownTicketIds.current = currentIds;
      setTickets(rows);
      setTicketError("");
      setLastCheckedAt(new Date());
    } catch (error) {
      setTicketError(error.message || "Could not refresh your assigned tickets.");
      if (manual) notify(error.message || "Could not refresh your tickets.");
    } finally {
      refreshInFlight.current = false;
      setTicketLoading(false);
      if (manual) setRefreshing(false);
    }
  }, [instance, activeAccount?.homeAccountId]);

  useEffect(() => {
    if (!databaseMode || !activeAccount) {
      setOperatorProfile(null);
      setTicketLoading(false);
      return undefined;
    }

    let active = true;
    setOperatorProfile(null);
    setTicketLoading(true);
    getOperatorProfile(instance, activeAccount)
      .then((profile) => {
        if (!active) return;
        setOperatorProfile(profile);
      })
      .catch((error) => {
        if (!active) return;
        setTicketError(error.message || "Could not load your technician permissions.");
        setTicketLoading(false);
      });

    return () => {
      active = false;
    };
  }, [instance, activeAccount?.homeAccountId]);

  useEffect(() => {
    if (!databaseMode || !activeAccount || !operatorProfile) { setContent(null); return undefined; }
    let active = true;
    getOperatorContent(instance, activeAccount).then((result) => { if (active) { setContent(result); setContentError(""); } }).catch((error) => { if (active) setContentError(error.message || "Could not load helpdesk content. Run the content database migration and refresh."); });
    return () => { active = false; };
  }, [instance, activeAccount?.homeAccountId, operatorProfile?.id]);
  useEffect(() => {
    if (!databaseMode || !activeAccount || !operatorProfile) {
      setTicketLoading(false);
      return undefined;
    }
    knownTicketIds.current = null;
    replyCursor.current = null;
    seenReplyIds.current = new Set();
    setNotifications([]);
    setNotificationsOpen(false);
    setLastCheckedAt(null);
    refreshTickets();

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") refreshTickets();
    }, 30_000);
    return () => window.clearInterval(interval);
  }, [activeAccount?.homeAccountId, operatorProfile?.id, refreshTickets]);

  const myTickets = useMemo(
    () => databaseMode && !canViewAllTickets
      ? tickets
      : tickets.filter((ticket) => Boolean(technicianId) && ticket.assigneeId === technicianId),
    [databaseMode, canViewAllTickets, tickets, technicianId],
  );
  // In database mode the API already restricts personal technicians to their assignments.
  // Avoid filtering that trusted response a second time against a client-side identity value.
  const queueTickets = databaseMode || canViewAllTickets ? tickets : myTickets;
  const openCount = queueTickets.filter((ticket) => ticket.status !== "Resolved").length;
  const filteredTickets = useMemo(() => queueTickets.filter((ticket) => {
    const matchesStatus = status === "All statuses" || ticket.status === status;
    const matchesPriority = priority === "All priorities" || ticket.priority === priority;
    const searchText = `${ticket.id} ${ticket.title} ${ticket.student} ${ticket.category}`.toLowerCase();
    return matchesStatus && matchesPriority && searchText.includes(query.toLowerCase());
  }), [queueTickets, status, priority, query]);
  const isAssignedToMe = (ticket) => {
    if (!ticket) return false;
    if (databaseMode && !canViewAllTickets) {
      return tickets.some((row) => row.databaseId && row.databaseId === ticket.databaseId);
    }
    return Boolean(technicianId) && ticket.assigneeId === technicianId;
  };

  const updateTicket = async (ticketId, updateDemoTicket, action) => {
    if (databaseMode) {
      const ticket = tickets.find((item) => item.id === ticketId);
      if (!ticket) return;
      try {
        await performTicketAction(instance, activeAccount, ticket, action);
        setTickets(await getTickets(instance, activeAccount));
        setSelected(null);
        notify("Ticket updated and saved.");
      } catch (error) {
        notify(error.message || "Could not save the ticket update.");
      }
      return;
    }
    setTickets((current) => current.map((ticket) => ticket.id === ticketId ? updateDemoTicket({ ...ticket }) : ticket));
    setSelected(null);
    notify("Ticket updated in this demo.");
  };

  const saveTicketDetails = async (values) => {
    if (!selected) return;
    if (databaseMode) {
      await updateTicketDetails(instance, activeAccount, selected, values);
      const rows = await getTickets(instance, activeAccount);
      setTickets(rows);
      setSelected(rows.find((ticket) => ticket.databaseId === selected.databaseId) || null);
      setEditing(false);
      notify("Ticket changes saved.");
      return;
    }
    const updatedTicket = {
      ...selected,
      student: values.requester_name.trim(),
      initials: technicianInitials(values.requester_name),
      email: values.requester_email.trim(),
      title: values.title.trim(),
      description: values.description.trim(),
      category: values.category,
      priority: values.priority === "high" ? "High" : values.priority === "low" ? "Low" : "Normal",
      updated: "Just now",
      notes: [...selected.notes, `Ticket details updated by ${technicianName}.`],
    };
    setTickets((current) => current.map((ticket) => ticket.id === selected.id ? updatedTicket : ticket));
    setSelected(updatedTicket);
    setEditing(false);
    notify("Ticket changes saved in this demo.");
  };

  const changePage = (nextPage) => {
    setPage(nextPage);
    setSelected(null);
  };

  const updateStatus = (action) => {
    if (!selected) return;
    updateTicket(selected.id, (ticket) => {
      if (action === "progress") {
        ticket.status = "In progress";
        ticket.notes.push("Status changed to In progress.");
      }
      if (action === "waiting") {
        ticket.status = "Waiting for student";
        ticket.notes.push("Status changed to Waiting for student.");
      }
      if (action === "resolve") {
        ticket.status = "Resolved";
        ticket.notes.push(`Marked resolved by ${technicianName}.`);
      }
      if (action === "escalate") {
        ticket.assigneeId = "staff-it";
        ticket.assignee = "Staff IT review";
        ticket.status = "Escalated";
        ticket.notes.push("Escalation handover preview marked ready for on-site support.");
      }
      ticket.updated = "Just now";
      return ticket;
    }, action);
  };

  const createTicket = async (values) => {
    if (databaseMode) {
      await submitTechnicianTicket(instance, activeAccount, values);
      const rows = await getTickets(instance, activeAccount);
      knownTicketIds.current = new Set(rows.map((ticket) => ticket.databaseId));
      setTickets(rows);
      setCreateOpen(false);
      notify("Ticket saved and routed to a technician at the selected site.");
      return;
    }

    const requesterName = values.requester_name.trim();
    const newTicket = {
      id: nextDemoTicketReference(tickets),
      title: values.title,
      student: requesterName,
      initials: technicianInitials(requesterName),
      email: values.requester_email,
      site: values.site_code === "sheppey" ? "Sheppey" : "Canterbury",
      category: values.category,
      priority: values.priority === "high" ? "High" : values.priority === "low" ? "Low" : "Normal",
      status: "New",
      assignee: technicianName,
      assigneeId: technicianId,
      updated: "Just now",
      description: values.description,
      notes: [`Logged by ${technicianName} on behalf of the student.`],
    };
    setTickets((current) => [newTicket, ...current]);
    setCreateOpen(false);
    notify("Ticket added to this demo queue.");
  };

  const saveGuide = async (values) => {
    const editingGuide = contentEditor?.guide;
    if (editingGuide) {
      const saved = await updateKnowledgeGuide(instance, activeAccount, editingGuide.id, values);
      setContent((current) => ({ ...current, knowledgeGuides: current.knowledgeGuides.map((guide) => guide.id === saved.id ? saved : guide) }));
    } else {
      const id = values.title.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || `guide-${Date.now()}`;
      const saved = await createKnowledgeGuide(instance, activeAccount, { ...values, id });
      setContent((current) => ({ ...current, knowledgeGuides: [...(current?.knowledgeGuides || []), saved].sort((a, b) => a.sort_order - b.sort_order || a.title.localeCompare(b.title)) }));
    }
    setContentEditor(null); notify("Knowledge guide saved for all technicians.");
  };
  const removeGuide = async (guide) => {
    await deleteKnowledgeGuide(instance, activeAccount, guide.id);
    setContent((current) => ({ ...current, knowledgeGuides: current.knowledgeGuides.filter((item) => item.id !== guide.id) }));
    setContentEditor(null); notify("Knowledge guide removed.");
  };
  const saveGuidance = async (values) => {
    const saved = await updateStudentGuidance(instance, activeAccount, values);
    setContent((current) => ({ ...current, studentGuidance: saved }));
    setContentEditor(null); notify("Student guidance saved for all technicians.");
  };
  const selectNotification = (item) => {
    const ticket = tickets.find((row) => row.databaseId === item.ticketDatabaseId);
    if (ticket) {
      setPage("queue");
      setSelected(ticket);
      if (item.kind === "reply") setConversationTicket(ticket);
    }
    setNotificationsOpen(false);
  };

  return {
    databaseMode,
    tickets,
    ticketLoading,
    ticketError,
    page,
    setPage,
    selected,
    setSelected,
    conversationTicket,
    setConversationTicket,
    query,
    setQuery,
    status,
    setStatus,
    priority,
    setPriority,
    guideQuery,
    setGuideQuery,
    activeGuide,
    contentGuides: content?.knowledgeGuides || null,
    studentGuidance: content?.studentGuidance || null,
    contentError,
    contentEditor,
    setContentEditor,
    saveGuide,
    removeGuide,
    saveGuidance,
    setActiveGuide,
    toast,
    notifications,
    setNotifications,
    notificationsOpen,
    setNotificationsOpen,
    lastCheckedAt,
    refreshing,
    refreshTickets,
    myTickets,
    openCount,
    filteredTickets,
    queueTickets,
    canViewAllTickets,
    canManageDirectory: Boolean(operatorProfile?.canManageDirectory),
    tenantId: operatorProfile?.tenantId || "",
    isAssignedToMe,
    technicianId,
    displayAssignee,
    changePage,
    updateStatus,
    saveTicketDetails,
    createTicket,
    selectNotification,
    greeting: formatGreeting(new Date().getHours()),
    setEditing,
    editing,
    createOpen,
    setCreateOpen,
  };
}




