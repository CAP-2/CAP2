import { io } from "socket.io-client";

let socket = null;

export function connectSocket(accountId, token) {
  if (!accountId || !token) {
    console.warn("Missing accountId or token. Socket not connected.");
    return null;
  }

  if (socket?.connected) {
    return socket;
    }

    if (socket) {
    socket.disconnect();
    socket = null;
    window.socket = null;
    }

    socket = io(import.meta.env.VITE_SOCKET_URL || "http://localhost:3000", {
        auth: {
            token,
        },
        transports: ["polling"],
        upgrade: false,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        });

  socket = io(import.meta.env.VITE_SOCKET_URL || "http://localhost:3000", {
    auth: {
        token,
    },
    transports: ["polling"],
    upgrade: false,
    });

  // Tạm gắn vào window để test trong Console
  window.socket = socket;

  socket.on("connect", () => {
    console.log("Socket connected:", socket.id);

    socket.emit("register_user", accountId);
    console.log("Registered socket for account:", accountId);
  });

  socket.on("connect_error", (error) => {
    console.error("Socket connection error:", error.message);
  });

  socket.on("disconnect", () => {
    console.log("Socket disconnected");
  });

  return socket;
}

export function getSocket() {
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
    window.socket = null;
  }
}

export function connectSocketFromStorage() {
  const token =
    localStorage.getItem("auth_token") ||
    localStorage.getItem("token");

  const rawUser =
    localStorage.getItem("auth_user") ||
    localStorage.getItem("user");

  if (!token || !rawUser) {
    console.warn("No auth data in localStorage. Socket not connected.");
    return null;
  }

  try {
    const user = JSON.parse(rawUser);

    const accountId =
      user?.account_id ||
      user?.id ||
      user?.accountId;

    if (!accountId) {
      console.warn("Cannot find account id in auth_user:", user);
      return null;
    }

    return connectSocket(accountId, token);
  } catch (error) {
    console.error("Cannot parse auth_user from localStorage:", error);
    return null;
  }
}