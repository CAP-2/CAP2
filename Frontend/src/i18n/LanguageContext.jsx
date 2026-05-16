import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { additionalTranslations } from "./staticTranslations";

const STORAGE_KEY = "app_language";

const dictionary = new Map(
  [
    ["Tổng quan", "Overview"],
    ["Phả hệ dòng họ", "Family genealogy"],
    ["Gia phả dòng họ", "Family tree"],
    ["Sự kiện dòng họ", "Family events"],
    ["Bảng tin dòng họ", "Family news"],
    ["Kỉ niệm dòng họ", "Family memories"],
    ["Kỷ niệm dòng họ", "Family memories"],
    ["Thành viên dòng họ", "Family members"],
    ["Duyệt chờ", "Pending approvals"],
    ["Quỹ dòng họ", "Family fund"],
    ["Lịch Việt Nam", "Vietnam calendar"],
    ["Gói sử dụng", "Subscription"],
    ["Hồ sơ cá nhân", "Profile"],
    ["Quản lý phả hệ", "Genealogy management"],
    ["Quản lý Tài khoản", "Account management"],
    ["Quản lý bài viết", "Post management"],
    ["Quản lý sự kiện", "Event management"],
    ["Cài đặt Hệ thống", "System settings"],
    ["Thông báo", "Notifications"],
    ["Thông báo mới", "New notification"],
    ["Chưa có thông báo.", "No notifications."],
    ["Đang tải...", "Loading..."],
    ["Đã đọc hết", "Mark all read"],
    ["Sửa tài khoản", "Edit account"],
    ["Chỉnh sửa thông tin cá nhân", "Edit profile"],
    ["Đăng xuất", "Log out"],
    ["Rời hệ thống", "Log out"],
    ["Thu gọn menu", "Collapse menu"],
    ["Mở menu", "Open menu"],
    ["Thu gọn", "Collapse"],
    ["Mở rộng", "Expand"],
    ["Hỗ trợ", "Help"],
    ["Phiên làm việc", "Session"],
    ["Hệ thống quản trị Gia Phả", "Gia Pha administration"],
    ["Hệ thống Quản trị Gia Phả Việt", "Gia Pha Viet administration"],
    ["Quản trị viên dòng họ", "Clan manager"],
    ["Quản trị viên hệ thống", "System administrator"],
    ["Thành viên dòng họ", "Family member"],
    ["Chào mừng", "Welcome"],
    ["Xin chào", "Hello"],
    ["Về chúng tôi", "About us"],
    ["Tính năng", "Features"],
    ["Lợi ích", "Benefits"],
    ["Tin tức", "News"],
    ["Hướng dẫn", "Guide"],
    ["Đăng ký", "Register"],
    ["Đăng nhập", "Log in"],
    ["Tìm người", "Search people"],
    ["Tìm tôi", "Find me"],
    ["Kiểm tra cây", "Validate tree"],
    ["Toàn bộ cây", "Full tree"],
    ["Làm gốc", "Root person"],
    ["Nhập tên để chọn", "Type a name to choose"],
    ["Tên, đời, ngày sinh, năm sinh", "Name, generation, birth date, year"],
    ["Đời", "Generation"],
    ["Gia phả", "Family tree"],
    ["Lỗi dữ liệu trong cây", "Tree data issues"],
    ["node cần sửa", "nodes need fixes"],
    ["Thiếu tên", "Missing name"],
    ["Thiếu hoặc sai giới tính", "Missing or invalid gender"],
    ["Chưa liên kết tài khoản", "Account not linked"],
    ["Con sinh trước cha/mẹ", "Child born before parent"],
    ["Trùng quan hệ cha/mẹ - con", "Duplicate parent-child relation"],
    ["Có vòng lặp quan hệ", "Relationship cycle detected"],
    ["Đang sửa", "Editing"],
    ["Online", "Online"],
    ["Kết quả tìm", "Search result"],
    ["Tôi", "Me"],
    ["Lưu", "Save"],
    ["Xóa", "Delete"],
    ["Hủy", "Cancel"],
    ["Đóng", "Close"],
    ["Tải lại", "Reload"],
    ["Thêm người", "Add person"],
    ["Tự sắp xếp", "Auto layout"],
    ["Xuất PNG", "Export PNG"],
    ["Email đăng nhập", "Login email"],
    ["Mật khẩu", "Password"],
    ["Mật khẩu mới", "New password"],
    ["Mật khẩu mới nếu cần đổi", "New password if needed"],
    ["Mật khẩu xác nhận không khớp.", "Password confirmation does not match."],
    ["Quên mật khẩu?", "Forgot password?"],
    ["Nhận mã 6 số qua email đã đăng ký", "Receive a 6-digit code via registered email"],
    ["Chào mừng đến với Gia Phả Việt!", "Welcome to Gia Pha Viet!"],
    ["Hãy đăng nhập để tiếp tục", "Please log in to continue"],
    ["Chưa có tài khoản?", "Don't have an account?"],
    ["Tạo tài khoản", "Create account"],
    ["Đã có tài khoản?", "Already have an account?"],
    ["Họ", "Last name"],
    ["Tên đệm", "Middle name"],
    ["Tên", "First name"],
    ["Họ và tên", "Full name"],
    ["Ngày sinh", "Birth date"],
    ["Ngày mất", "Death date"],
    ["Ngày sinh âm lịch", "Lunar birth date"],
    ["Ngày mất âm lịch", "Lunar death date"],
    ["Giới tính", "Gender"],
    ["Nam", "Male"],
    ["Nữ", "Female"],
    ["Không rõ", "Unknown"],
    ["Còn sống", "Living"],
    ["Đã mất", "Deceased"],
    ["Quê quán", "Hometown"],
    ["Địa chỉ", "Address"],
    ["Điện thoại", "Phone"],
    ["Email phụ", "Secondary email"],
    ["Tiểu sử", "Biography"],
    ["Ghi chú", "Note"],
    ["Ảnh đại diện", "Avatar"],
    ["URL ảnh đại diện", "Avatar URL"],
    ["Vai trò", "Role"],
    ["Trạng thái", "Status"],
    ["Thao tác", "Actions"],
    ["Tải lại", "Reload"],
    ["Làm mới", "Refresh"],
    ["Tìm kiếm", "Search"],
    ["Tất cả", "All"],
    ["Đã duyệt", "Approved"],
    ["Chờ duyệt", "Pending"],
    ["Từ chối", "Reject"],
    ["Phê duyệt", "Approve"],
    ["Đang chờ duyệt", "Pending approval"],
    ["Đang gửi...", "Submitting..."],
    ["Đang lưu...", "Saving..."],
    ["Đang kiểm tra...", "Checking..."],
    ["Không có dữ liệu", "No data"],
    ["Chưa có dữ liệu", "No data yet"],
    ["Không có", "None"],
    ["Chưa có", "Not set"],
    ["Xem chi tiết", "View details"],
    ["Chi tiết", "Details"],
    ["Tạo mới", "Create new"],
    ["Cập nhật", "Update"],
    ["Cập nhật thông tin", "Update information"],
    ["Thông tin cá nhân", "Personal information"],
    ["Hồ sơ người dùng", "User profile"],
    ["Đổi mật khẩu", "Change password"],
    ["Mật khẩu hiện tại", "Current password"],
    ["Xác nhận mật khẩu", "Confirm password"],
    ["Gửi yêu cầu", "Submit request"],
    ["Gửi duyệt", "Submit for review"],
    ["Đang có yêu cầu cập nhật hồ sơ chờ duyệt.", "There is a pending profile update request."],
    ["Trang chủ", "Home"],
    ["Banner chính", "Main banner"],
    ["Giới thiệu", "Introduction"],
    ["Thống kê", "Statistics"],
    ["Chi tiết tính năng", "Feature details"],
    ["Chi tiết lợi ích", "Benefit details"],
    ["Trang hướng dẫn", "Guide page"],
    ["Trang chi tiết tin tức", "News details"],
    ["Không tìm thấy trang", "Page not found"],
    ["Quay lại trang chủ", "Back to home"],
    ["Đăng ký gia tộc", "Register clan"],
    ["Thông tin dòng họ", "Clan information"],
    ["Tên dòng họ", "Clan name"],
    ["Lịch sử dòng họ", "Clan history"],
    ["Nhà thờ / từ đường", "Ancestral hall"],
    ["Địa chỉ nhà thờ", "Ancestral hall address"],
    ["Cây gia phả", "Family tree"],
    ["Xem toàn bộ cây", "View full tree"],
    ["Chọn người làm gốc", "Choose root person"],
    ["Quay lại full tree", "Back to full tree"],
    ["Thu gọn nhánh con", "Collapse child branch"],
    ["Mở nhánh con", "Expand child branch"],
    ["Thành viên", "Member"],
    ["Tổng thành viên", "Total members"],
    ["Danh sách thành viên", "Member list"],
    ["Tạo thành viên", "Create member"],
    ["Thêm tài khoản và hồ sơ thành viên mới.", "Add a new member account and profile."],
    ["Quản lý nhân sự dòng họ", "Clan personnel management"],
    ["Liên kết quan hệ", "Link relationships"],
    ["Cập nhật cha, mẹ, vợ/chồng và con cái.", "Update father, mother, spouse and children."],
    ["Thành viên cần liên kết", "Member to link"],
    ["Gia đình/cuộc hôn nhân", "Family/marriage"],
    ["Cha", "Father"],
    ["Mẹ", "Mother"],
    ["Vợ/chồng", "Spouse"],
    ["Con cái", "Children"],
    ["Quan hệ hiện tại", "Current relationships"],
    ["Đời / chi", "Generation / branch"],
    ["Chi", "Branch"],
    ["Tộc trưởng", "Clan chief"],
    ["Tổng tiền trong quỹ", "Total fund balance"],
    ["Nhiệm vụ active", "Active tasks"],
    ["Công việc", "Tasks"],
    ["Giao việc", "Assign task"],
    ["Hoàn thành", "Complete"],
    ["Đã hoàn thành", "Completed"],
    ["Đang thực hiện", "In progress"],
    ["Hạn hoàn thành", "Due date"],
    ["Nội dung", "Content"],
    ["Nội dung bài viết", "Post content"],
    ["Tiêu đề", "Title"],
    ["Tiêu đề / mô tả ngắn", "Title / short description"],
    ["Tạo bài đăng", "Create post"],
    ["Bài của thành viên sẽ hiển thị sau khi quản lý duyệt.", "Member posts appear after manager approval."],
    ["Loại bài đăng", "Post type"],
    ["Bài viết", "Post"],
    ["Ảnh / video", "Photo / video"],
    ["Tải ảnh hoặc video bài đăng", "Upload post photo or video"],
    ["Bạn muốn chia sẻ điều gì với dòng họ?", "What would you like to share with the clan?"],
    ["Đăng bài", "Publish post"],
    ["Thích", "Like"],
    ["Bình luận", "Comment"],
    ["Viết bình luận...", "Write a comment..."],
    ["lượt thích", "likes"],
    ["bình luận", "comments"],
    ["Bảng tin", "News feed"],
    ["Các bài viết đã duyệt sẽ hiển thị cho thành viên trong dòng họ.", "Approved posts are visible to clan members."],
    ["Kỉ niệm đã lưu", "Saved memories"],
    ["Kỷ niệm đã lưu", "Saved memories"],
    ["Đăng kỉ niệm", "Post memory"],
    ["Đăng kỷ niệm", "Post memory"],
    ["Kỉ niệm của trưởng họ được đăng ngay.", "Clan manager memories are published immediately."],
    ["Kỉ niệm của thành viên sẽ gửi vào hàng chờ duyệt.", "Member memories are sent to the approval queue."],
    ["Ảnh • Video • Ghi âm", "Photo • Video • Audio"],
    ["Tải tệp từ máy", "Upload file"],
    ["Đang tải lên...", "Uploading..."],
    ["Chụp ảnh", "Take photo"],
    ["Quay video", "Record video"],
    ["Ghi âm trực tiếp", "Record audio"],
    ["Dừng ghi âm", "Stop recording"],
    ["Chụp ảnh này", "Capture this photo"],
    ["Bắt đầu quay", "Start recording"],
    ["Dừng quay video", "Stop video recording"],
    ["Đóng camera", "Close camera"],
    ["Xóa tệp", "Remove file"],
    ["Xóa form", "Clear form"],
    ["Gửi kỉ niệm", "Submit memory"],
    ["Gửi kỷ niệm", "Submit memory"],
    ["Kỉ niệm đã duyệt", "Approved memories"],
    ["Kỷ niệm đã duyệt", "Approved memories"],
    ["Có tệp đính kèm", "Has attachments"],
    ["Quỹ", "Fund"],
    ["Khoản thu", "Income"],
    ["Khoản chi", "Expense"],
    ["Thu", "Income"],
    ["Chi", "Expense"],
    ["Số tiền", "Amount"],
    ["Ngày", "Date"],
    ["Hình thức", "Method"],
    ["Hạng mục", "Category"],
    ["Người nộp", "Payer"],
    ["Người nhận", "Recipient"],
    ["Minh chứng", "Proof"],
    ["Danh Sách Chờ Duyệt", "Pending approval list"],
    ["giao dịch đang chờ phê duyệt", "transactions pending approval"],
    ["Ghi chú người nhận", "Recipient note"],
    ["Phản hồi của quản lý", "Manager feedback"],
    ["Gói hiện tại", "Current plan"],
    ["Thanh toán", "Payment"],
    ["Tài khoản nhận", "Receiving account"],
    ["Chưa cấu hình", "Not configured"],
    ["Lịch âm", "Lunar calendar"],
    ["Lịch dương", "Solar calendar"],
    ["Âm lịch", "Lunar date"],
    ["Hôm nay", "Today"],
    ["Tháng", "Month"],
    ["Năm", "Year"],
    ["Quản lý thành viên", "Member management"],
    ["Quản lý tài khoản", "Account management"],
    ["Thêm tài khoản đăng nhập", "Add login account"],
    ["Cập nhật thông tin, vai trò và dòng họ.", "Update information, role and clan."],
    ["Tạo tài khoản mới và gán vào dòng họ.", "Create a new account and assign it to a clan."],
    ["Mật khẩu mới (bỏ trống nếu không đổi)", "New password (leave blank to keep current)"],
    ["Dòng họ", "Clan"],
    ["Cài đặt hệ thống", "System settings"],
    ["Dashboard", "Dashboard"],
    ...additionalTranslations,
  ].sort((a, b) => b[0].length - a[0].length),
);

