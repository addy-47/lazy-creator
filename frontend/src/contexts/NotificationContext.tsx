import {
  ReactNode,
  useCallback,
} from "react";
import { toast } from "@/hooks/use-toast";
import { NotificationContext } from "./use-notification";

export function NotificationProvider({ children }: { children: ReactNode }) {
  // Show session expired notification and handle logout
  const showSessionExpiredNotification = useCallback(() => {
    // First show the notification
    toast({
      title: "Session Expired",
      description: "Your session has expired. Please log in again.",
      variant: "destructive",
    });

    // Perform cleanup operations
    // Clear any sensitive data from memory
    const cleanupData = () => {
      // Remove any user-specific cached data
      localStorage.removeItem("cached_user_data");
      sessionStorage.clear();

      // Clear tokens using localStorage directly
      // This avoids circular dependency with AuthContext
      localStorage.removeItem("token");
      localStorage.removeItem("token_expiry");
      localStorage.removeItem("user");

      // Any other cleanup needed

      // Finally redirect to login
      window.location.href = "/auth";
    };

    // Delay the cleanup and redirect to give the notification time to be seen
    setTimeout(() => {
      // Perform cleanup
      cleanupData();
    }, 3000); // 3 seconds delay
  }, []);

  return (
    <NotificationContext.Provider
      value={{
        showSessionExpiredNotification,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}
