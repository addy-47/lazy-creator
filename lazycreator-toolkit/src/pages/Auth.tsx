import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/Button";
import { Input } from "@/components/ui/input";
import { EyeIcon, EyeOffIcon, Mail, Lock, User, AlertCircle } from "lucide-react";
import Logo from "@/components/Logo";
import { toast } from "sonner";
import StickFigureAnimation from "@/components/StickFigureAnimation";
import { ScrollArea } from "@/components/ui/scroll-area";

const Auth = () => {
  const navigate = useNavigate();
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
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const userData = {
        email,
        name: isSignIn ? "User" : name
      };
      
      localStorage.setItem("user", JSON.stringify(userData));
      
      if (isSignIn) {
        console.log("Sign in with:", email, password);
        toast.success("Successfully signed in!");
      } else {
        console.log("Sign up with:", name, email, password);
        toast.success("Account created successfully!");
      }
      
      navigate("/");
      
    } catch (error) {
      toast.error(isSignIn ? "Failed to sign in. Please try again." : "Failed to create account. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <div className="fixed inset-0 -z-10 bg-gradient-to-br from-primary/5 via-background/90 to-background">
        <div className="absolute inset-0 opacity-10">
          <div className="h-full w-full bg-[radial-gradient(#3b82f6_1px,transparent_1px)] [background-size:20px_20px]"></div>
        </div>
      </div>
      
      <Navbar />
      <main className="flex-grow pt-32 pb-20 px-4">
        <div className="container-tight mb-8 text-center">
          <h1 className="text-3xl font-semibold md:text-4xl mb-4">
            {isSignIn ? "Welcome Back" : "Create Your Account"}
          </h1>
          <p className="text-foreground/70 max-w-md mx-auto">
            {isSignIn 
              ? "Sign in to your LazyCreator account to continue creating amazing YouTube Shorts." 
              : "Join LazyCreator today and start creating stunning YouTube Shorts in minutes."
            }
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
                    <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="name"
                      type="text"
                      placeholder="Enter your name"
                      className={`pl-10 ${formErrors.name ? 'border-red-500' : ''}`}
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
                  <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter your email"
                    className={`pl-10 ${formErrors.email ? 'border-red-500' : ''}`}
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
                      onClick={() => toast.info("Password reset functionality would go here")}
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    className={`pl-10 ${formErrors.password ? 'border-red-500' : ''}`}
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
                    {showPassword ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
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
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {isSignIn ? "Signing In..." : "Creating Account..."}
                  </span>
                ) : (
                  isSignIn ? "Sign In" : "Create Account"
                )}
              </Button>
            </form>
            
            <div className="mt-8 text-center">
              <p className="text-sm text-foreground/70">
                {isSignIn ? "Don't have an account?" : "Already have an account?"}
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
                  <span className="bg-background px-2 text-foreground/60">Or continue with</span>
                </div>
              </div>
              
              <div className="mt-6 grid grid-cols-2 gap-3">
                <Button variant="outline" type="button" className="h-10" disabled={isSubmitting}>
                  <svg viewBox="0 0 24 24" className="h-5 w-5 mr-2" aria-hidden="true">
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
                  Google
                </Button>
                
                <Button variant="outline" type="button" className="h-10" disabled={isSubmitting}>
                  <svg viewBox="0 0 24 24" className="h-5 w-5 mr-2" aria-hidden="true">
                    <path
                      d="M16.6345 1.93702H19.3519V8.37936C19.3519 8.48036 19.3421 8.5522 19.3034 8.6022C19.2841 8.63303 18.1899 10.1387 16.6345 10.1387C14.6629 10.1387 13.7864 8.85303 13.7864 7.22119V1.93702H16.5037V7.22119C16.5037 7.7522 16.8089 8.13594 17.3014 8.13594C17.7939 8.13594 18.118 7.7522 18.118 7.22119V1.93702H16.6345ZM11.5144 5.4357V10.1482H8.79688V5.4357H7.31348V2.71736H12.9978V5.4357H11.5144ZM6.04633 0C7.53066 0 8.74035 1.19177 8.74035 2.6761C8.74035 4.16044 7.53066 5.3522 6.04633 5.3522C4.562 5.3522 3.3523 4.16044 3.3523 2.6761C3.3523 1.19177 4.562 0 6.04633 0ZM7.62281 5.82895V10.1387H4.46984V5.82895H7.62281ZM3.64664 10.1387H0.493672V5.82895H3.64664V10.1387Z"
                      fill="currentColor"
                    />
                  </svg>
                  LinkedIn
                </Button>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Auth;
