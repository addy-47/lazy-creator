import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/Button";
import { Input } from "@/components/ui/input";
import {
  EyeIcon,
  EyeOffIcon,
  Mail,
  Lock,
  User,
  AlertCircle,
} from "lucide-react";
import Logo from "@/components/Logo";
import { toast } from "sonner";
import StickFigureAnimation from "@/components/StickFigureAnimation";
import { AUTH_CHANGE_EVENT } from "@/utils/events";
import { useAuth } from "@/contexts/use-auth";
import { authApi } from "@/services/api";
import { setToken } from "@/services/tokenService";



// Native login helpers are in @/services/api and tokenService

const Auth = () => {
  const navigate = useNavigate();
  const { refreshAuthState } = useAuth();
  const [isSignIn, setIsSignIn] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [formErrors, setFormErrors] = useState<{
    email?: string;
    password?: string;
    name?: string;
  }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateForm = () => {
    const errors: {
      email?: string;
      password?: string;
      name?: string;
    } = {};
    let isValid = true;

    if (!email) {
      errors.email = "Email is required";
      isValid = false;
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      errors.email = "Email is invalid";
      isValid = false;
    }

    if (!password) {
      errors.password = "Password is required";
      isValid = false;
    } else if (password.length < 6) {
      errors.password = "Password must be at least 6 characters";
      isValid = false;
    }

    if (!isSignIn && !name) {
      errors.name = "Name is required";
      isValid = false;
    }

    setFormErrors(errors);
    return isValid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      // Determine which method to call based on whether signing in or signing up
      const apiCall = isSignIn 
        ? authApi.login({ email, password })
        : authApi.register({ email, password, name });

      const response = await apiCall;
      const data = response.data;

      // Use the actual token from the backend
      const token = data.token;

      if (!token) {
        throw new Error("No token received from server");
      }

      const userData = {
        email,
        name: data.user?.name || (isSignIn ? "User" : name),
        picture: data.user?.picture || null,
      };

      // Store token and user info
      setToken(token);
      localStorage.setItem("user", JSON.stringify(userData));

      // Dispatch auth change event and refresh auth state
      window.dispatchEvent(new CustomEvent(AUTH_CHANGE_EVENT));
      refreshAuthState();

      if (isSignIn) {
        toast.success("Successfully signed in!");
      } else {
        toast.success("Account created successfully!");
      }

      navigate("/");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "An unexpected error occurred";
      toast.error(message || (isSignIn ? "Failed to sign in" : "Failed to create account"));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handler for Google OAuth sign in (Native Flow)
  const handleGoogleSignIn = async () => {
    setIsSubmitting(true);
    try {
      // 1. Get the Auth URL from the backend
      const response = await authApi.getGoogleAuthUrl();
      const authUrl = response?.data?.url;
      
      if (!authUrl) {
        throw new Error("Could not retrieve Google authentication URL");
      }

      // 2. Open a centered popup window
      const width = 500;
      const height = 600;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      
      const popup = window.open(
        authUrl,
        "google_login",
        `width=${width},height=${height},left=${left},top=${top},status=no,menubar=no,toolbar=no`
      );

      if (!popup) {
        toast.error("Popup blocked! Please allow popups for this site.");
        setIsSubmitting(false);
        return;
      }

      // 3. Listen for the message from the backend bridge
      const messageListener = async (event: MessageEvent) => {
        // Simple security check: origin should be our backend
        // In local dev, this might be localhost:8888 or localhost:3333
        const isWhitelistedOrigin = event.origin.includes('localhost') || event.origin.includes('lazycreator.in');
        
        if (!isWhitelistedOrigin || !event.data || event.data.status !== "success") {
          return;
        }

        const data = event.data;
        const token = data.token;

        if (token) {
          // Success! Cleanup and complete login
          window.removeEventListener("message", messageListener);
          
          setToken(token);
          localStorage.setItem(
            "user",
            JSON.stringify({
              email: data.user.email,
              name: data.user.name || "User",
              picture: data.user.picture || data.user.avatar || null,
            })
          );

          // Dispatch auth change event and refresh auth state
          window.dispatchEvent(new CustomEvent(AUTH_CHANGE_EVENT));
          refreshAuthState();

          toast.success("Signed in with Google successfully!");
          navigate("/");
          setIsSubmitting(false);
        }
      };

      window.addEventListener("message", messageListener);

      // 4. Handle popup closure (fallback if message never received)
      const popupCheckInterval = setInterval(() => {
        if (popup.closed) {
          clearInterval(popupCheckInterval);
          // If we're still submitting, it means we didn't receive the success signal
          setIsSubmitting((prev) => {
            if (prev) {
               // Cleanup listener if closed
               window.removeEventListener("message", messageListener);
            }
            return false;
          });
        }
      }, 1000);

    } catch (error: unknown) {
      console.error(error);
      const message = error instanceof Error ? error.message : "Google sign in failed";
      toast.error(message);
      setIsSubmitting(false);
    }
  };

  // Native Facebook login not implemented yet
  const handleFacebookSignIn = () => {
    toast.info("Facebook login is coming soon! Please use Google login for now.");
  };

  return (
    <>
      <div className="pt-32 pb-20 px-4">
        <div className="container-tight mb-8 text-center">
          <h1 className="text-3xl font-semibold md:text-4xl mb-4">
            {isSignIn ? "Welcome Back" : "Create Your Account"}
          </h1>
          <p className="text-foreground/70 max-w-md mx-auto">
            {isSignIn
              ? "Sign in to your LazyCreator account to continue creating amazing YouTube Shorts."
              : "Join LazyCreator today and start creating stunning YouTube Shorts in minutes."}
          </p>
        </div>

        <div className="max-w-md mx-auto relative">
          <div className="absolute -top-12 -right-12 z-10 hidden md:block">
            <StickFigureAnimation type="peek" delay={500} height={70} />
          </div>

          <div className="absolute -bottom-12 -left-12 z-10 hidden md:block">
            <StickFigureAnimation type="sleep" delay={700} height={70} />
          </div>

          <div className="glass-card p-8">
            <div className="mb-6 flex justify-center">
              <Logo size="large" showText={true} />
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {!isSignIn && (
                <div className="space-y-2">
                  <label htmlFor="name" className="text-sm font-medium">
                    Full Name
                  </label>
                  <div className="relative">
                    <User
                      size={18}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    />
                    <Input
                      id="name"
                      type="text"
                      placeholder="Enter your name"
                      className={`pl-10 ${
                        formErrors.name ? "border-red-500" : ""
                      }`}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      disabled={isSubmitting}
                    />
                  </div>
                  {formErrors.name && (
                    <div className="flex items-center text-red-500 text-sm mt-1">
                      <AlertCircle size={14} className="mr-1" />
                      {formErrors.name}
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium">
                  Email Address
                </label>
                <div className="relative">
                  <Mail
                    size={18}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  />
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter your email"
                    className={`pl-10 ${
                      formErrors.email ? "border-red-500" : ""
                    }`}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isSubmitting}
                    required
                  />
                </div>
                {formErrors.email && (
                  <div className="flex items-center text-red-500 text-sm mt-1">
                    <AlertCircle size={14} className="mr-1" />
                    {formErrors.email}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <label htmlFor="password" className="text-sm font-medium">
                    Password
                  </label>
                  {isSignIn && (
                    <button
                      type="button"
                      className="text-sm text-primary hover:underline"
                      onClick={() =>
                        toast.info("Password reset functionality would go here")
                      }
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock
                    size={18}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    className={`pl-10 ${
                      formErrors.password ? "border-red-500" : ""
                    }`}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isSubmitting}
                    required
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={isSubmitting}
                  >
                    {showPassword ? (
                      <EyeOffIcon size={18} />
                    ) : (
                      <EyeIcon size={18} />
                    )}
                  </button>
                </div>
                {formErrors.password && (
                  <div className="flex items-center text-red-500 text-sm mt-1">
                    <AlertCircle size={14} className="mr-1" />
                    {formErrors.password}
                  </div>
                )}
              </div>

              <Button
                type="submit"
                className="w-full mt-6"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <span className="flex items-center">
                    <svg
                      className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    {isSignIn ? "Signing In..." : "Creating Account..."}
                  </span>
                ) : isSignIn ? (
                  "Sign In"
                ) : (
                  "Create Account"
                )}
              </Button>
            </form>

            <div className="mt-8 text-center">
              <p className="text-sm text-foreground/70">
                {isSignIn
                  ? "Don't have an account?"
                  : "Already have an account?"}
                <button
                  type="button"
                  className="ml-2 text-primary hover:underline font-medium"
                  onClick={() => {
                    setIsSignIn(!isSignIn);
                    setFormErrors({});
                  }}
                  disabled={isSubmitting}
                >
                  {isSignIn ? "Sign Up" : "Sign In"}
                </button>
              </p>
            </div>

            <div className="mt-6">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border"></div>
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-background px-2 text-foreground/60">
                    Or continue with
                  </span>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-4">
                <Button
                  variant="outline"
                  type="button"
                  className="h-11"
                  disabled={isSubmitting}
                  onClick={handleGoogleSignIn}
                >
                  <div className="flex w-full items-center justify-center space-x-2">
                    <svg
                      viewBox="0 0 24 24"
                      className="h-5 w-5"
                      aria-hidden="true"
                    >
                      <path
                        d="M12.0003 4.75C13.7703 4.75 15.3553 5.36002 16.6053 6.54998L20.0303 3.125C17.9502 1.19 15.2353 0 12.0003 0C7.31028 0 3.25527 2.69 1.28027 6.60998L5.27028 9.70498C6.21525 6.86002 8.87028 4.75 12.0003 4.75Z"
                        fill="#EA4335"
                      />
                      <path
                        d="M23.49 12.275C23.49 11.49 23.415 10.73 23.3 10H12V14.51H18.47C18.18 15.99 17.34 17.25 16.08 18.1L19.945 21.1C22.2 19.01 23.49 15.92 23.49 12.275Z"
                        fill="#4285F4"
                      />
                      <path
                        d="M5.26498 14.2949C5.02498 13.5699 4.88501 12.7999 4.88501 11.9999C4.88501 11.1999 5.01998 10.4299 5.26498 9.7049L1.275 6.60986C0.46 8.22986 0 10.0599 0 11.9999C0 13.9399 0.46 15.7699 1.28 17.3899L5.26498 14.2949Z"
                        fill="#FBBC05"
                      />
                      <path
                        d="M12.0004 24C15.2404 24 17.9654 22.935 19.9454 21.095L16.0804 18.095C15.0054 18.82 13.6204 19.25 12.0004 19.25C8.87043 19.25 6.21543 17.14 5.27043 14.295L1.28043 17.39C3.25543 21.31 7.31043 24 12.0004 24Z"
                        fill="#34A853"
                      />
                    </svg>
                    <span>Google</span>
                  </div>
                </Button>

                <Button
                  variant="outline"
                  type="button"
                  className="h-11"
                  disabled={isSubmitting}
                  onClick={handleFacebookSignIn}
                >
                  <div className="flex w-full items-center justify-center space-x-2">
                    <svg
                      viewBox="0 0 320 512"
                      className="h-5 w-5"
                      aria-hidden="true"
                    >
                      <path
                        d="M279.14 288l14.22-92.66h-88.91v-60.13c0-25.35 12.42-50.06 52.24-50.06h40.42V6.26S260.43 0 225.36 0c-73.22 0-121.08 44.38-121.08 124.72v70.62H22.89V288h81.39v224h100.17V288z"
                        fill="#1877F2"
                      />
                    </svg>
                    <span>Facebook</span>
                  </div>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Auth;
