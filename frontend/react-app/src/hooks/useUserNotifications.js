import { useEffect, useState, useCallback } from "react";
import { USER_API } from "../api/user";

export const useUserNotifications = (options = {}) => {
  const {
    onlyUnread = false,
    limit = 50,
    enabled = true,        // 👈 new flag
  } = options;

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!enabled) return;  // ⬅️ don't fetch if disabled

    setLoading(true);
    try {
      const res = await USER_API.fetchNotifications({ onlyUnread, limit });
      setNotifications(res.data || []);
      setUnreadCount(res.unread || 0);
      setTotal(res.total || 0);
    } catch (err) {
      console.error("Failed to fetch notifications", err);
    } finally {
      setLoading(false);
    }
  }, [onlyUnread, limit, enabled]);

  useEffect(() => {
    load();
  }, [load]);

  const markAsRead = async (id) => {
    try {
      await USER_API.markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n
        )
      );
      setUnreadCount((prev) => Math.max(prev - 1, 0));
    } catch (err) {
      console.error("Failed to mark notification as read", err);
    }
  };

  const markAllAsRead = async () => {
    try {
      await USER_API.markAllNotificationsRead();
      setNotifications((prev) =>
        prev.map((n) => ({
          ...n,
          is_read: true,
          read_at: n.read_at || new Date().toISOString(),
        }))
      );
      setUnreadCount(0);
    } catch (err) {
      console.error("Failed to mark all notifications as read", err);
    }
  };

  return {
    notifications,
    unreadCount,
    total,
    loading,
    reload: load,
    markAsRead,
    markAllAsRead,
  };
};
