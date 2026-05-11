import { apiRequest } from "../services/api";
import { getTreeEditKeyHeader } from "../services/treeEditSession";

const BASE_URL = "/api/manager";

const asArray = (value) => (Array.isArray(value) ? value : []);

const request = async (endpoint, options = {}, fallbackError = "Yêu cầu API thất bại") => {
  try {
    return await apiRequest(`${BASE_URL}${endpoint}`, options);
  } catch (error) {
    const normalizedError = new Error(error?.message || fallbackError);

    normalizedError.code =
      error?.code ||
      error?.data?.code ||
      error?.response?.data?.code ||
      null;

    normalizedError.data =
      error?.data ||
      error?.response?.data ||
      null;

    normalizedError.status =
      error?.status ||
      error?.response?.status ||
      null;

    normalizedError.billing =
      error?.billing ||
      error?.data?.billing ||
      error?.response?.data?.billing ||
      null;

    throw normalizedError;
  }
};

export const getStats = () => request("/stats", {}, "Không thể lấy thống kê manager");

export const getManagerTree = (clanId) => {
  const query = clanId ? `?clan_id=${encodeURIComponent(clanId)}` : "";
  return request(`/tree${query}`, {}, "Không thể lấy cây gia phả");
};

export const getMembers = () => request("/members", {}, "Không thể lấy danh sách thành viên");

export const getManagerClanInfo = () =>
  request("/clan-info", {}, "Không thể lấy thông tin dòng họ");

export const updateManagerClanInfo = (payload) =>
  request(
    "/clan-info",
    {
      method: "PUT",
      body: JSON.stringify(payload),
    },
    "Không thể cập nhật thông tin dòng họ"
  );

export const getActiveTreeEditKeysAPI = (clanId) => {
  const query = clanId ? `?clan_id=${encodeURIComponent(clanId)}` : "";
  return request(`/tree-edit-keys${query}`, {}, "Không thể lấy danh sách temporary edit key");
};

export const createTreeEditKeyAPI = (memberAccountIds) => {
  const ids = Array.isArray(memberAccountIds) ? memberAccountIds : [memberAccountIds];

  const uniqueIds = [
    ...new Set(
      ids
        .map((id) => Number(id))
        .filter((id) => Number.isFinite(id) && id > 0)
    ),
  ];

  return request(
    "/tree-edit-keys",
    {
      method: "POST",
      headers: getTreeEditKeyHeader(),
      body: JSON.stringify(
        uniqueIds.length === 1
          ? { member_account_id: uniqueIds[0], member_account_ids: uniqueIds }
          : { member_account_ids: uniqueIds }
      ),
    },
    "Không thể tạo temporary edit key"
  );
};

export const getFundOverviewAPI = () =>
  request("/fund/overview", {}, "Không thể lấy tổng quan quỹ");

export const getFundStatsAPI = () =>
  request("/fund/stats", {}, "Không thể lấy thống kê quỹ dòng họ");

export const getFundTransactionsAPI = () =>
  request("/fund/transactions", {}, "Không thể lấy lịch sử giao dịch quỹ");

export const addFundIncomeAPI = (payload) =>
  request(
    "/fund/income",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    "Không thể thêm khoản thu"
  );

export const addFundExpenseAPI = (payload) =>
  request(
    "/fund/expense",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    "Không thể thêm khoản chi"
  );

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

export const getPendingUsers = () =>
  request("/pending", {}, "Không thể lấy người dùng chờ duyệt");

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

export const getMediaAPI = () =>
  request("/media", {}, "Không thể lấy dữ liệu thư viện");

