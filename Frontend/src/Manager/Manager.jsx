import { useEffect, useState } from "react";
import "./manager.css";
import { getPendingUsers, approveUserAPI } from "../api/managerService";
const Manager = () => {
  const [users, setUsers] = useState([]);

  const loadData = async () => {
    const data = await getPendingUsers();
    setUsers(data);
  };

  const approve = async (id) => {
    await approveUserAPI(id);
    loadData();
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div>
      <h2>Manager</h2>

      {users.map((u) => (
        <div key={u.user_id}>
          {u.email}
          <button onClick={() => approve(u.user_id)}>Duyệt</button>
        </div>
      ))}
    </div>
  );
};

export default Manager;