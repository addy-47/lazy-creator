import React, { useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { getAPIBaseURL } from "../utils/config";

const DebugLogin = () => {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const apiBase = getAPIBaseURL();
      console.log("Using API base:", apiBase);

      // Call the real login endpoint
      const response = await axios.post(
        `${apiBase}/api/login`,
        {
          email,
          password: "debug_password", // Debug password for testing
          name,
        },
        { headers: { "Content-Type": "application/json" } }
      );

      setResult(response.data);

      if (response.data.token) {
        localStorage.setItem("token", response.data.token);

        const userData = {
          email: email,
          name: name || "Debug User",
        };
        localStorage.setItem("user", JSON.stringify(userData));

        toast.success("Debug login successful! Token stored in localStorage.");
      }
    } catch (error) {
      console.error("Debug login error:", error);
      toast.error("Login failed. See console for details.");
      setResult({ error: "Login failed" });
    } finally {
      setIsLoading(false);
    }
  };

  const checkTokenStatus = () => {
    const token = localStorage.getItem("token");

    if (!token) {
      toast.error("No token found in localStorage");
      setResult({ tokenStatus: "No token found" });
      return;
    }

    // Simple token check
    try {
      if (token === "demo-token-for-testing") {
        setResult({
          tokenStatus: "DEMO TOKEN DETECTED",
          warning: "This is causing your YouTube auth issues",
        });
        toast.error("You are using a demo token!");
        return;
      }

      // Try to decode token (just for display)
      const tokenParts = token.split(".");
      if (tokenParts.length === 3) {
        const payload = JSON.parse(atob(tokenParts[1]));
        setResult({
          tokenStatus: "Token found",
          token: token.substring(0, 10) + "...",
          payload,
        });

        if (payload.force_real) {
          toast.success("Force real token detected");
        }

        if (payload.email?.toLowerCase().includes("demo")) {
          toast.warning("Email contains 'demo' which may cause issues");
        }
      }
    } catch (error) {
      setResult({ tokenStatus: "Invalid token format", error });
      toast.error("Invalid token format");
    }
  };

  const clearToken = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("youtubeConnected");
    localStorage.removeItem("selectedYouTubeChannel");
    localStorage.removeItem("checkYouTubeAuth");
    toast.success("All tokens cleared!");
    setResult({ tokenStatus: "Tokens cleared" });
  };

  return (
    <div className="max-w-md mx-auto mt-10 p-6 bg-white rounded-lg shadow-md">
      <h1 className="text-2xl font-bold mb-6 text-center">Debug Login</h1>
      <p className="text-red-500 mb-4 text-sm">
        Use this page to generate a real token that bypasses demo checks
      </p>

      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
        >
          {isLoading ? "Loading..." : "Generate Real Token"}
        </button>
      </form>

      <div className="mt-6 flex space-x-2">
        <button
          onClick={checkTokenStatus}
          className="flex-1 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-500 hover:bg-blue-600"
        >
          Check Token
        </button>

        <button
          onClick={clearToken}
          className="flex-1 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-500 hover:bg-red-600"
        >
          Clear Tokens
        </button>
      </div>

      {result && (
        <div className="mt-6 p-4 bg-gray-100 rounded-md overflow-x-auto">
          <h3 className="font-medium mb-2">Result:</h3>
          <pre className="text-xs whitespace-pre-wrap">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}

      <div className="mt-6">
        <h3 className="font-medium mb-2">What to do next:</h3>
        <ol className="list-decimal pl-5 text-sm space-y-1">
          <li>Use this page to generate a real token</li>
          <li>Check that your token is stored in localStorage</li>
          <li>
            Go to the{" "}
            <a href="/gallery" className="text-primary underline">
              Gallery
            </a>{" "}
            page
          </li>
          <li>Try connecting to YouTube again</li>
        </ol>
      </div>
    </div>
  );
};

export default DebugLogin;
