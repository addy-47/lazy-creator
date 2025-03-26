import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/Button";
import { toast } from "sonner";

export default function YouTubeAuthSuccess() {
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const state = params.get("state");

    if (!state) {
      toast.error("Authentication failed: Missing state parameter");
      setLoading(false);
      return;
    }

    // Delay a bit to let the user see the success message
    const timer = setTimeout(() => {
      setLoading(false);
      setSuccess(true);

      // Redirect back to gallery after a short delay
      const redirectTimer = setTimeout(() => {
        navigate("/gallery");
      }, 3000);

      return () => clearTimeout(redirectTimer);
    }, 1500);

    return () => clearTimeout(timer);
  }, [location, navigate]);

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-grow pt-32 pb-20 px-4 flex items-center justify-center">
        <div className="max-w-md w-full">
          <div className="glass-card p-8 text-center">
            {loading ? (
              <div className="space-y-6">
                <div className="animate-spin mx-auto w-12 h-12 border-4 border-primary border-t-transparent rounded-full"></div>
                <h2 className="text-2xl font-medium">
                  Finalizing Authentication...
                </h2>
                <p className="text-foreground/70">
                  Please wait while we complete your YouTube account connection.
                </p>
              </div>
            ) : success ? (
              <div className="space-y-6">
                <div className="inline-block p-4 rounded-full bg-primary/20 mb-2">
                  <svg
                    width="32"
                    height="32"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-primary"
                  >
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                    <polyline points="22 4 12 14.01 9 11.01"></polyline>
                  </svg>
                </div>
                <h2 className="text-2xl font-medium">YouTube Connected!</h2>
                <p className="text-foreground/70">
                  Your YouTube account has been successfully connected. You can
                  now upload videos directly to your channel.
                </p>
                <p className="text-sm text-foreground/60">
                  Redirecting to Gallery...
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="inline-block p-4 rounded-full bg-destructive/20 mb-2">
                  <svg
                    width="32"
                    height="32"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-destructive"
                  >
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="15" y1="9" x2="9" y2="15"></line>
                    <line x1="9" y1="9" x2="15" y2="15"></line>
                  </svg>
                </div>
                <h2 className="text-2xl font-medium">Authentication Failed</h2>
                <p className="text-foreground/70">
                  We couldn't connect your YouTube account. Please try again.
                </p>
                <Button onClick={() => navigate("/gallery")}>
                  Return to Gallery
                </Button>
              </div>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
