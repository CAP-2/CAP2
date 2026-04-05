import { io } from "socket.io-client";

// URL này phải khớp với địa chỉ và cổng của Backend (thường là 3000)
const URL = "http://localhost:3000"; 

export const socket = io(URL, {
    autoConnect: true, // Tự động kết nối khi ứng dụng chạy
    withCredentials: true
});