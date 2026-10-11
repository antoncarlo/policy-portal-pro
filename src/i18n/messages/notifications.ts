import { defineMessages } from "@/i18n";

/** Campanella delle notifiche nel menu: avvisi su pratiche e documenti. */
export const notificationMessages = defineMessages({
  it: {
    title: "Notifiche",
    open: (unread: number) => (unread > 0 ? `Notifiche: ${unread} da leggere` : "Notifiche"),
    markAll: "Segna tutte come lette",
    empty: "Nessuna notifica",
    loadError: "Impossibile caricare le notifiche",
    unreadOnly: "Da leggere",
    all: "Tutte",
    practice: (number: string) => `Pratica ${number}`,
    types: {
      document_added: "Nuovo documento caricato",
      status_change: "Stato della pratica aggiornato",
      other: "Aggiornamento",
    },
  },
  en: {
    title: "Notifications",
    open: (unread: number) => (unread > 0 ? `Notifications: ${unread} unread` : "Notifications"),
    markAll: "Mark all as read",
    empty: "No notifications",
    loadError: "Could not load the notifications",
    unreadOnly: "Unread",
    all: "All",
    practice: (number: string) => `Practice ${number}`,
    types: {
      document_added: "New document uploaded",
      status_change: "Practice status updated",
      other: "Update",
    },
  },
  zh: {
    title: "通知",
    open: (unread: number) => (unread > 0 ? `通知：${unread} 条未读` : "通知"),
    markAll: "全部标为已读",
    empty: "暂无通知",
    loadError: "无法加载通知",
    unreadOnly: "未读",
    all: "全部",
    practice: (number: string) => `申请 ${number}`,
    types: {
      document_added: "已上传新文件",
      status_change: "申请状态已更新",
      other: "更新",
    },
  },
});
