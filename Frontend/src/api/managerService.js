import { apiRequest } from "../services/api";

const BASE_URL = "/api/manager";

const asArray = (value) => (Array.isArray(value) ? value : []);

const request = async (endpoint, options = {}, fallbackError = "Yêu cầu API thất bại") => {
  try {
    return await apiRequest(`${BASE_URL}${endpoint}`, options);
  } catch (error) {
    throw new Error(error?.message || fallbackError);
  }
};

export const getStats = () => request("/stats", {}, "Không thể lấy thống kê manager");

export const getManagerTree = (clanId) => {
  const query = clanId ? `?clan_id=${encodeURIComponent(clanId)}` : "";
  return request(`/tree${query}`, {}, "Không thể lấy cây gia phả");
};

export const getMembers = () => request("/members", {}, "Không thể lấy danh sách thành viên");

export const createMember = (payload) =>
  request(
    "/members",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    "Không thể tạo thành viên"
  );

export const getMemberRelations = (accountId) =>
  request(`/members/${accountId}/relations`, {}, "Không thể lấy quan hệ thành viên");

export const updateMemberRelations = (accountId, body) =>
  request(
    `/members/${accountId}/relations`,
    {
      method: "PUT",
      body: JSON.stringify(body),
    },
    "Không thể lưu quan hệ"
  );

export const getMemberDetail = (accountId) =>
  request(`/members/${accountId}`, {}, "Không thể lấy chi tiết thành viên");

export const updateMemberByManager = (accountId, body) =>
  request(
    `/members/${accountId}`,
    {
      method: "PUT",
      body: JSON.stringify(body),
    },
    "Không thể cập nhật thành viên"
  );

export const archiveMemberAPI = (accountId, reason) =>
  request(
    `/members/${accountId}/archive`,
    {
      method: "POST",
      body: JSON.stringify({ reason }),
    },
    "Không thể lưu trữ thành viên"
  );

export const getArchivedMembersAPI = () =>
  request("/members-archive", {}, "Không thể lấy kho lưu trữ thành viên");

export const deleteArchivedMemberAPI = (archiveId) =>
  request(
    `/members-archive/${archiveId}`,
    {
      method: "DELETE",
    },
    "Không thể xóa vĩnh viễn bản ghi lưu trữ"
  );

export const restoreArchivedMemberAPI = (archiveId) =>
  request(
    `/members-archive/${archiveId}/restore`,
    {
      method: "POST",
    },
    "Không thể phục hồi thành viên"
  );

export const getPendingUsers = () => request("/pending", {}, "Không thể lấy người dùng chờ duyệt");

export const approveUserAPI = (id) =>
  request(
    `/approve/${id}`,
    {
      method: "POST",
    },
    "Duyệt người dùng thất bại"
  );

export const rejectUserAPI = (id) =>
  request(
    `/reject/${id}`,
    {
      method: "POST",
    },
    "Từ chối người dùng thất bại"
  );

export const getPendingPosts = () =>
  request("/pending-posts", {}, "Không thể lấy bài viết chờ duyệt");

export const approvePostAPI = (id) =>
  request(
    `/approve-post/${id}`,
    {
      method: "POST",
    },
    "Phê duyệt bài viết thất bại"
  );

export const rejectPostAPI = (id, reason) =>
  request(
    `/reject-post/${id}`,
    {
      method: "POST",
      body: JSON.stringify({ reason }),
    },
    "Từ chối bài viết thất bại"
  );

export const getMediaAPI = () => request("/media", {}, "Không thể lấy dữ liệu thư viện");

export const getPendingReviewData = async () => {
  const [users, posts, profiles] = await Promise.all([
    getPendingUsers(),
    getPendingPosts(),
    getPendingProfileUpdates(),
  ]);

  const pendingUsers = asArray(users);
  const pendingPosts = asArray(posts);
  const pendingProfiles = asArray(profiles);

  return {
    pendingUsers,
    pendingPosts,
    pendingProfiles,
    totalPending: pendingUsers.length + pendingPosts.length + pendingProfiles.length,
  };
};

export const getDashboardData = async () => {
  const [stats, pending, tasks] = await Promise.all([
    getStats(),
    getPendingReviewData(),
    getTasksAPI().catch(() => []),
  ]);

  return {
    stats: stats || {},
    ...pending,
    tasks: asArray(tasks),
  };
};

export const getMediaLibraryData = async () => asArray(await getMediaAPI());

export const createPersonAPI = (data) =>
  request(
    "/people/create",
    {
      method: "POST",
      body: JSON.stringify(data),
    },
    "Tạo người trong gia phả thất bại"
  );

export const linkRelationsAPI = (data) =>
  request(
    "/people/link",
    {
      method: "PATCH",
      body: JSON.stringify(data),
    },
    "Liên kết quan hệ thất bại"
  );

export const assignTaskAPI = (data) =>
  request(
    "/assign-task",
    {
      method: "POST",
      body: JSON.stringify(data),
    },
    "Giao việc thất bại"
  );

export const getTasksAPI = () => request("/tasks", {}, "Lấy danh sách việc thất bại");

export const completeTaskAPI = (assignmentId) =>
  request(
    `/tasks/${assignmentId}/complete`,
    {
      method: "PATCH",
    },
    "Cập nhật trạng thái công việc thất bại"
  );

export const getPendingProfileUpdates = () =>
  request("/pending-profiles", {}, "Không thể lấy danh sách cập nhật hồ sơ");

export const approveProfileUpdateAPI = (id) =>
  request(
    `/approve-profile/${id}`,
    {
      method: "POST",
    },
    "Phê duyệt hồ sơ thất bại"
  );

export const rejectProfileUpdateAPI = (id, reason) =>
  request(
    `/reject-profile/${id}`,
    {
      method: "POST",
      body: JSON.stringify({ reason }),
    },
    "Từ chối hồ sơ thất bại"
  );