const LanguageContext = createContext(null);
const originalText = new WeakMap();
const TRANSLATION_DELAY_MS = 150;
const SKIPPED_TRANSLATION_TAGS = new Set(["SCRIPT", "STYLE", "INPUT", "TEXTAREA", "SELECT", "OPTION", "CODE", "PRE"]);
const WORD_CHARS = "\\p{L}\\p{N}_";
const reverseDictionary = new Map(
  Array.from(dictionary.entries())
    .map(([vi, en]) => [en, vi])
    .filter(([en, vi]) => en && vi && en !== vi)
    .sort((a, b) => b[0].length - a[0].length),
);

function escapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isWordChar(char) {
  return Boolean(char && new RegExp(`[${WORD_CHARS}]`, "u").test(char));
}

function replacePhrase(text, source, target) {
  if (!source || source === target) return text;
  const startsWithWord = isWordChar(source[0]);
  const endsWithWord = isWordChar(source[source.length - 1]);
  const pattern = `${startsWithWord ? `(^|[^${WORD_CHARS}])` : ""}${escapeRegExp(source)}${endsWithWord ? `(?![${WORD_CHARS}])` : ""}`;
  const regex = new RegExp(pattern, "gu");
  return text.replace(regex, (...args) => `${startsWithWord ? args[1] || "" : ""}${target}`);
}