export const getPendingReviewData = async () => {
  const [users, posts, profiles, memories] = await Promise.all([
    getPendingUsers(),
    getPendingPosts(),
    getPendingProfileUpdates(),
    getPendingMemories().catch(() => ({ memories: [] })),
  ]);

  const pendingUsers = asArray(users);
  const pendingPosts = asArray(posts);
  const pendingProfiles = asArray(profiles);
  const pendingMemories = asArray(memories?.memories || memories);

  return {
    pendingUsers,
    pendingPosts,
    pendingProfiles,
    pendingMemories,
    totalPending: pendingUsers.length + pendingPosts.length + pendingProfiles.length + pendingMemories.length,
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
    "/people",
    {
      method: "POST",
      headers: getTreeEditKeyHeader(),
      body: JSON.stringify(data),
    },
    "Tạo người trong gia phả thất bại"
  );

export const linkRelationsAPI = (data) =>
  request(
    "/people/link",
    {
      method: "PATCH",
      headers: getTreeEditKeyHeader(),
      body: JSON.stringify(data),
    },
    "Liên kết quan hệ thất bại"
  );

export const updatePersonAPI = (personId, data) =>
  request(
    `/people/${personId}`,
    {
      method: "PATCH",
      headers: getTreeEditKeyHeader(),
      body: JSON.stringify(data),
    },
    "Không thể cập nhật người trong gia phả"
  );

export const updatePersonPositionAPI = (personId, data) =>
  request(
    `/people/${personId}/position`,
    {
      method: "PATCH",
      headers: getTreeEditKeyHeader(),
      body: JSON.stringify(data),
    },
    "Không thể lưu vị trí"
  );

export const saveTreeLayoutAPI = (people = [], clanId, options = {}) =>
  request(
    clanId ? `/clans/${clanId}/family-tree/layout` : "/people/layout",
    {
      method: "PATCH",
      headers: getTreeEditKeyHeader(),
      body: JSON.stringify({
        people,
        positions: people,
        clan_id: clanId,
        line_routes: options.lineRoutes || options.line_routes,
        card_sizes: options.cardSizes || options.card_sizes,
      }),
    },
    "Không thể lưu bố cục cây"
  );

export const deletePersonAPI = (personId) =>
  request(
    `/people/${personId}`,
    {
      method: "DELETE",
      headers: getTreeEditKeyHeader(),
    },
    "Không thể xóa người khỏi gia phả"
  );

export const createFamilyAPI = (data) =>
  request(
    "/families",
    {
      method: "POST",
      headers: getTreeEditKeyHeader(),
      body: JSON.stringify(data),
    },
    "Không thể tạo family"
  );

export const addFamilyChildAPI = (familyId, data) =>
  request(
    `/families/${familyId}/children`,
    {
      method: "POST",
      headers: getTreeEditKeyHeader(),
      body: JSON.stringify(data),
    },
    "Không thể thêm con vào family"
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
  
export const bulkAssignTasksAPI = (data) =>
  request(
    "/tasks/bulk-assign",
    {
      method: "POST",
      body: JSON.stringify(data),
    },
    "Giao nhiều công việc thất bại"
  );

export const getTasksAPI = (params = {}) => {
  const query = new URLSearchParams();

  if (params.event_id) query.set("event_id", params.event_id);
  if (params.clan_id) query.set("clan_id", params.clan_id);

  const suffix = query.toString() ? `?${query.toString()}` : "";

  return request(`/tasks${suffix}`, {}, "Lấy danh sách việc thất bại");
};

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

export const getManagerEventsAPI = (params = {}) => {
  const query = new URLSearchParams();

  if (params.clan_id) query.set("clan_id", params.clan_id);

  const suffix = query.toString() ? `?${query.toString()}` : "";

  return request(`/events${suffix}`, {}, "Lấy danh sách sự kiện thất bại");
};

export const createManagerEventAPI = (data) =>
  request(
    "/events",
    {
      method: "POST",
      body: JSON.stringify(data),
    },
    "Tạo sự kiện thất bại"
  );

export const createEventTaskAPI = (eventId, data) =>
  request(
    `/events/${eventId}/tasks`,
    {
      method: "POST",
      body: JSON.stringify(data),
    },
    "Tạo công việc trong sự kiện thất bại"
  );

export const updateManagerEventAPI = (eventId, data) =>
  request(
    `/events/${eventId}`,
    {
      method: "PUT",
      body: JSON.stringify(data),
    },
    "Cập nhật sự kiện thất bại"
  );

export const deleteManagerEventAPI = (eventId, params = {}) => {
  const query = new URLSearchParams();

  if (params.clan_id) query.set("clan_id", params.clan_id);

  const suffix = query.toString() ? `?${query.toString()}` : "";

  return request(
    `/events/${eventId}${suffix}`,
    {
      method: "DELETE",
    },
    "Xóa sự kiện thất bại"
  );
};
export const getPendingMemories = () =>
  request("/pending-memories", {}, "Không thể lấy kỉ niệm chờ duyệt");

export const approveMemoryAPI = (id) =>
  request(
    `/approve-memory/${id}`,
    { method: "POST" },
    "Phê duyệt kỉ niệm thất bại"
  );

export const rejectMemoryAPI = (id, reason) =>
  request(
    `/reject-memory/${id}`,
    {
      method: "POST",
      body: JSON.stringify({ reason }),
    },
    "Từ chối kỉ niệm thất bại"
  );


