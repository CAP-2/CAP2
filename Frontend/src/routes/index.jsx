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
import Login from "../pages/Login/Login";
import Register from "../pages/Register/Register";
import ClanRegister from "../pages/ClanRegister/ClanRegister";
import ForgotPassword from "../pages/ForgotPassword/ForgotPassword";
import Waiting from "../pages/Waiting/Waiting";

import DashboardHome from "../pages/admin/DashboardHome";
import GenealogyManagement from "../pages/admin/GenealogyManagement";
import PostsPage from "../pages/admin/PostsPage";
import MembersPage from "../pages/admin/MembersPage";
import SettingsPage from "../pages/admin/SettingsPage";

import AccountPage from "../pages/Manager/AccountPage";
import GenealogySection from "../pages/Manager/GenealogySection";
import ManagerDashboard from "../pages/Manager/ManagerDashboard";
import PendingApprovals from "../pages/Manager/PendingApprovals";

import FamilyTreePage from "../pages/user/FamilyTreePage";
import MemberDashboard from "../pages/Member/MemberDashboard";
import MemberProfile from "../pages/Member/MemberProfile";
import MemberSubmissions from "../pages/Member/MemberSubmissions";
import TaskManagementPage from "../pages/Tasks/TaskManagementPage";
import GeneralPosts from "../pages/GeneralPosts/GeneralPosts";
import TimeCapsulePage from "../pages/TimeCapsule/TimeCapsulePage";

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/clan-register" element={<ClanRegister />} />
      <Route path="/forgot" element={<ForgotPassword />} />
      <Route path="/forgot-password" element={<Navigate to="/forgot" replace />} />
      <Route path="/waiting" element={<Waiting />} />

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
          <Route path="/user/posts" element={<GeneralPosts />} />
          <Route path="/posts/general" element={<GeneralPosts />} />
          <Route path="/user/tasks" element={<TaskManagementPage role="member" />} />
          <Route path="/user/time-capsule" element={<TimeCapsulePage role="member" />} />
          <Route path="/member/tasks/:taskId" element={<Navigate to="/user/tasks" replace />} />
          <Route path="/user/submissions" element={<MemberSubmissions />} />
          <Route path="/user/profile" element={<MemberProfile />} />
        </Route>
      </Route>

      {/* Protected Manager Routes */}
      <Route element={<ProtectedRoute allowedRoles={["manager", "admin"]} />}>
        <Route element={<ManagerLayout />}>
          <Route path="/manager" element={<Navigate to="/manager/dashboard" replace />} />
          <Route path="/manager/dashboard" element={<ManagerDashboard />} />
          <Route path="/manager/account" element={<AccountPage />} />
          <Route path="/manager/genealogy" element={<GenealogySection />} />
          <Route path="/manager/tasks" element={<TaskManagementPage role="manager" />} />
          <Route path="/manager/tasks/:taskId" element={<TaskManagementPage role="manager" />} />
          <Route path="/manager/time-capsule" element={<TimeCapsulePage role="manager" />} />
          <Route path="/manager/posts" element={<GeneralPosts />} />
          <Route path="/manager/pending" element={<PendingApprovals />} />
          <Route path="/manager/media" element={<Navigate to="/manager/posts" replace />} />
        </Route>
      </Route>

      {/* Protected Admin Routes */}
      <Route element={<ProtectedRoute allowedRoles={["admin"]} />}>
        <Route element={<AdminLayout />}>
          <Route path="/dashboard" element={<DashboardHome />} />
          <Route path="/dashboard/genealogy" element={<GenealogyManagement />} />
          <Route path="/dashboard/posts" element={<PostsPage />} />
          <Route path="/dashboard/posts/clan/:clanId" element={<PostsPage />} />
          <Route path="/dashboard/tasks" element={<TaskManagementPage role="admin" />} />
          <Route path="/dashboard/tasks/clan/:clanId" element={<TaskManagementPage role="admin" />} />
          <Route path="/dashboard/members" element={<MembersPage />} />
          <Route path="/dashboard/events" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard/gallery" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard/settings" element={<SettingsPage />} />
        </Route>
      </Route>

      {/* Redirects & 404 */}
      <Route path="/account" element={<Navigate to="/dashboard" replace />} />
      <Route path="/admin" element={<Navigate to="/dashboard" replace />} />
      <Route path="/member" element={<Navigate to="/user/dashboard" replace />} />
      <Route path="/root/user" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
