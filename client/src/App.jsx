import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth";
import { Login, Register, Verify } from "./pages/Account";
import Desk from "./pages/Desk";
import Home from "./pages/Home";
import Join from "./pages/Join";
import Interview from "./pages/Interview";
import Messages from "./pages/Messages";
import Profile from "./pages/Profile";
import Record from "./pages/Record";

import { homeFor, signInPath } from "./home";

function RequireAuth({ children }) {
  const { user, ready } = useAuth();
  if (!ready) return <p className="loading gate-wait">Opening the desk…</p>;
  if (!user) return <Navigate to={signInPath()} replace />;
  return children;
}

function GuestOnly({ children }) {
  const { user, ready } = useAuth();
  if (!ready) return <p className="loading gate-wait">Opening the desk…</p>;
  if (user) return <Navigate to={homeFor(user)} replace />;
  return children;
}

function AdminOnly({ children }) {
  const { user } = useAuth();
  if (user?.role !== "admin") return <Navigate to="/profile" replace />;
  return children;
}

function CandidateOnly({ children }) {
  const { user } = useAuth();
  if (user?.role === "admin") return <Navigate to="/overview" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
      <Route path="/register" element={<GuestOnly><Register /></GuestOnly>} />
      <Route path="/verify" element={<Verify />} />
      <Route path="/join/:slug" element={<Join />} />
      <Route path="/profile" element={<RequireAuth><CandidateOnly><Profile /></CandidateOnly></RequireAuth>} />
      <Route path="/interview" element={<RequireAuth><CandidateOnly><Interview /></CandidateOnly></RequireAuth>} />
      <Route path="/record" element={<RequireAuth><CandidateOnly><Record /></CandidateOnly></RequireAuth>} />
      <Route path="/messages" element={<RequireAuth><CandidateOnly><Messages /></CandidateOnly></RequireAuth>} />
      <Route path="/*" element={<RequireAuth><AdminOnly><Desk /></AdminOnly></RequireAuth>} />
    </Routes>
  );
}