function translateText(text) {
  if (!text || !text.trim()) return text;
  let translated = text;
  dictionary.forEach((en, vi) => {
    translated = replacePhrase(translated, vi, en);
  });
  translated = translated.replace(/(\d+)\s+chưa đọc/g, "$1 unread");
  translated = translated.replace(/Còn\s+(\d+)\s+lỗi khác/g, "$1 more issues");
  translated = translated.replace(/Hôm nay có\s+(\d+)\s+yêu cầu cần xử lý từ dữ liệu\s+trong hệ thống\./g, "Today has $1 requests to process from system data.");
  translated = translated.replace(/(\d+)\s+việc đang mở/g, "$1 open tasks");
  translated = translated.replace(/(\d+)\s+tổng việc/g, "$1 total tasks");
  translated = translated.replace(/(\d+)\s+thành viên/g, "$1 members");
  translated = translated.replace(/(\d+)\s+gia đình/g, "$1 families");
  translated = translated.replace(/(\d+)\s+công việc/g, "$1 tasks");
  translated = translated.replace(/(\d+)\s+việc/g, "$1 tasks");
  translated = translated.replace(/(\d+)\s+gợi ý/g, "$1 suggestions");
  translated = translated.replace(/(\d+)\s+đang mở/g, "$1 open");
  translated = translated.replace(/(\d+)\s+hoàn thành/g, "$1 completed");
  translated = translated.replace(/Đời\s+(\d+)/g, "Generation $1");
  translated = translated.replace(/Sinh:/g, "Born:");
  translated = translated.replace(/Mất:/g, "Died:");
  return translated;
}

