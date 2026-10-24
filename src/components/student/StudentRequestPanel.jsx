import TicketForm from "../tickets/TicketForm.jsx";

export default function StudentRequestPanel({ account, receipt, formKey, onSubmit }) {
  return (
    <section className="portal-card student-new-request">
      <div className="portal-card-heading">
        <div><b>Submit a new request</b><small>Tell us what you need help with.</small></div>
        <span className="portal-verified">Signed in as {account.name || account.username}</span>
      </div>
      {receipt && (
        <div className="receipt">
          <b>Request submitted</b>
          <span>Your reference is {receipt}. It has been routed to a technician at your selected site. <a href="/student/requests">View your submitted tickets</a></span>
        </div>
      )}
      <TicketForm
        key={formKey}
        lockRequester
        initialValues={{ requester_name: account.name || "", requester_email: account.username || "" }}
        submitLabel="Submit request"
        onSubmit={onSubmit}
      />
    </section>
  );
}

