import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Layout from "@/components/Layout";
import Home from "@/pages/Home";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Habits from "@/pages/Habits";
import Checkin from "@/pages/Checkin";
import Character from "@/pages/Character";
import Circles from "@/pages/Circles";
import CircleDetail from "@/pages/CircleDetail";
import Quotes from "@/pages/Quotes";
import UserCenter from "@/pages/UserCenter";
import ForgotPassword from "@/pages/ForgotPassword";
import Admin from "@/pages/Admin";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/habits" element={<Habits />} />
          <Route path="/checkin" element={<Checkin />} />
          <Route path="/character" element={<Character />} />
          <Route path="/circles" element={<Circles />} />
          <Route path="/circles/:id" element={<CircleDetail />} />
          <Route path="/quotes" element={<Quotes />} />
          <Route path="/user-center" element={<UserCenter />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/admin" element={<Admin />} />
        </Route>
      </Routes>
    </Router>
  );
}