function translateToVietnamese(text) {
  if (!text || !text.trim()) return text;
  let translated = text;
  reverseDictionary.forEach((vi, en) => {
    translated = replacePhrase(translated, en, vi);
  });
  translated = translated.replace(/(\d+)\s+unread/g, "$1 chưa đọc");
  translated = translated.replace(/(\d+)\s+more issues/g, "Còn $1 lỗi khác");
  translated = translated.replace(/Today has\s+(\d+)\s+requests to process from system data\./g, "Hôm nay có $1 yêu cầu cần xử lý từ dữ liệu trong hệ thống.");
  translated = translated.replace(/(\d+)\s+total tasks/g, "$1 tổng việc");
  translated = translated.replace(/(\d+)\s+open tasks/g, "$1 việc đang mở");
  translated = translated.replace(/(\d+)\s+members/g, "$1 thành viên");
  translated = translated.replace(/(\d+)\s+families/g, "$1 gia đình");
  translated = translated.replace(/(\d+)\s+tasks/g, "$1 công việc");
  translated = translated.replace(/(\d+)\s+suggestions/g, "$1 gợi ý");
  translated = translated.replace(/(\d+)\s+open/g, "$1 đang mở");
  translated = translated.replace(/(\d+)\s+completed/g, "$1 hoàn thành");
  translated = translated.replace(/Generation\s+(\d+)/g, "Đời $1");
  translated = translated.replace(/Born:/g, "Sinh:");
  translated = translated.replace(/Died:/g, "Mất:");
  return translated;
}

