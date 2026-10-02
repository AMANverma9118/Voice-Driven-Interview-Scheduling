import Thread from "../components/Thread";
import CandidateFrame from "../components/CandidateFrame";

export default function Messages() {
  return (
    <CandidateFrame>
        <p className="kicker">From the desk</p>
        <h1>Messages</h1>
        <p className="lede">If a time is not right, the admin writes here. You can answer, or accept a new time. A moved interview shows up here as a notice.</p>
        <section className="sheet">
          <Thread path="/api/me/messages" />
        </section>
    </CandidateFrame>
  );
}
