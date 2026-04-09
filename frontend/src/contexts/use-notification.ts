import { createContext, useContext } from "react";

export interface NotificationContextType {
  showSessionExpiredNotification: () => void;
}

export const NotificationContext = createContext<NotificationContextType | undefined>(
  undefined
);

export function useNotification() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error(
      "useNotification must be used within a NotificationProvider"
    );
  }
  return context;
}
