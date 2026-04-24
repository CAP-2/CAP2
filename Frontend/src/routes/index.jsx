import { Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "../components/common/ProtectedRoute";
import UserLayout from "../components/layouts/UserLayout";
import AdminLayout from "../components/layouts/AdminLayout";
import ManagerLayout from "../components/layouts/ManagerLayout";
import MemberLayout from "../components/layouts/MemberLayout";

import Home from "../pages/shared/Home";
import NotFound from "../pages/shared/NotFound";
import FeatureDetailPage from "../pages/shared/FeatureDetailPage";
import BenefitsDetailPage from "../pages/shared/BenefitsDetailPage";
import NewsDetailPage from "../pages/shared/NewsDetailPage";
import GuideDetailPage from "../pages/shared/GuideDetailPage";

import DashboardHome from "../pages/admin/DashboardHome";
import GenealogyManagement from "../pages/admin/GenealogyManagement";
import MembersPage from "../pages/admin/MembersPage";
import EventsPage from "../pages/admin/EventsPage";
import GalleryPage from "../pages/admin/GalleryPage";
import SettingsPage from "../pages/admin/SettingsPage";

import AccountPage from "../pages/manager/AccountPage";
import GenealogySection from "../pages/manager/GenealogySection";
import ManagerDashboard from "../pages/manager/ManagerDashboard";
import PendingApprovals from "../pages/manager/PendingApprovals";
import MediaManagement from "../pages/manager/MediaManagement";

import FamilyTreePage from "../pages/user/FamilyTreePage";
import MemberDashboard from "../pages/member/MemberDashboard";

export default function AppRoutes() {
  return (
    <Routes>
      {/* Public Routes under UserLayout */}
      <Route element={<UserLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/tinh-nang" element={<FeatureDetailPage />} />
        <Route path="/loi-ich" element={<BenefitsDetailPage />} />
        <Route path="/tin-tuc" element={<NewsDetailPage />} />
        <Route path="/huong-dan" element={<GuideDetailPage />} />
      </Route>

      {/* Protected Member Portal Routes (DEDICATED UI) */}
      <Route element={<ProtectedRoute allowedRoles={["member", "manager", "admin"]} />}>
        <Route element={<MemberLayout />}>
          <Route path="/user/dashboard" element={<MemberDashboard />} />
          <Route path="/user/family-tree" element={<FamilyTreePage />} />
          <Route path="/user/submissions" element={<div>Bài đóng góp (Coming Soon)</div>} />
          <Route path="/user/profile" element={<div>Hồ sơ cá nhân (Coming Soon)</div>} />
        </Route>
      </Route>

      {/* Protected Manager Routes */}
      <Route element={<ProtectedRoute allowedRoles={["manager", "admin"]} />}>
        <Route element={<ManagerLayout />}>
          <Route path="/manager/dashboard" element={<ManagerDashboard />} />
          <Route path="/manager/account" element={<AccountPage />} />
          <Route path="/manager/genealogy" element={<GenealogySection />} />
          <Route path="/manager/pending" element={<PendingApprovals />} />
          <Route path="/manager/media" element={<MediaManagement />} />
        </Route>
      </Route>

      {/* Protected Admin Routes */}
      <Route element={<ProtectedRoute allowedRoles={["admin"]} />}>
        <Route element={<AdminLayout />}>
          <Route path="/dashboard" element={<DashboardHome />} />
          <Route path="/dashboard/genealogy" element={<GenealogyManagement />} />
          <Route path="/dashboard/members" element={<MembersPage />} />
          <Route path="/dashboard/events" element={<EventsPage />} />
          <Route path="/dashboard/gallery" element={<GalleryPage />} />
          <Route path="/dashboard/settings" element={<SettingsPage />} />
        </Route>
      </Route>

      {/* Redirects & 404 */}
      <Route path="/account" element={<Navigate to="/dashboard" replace />} />
      <Route path="/root/user" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