export function translateByLanguage(
  text,
  language = typeof localStorage === "undefined" ? "vi" : localStorage.getItem(STORAGE_KEY) || "vi",
) {
  return language === "en" ? translateText(text) : translateToVietnamese(text);
}

function setDocumentLanguage(language) {
  if (typeof document === "undefined") return;
  document.documentElement.lang = language;
  document.documentElement.dataset.lang = language;
}

function shouldSkipElement(element) {
  return SKIPPED_TRANSLATION_TAGS.has(element.tagName) || element.closest("[data-no-translate='true']");
}

function shouldTranslateTextNode(node) {
  if (!node.nodeValue || !node.nodeValue.trim()) return false;
  const parent = node.parentElement;
  return Boolean(parent) && !shouldSkipElement(parent);
}

function collectTextNodes(node, textNodes = []) {
  if (!node) return textNodes;

  if (node.nodeType === Node.TEXT_NODE) {
    if (shouldTranslateTextNode(node)) textNodes.push(node);
    return textNodes;
  }

  if (node.nodeType !== Node.ELEMENT_NODE && node.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) {
    return textNodes;
  }

  if (node.nodeType === Node.ELEMENT_NODE && shouldSkipElement(node)) {
    return textNodes;
  }

  node.childNodes.forEach((child) => collectTextNodes(child, textNodes));
  return textNodes;
}

function getOriginalText(node) {
  const current = node.nodeValue;
  if (!originalText.has(node)) {
    originalText.set(node, current);
    return current;
  }

  const previous = originalText.get(node);
  const expectedEnglish = translateText(previous);
  if (current !== previous && current !== expectedEnglish) {
    originalText.set(node, current);
    return current;
  }

  return previous;
}

function translateDocumentText(language) {
  if (typeof document === "undefined") return;
  setDocumentLanguage(language);

  const root = document.getElementById("root");
  if (!root) return;

  collectTextNodes(root).forEach((node) => {
    const original = getOriginalText(node);
    const nextValue = language === "en" ? translateText(original) : original;
    if (node.nodeValue !== nextValue) node.nodeValue = nextValue;
  });
}

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState(() => localStorage.getItem(STORAGE_KEY) || "vi");
  const { pathname } = useLocation();

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, language);
    setDocumentLanguage(language);

    const timer = window.setTimeout(() => {
      translateDocumentText(language);
    }, TRANSLATION_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [language, pathname]);

  const value = useMemo(() => ({
    language,
    setLanguage,
    toggleLanguage: () => setLanguage((current) => (current === "vi" ? "en" : "vi")),
    t: (text) => translateByLanguage(text, language),
  }), [language]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    return { language: "vi", setLanguage: () => {}, toggleLanguage: () => {}, t: (text) => text };
  }
  return context;
}
