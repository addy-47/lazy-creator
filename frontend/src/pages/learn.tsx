import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/Button";

const Learn = () => {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Enhanced background with gradient and pattern */}
      <div className="fixed inset-0 -z-10 bg-gradient-to-br from-primary/5 via-background/90 to-background">
        <div className="absolute inset-0 opacity-10">
          <div className="h-full w-full bg-[radial-gradient(#3b82f6_1px,transparent_1px)] [background-size:20px_20px]"></div>
        </div>
      </div>

      <Navbar />
      <main className="flex-grow container py-16">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-bold mb-8 text-center">
            How LazyCreator Works
          </h1>

          <div className="space-y-12">
            <section className="glass-card p-8">
              <h2 className="text-2xl font-semibold mb-4">Project Overview</h2>
              <p className="text-lg mb-4">
                LazyCreator is a full-stack application designed to automate the
                creation of YouTube Shorts. It combines modern frontend
                technologies with powerful backend services to provide a
                seamless user experience.
              </p>
              <p className="text-lg">
                The application allows users to generate professional-quality
                short-form videos with minimal input, making content creation
                accessible to everyone regardless of their technical skills.
              </p>
            </section>

            <section className="space-y-6">
              <h2 className="text-2xl font-semibold">Frontend Architecture</h2>

              <div className="glass-card p-6">
                <h3 className="text-xl font-medium mb-3">Core Technologies</h3>
                <ul className="list-disc pl-6 space-y-2">
                  <li>
                    <span className="font-medium">React:</span> Component-based
                    UI library for building the user interface
                  </li>
                  <li>
                    <span className="font-medium">TypeScript:</span> Type-safe
                    JavaScript for improved development experience
                  </li>
                  <li>
                    <span className="font-medium">Tailwind CSS:</span>{" "}
                    Utility-first CSS framework for styling
                  </li>
                  <li>
                    <span className="font-medium">Shadcn UI:</span> Component
                    library built on Radix UI primitives
                  </li>
                  <li>
                    <span className="font-medium">React Router:</span>{" "}
                    Client-side routing for navigation
                  </li>
                  <li>
                    <span className="font-medium">Tanstack Query:</span> Data
                    fetching and state management
                  </li>
                </ul>
              </div>

              <div className="glass-card p-6">
                <h3 className="text-xl font-medium mb-3">UI/UX Features</h3>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Responsive design that works across all device sizes</li>
                  <li>
                    Dark/light theme support with automatic system preference
                    detection
                  </li>
                  <li>Animated components for enhanced user experience</li>
                  <li>Form validation and error handling</li>
                  <li>Toast notifications for user feedback</li>
                  <li>Intuitive step-by-step creation process</li>
                </ul>
              </div>
            </section>

            <section className="space-y-6">
              <h2 className="text-2xl font-semibold">Backend Architecture</h2>

              <div className="glass-card p-6">
                <h3 className="text-xl font-medium mb-3">Core Technologies</h3>
                <ul className="list-disc pl-6 space-y-2">
                  <li>
                    <span className="font-medium">Node.js:</span> JavaScript
                    runtime for the server
                  </li>
                  <li>
                    <span className="font-medium">Express:</span> Web framework
                    for handling API requests
                  </li>
                  <li>
                    <span className="font-medium">MongoDB:</span> NoSQL database
                    for storing user data and video metadata
                  </li>
                  <li>
                    <span className="font-medium">FFmpeg:</span> Media
                    processing library for video manipulation
                  </li>
                  <li>
                    <span className="font-medium">AWS S3:</span> Cloud storage
                    for media files
                  </li>
                  <li>
                    <span className="font-medium">JWT:</span> Authentication and
                    authorization
                  </li>
                </ul>
              </div>

              <div className="glass-card p-6">
                <h3 className="text-xl font-medium mb-3">Services & APIs</h3>
                <ul className="list-disc pl-6 space-y-2">
                  <li>
                    <span className="font-medium">Video Generation API:</span>{" "}
                    AI-powered service for creating video content
                  </li>
                  <li>
                    <span className="font-medium">Text-to-Speech API:</span>{" "}
                    Converts written prompts to natural-sounding voice
                  </li>
                  <li>
                    <span className="font-medium">
                      Background Music Service:
                    </span>{" "}
                    Library of licensed music tracks
                  </li>
                  <li>
                    <span className="font-medium">YouTube API:</span>{" "}
                    Integration for direct upload to YouTube
                  </li>
                  <li>
                    <span className="font-medium">Analytics Service:</span>{" "}
                    Tracking video performance and user behavior
                  </li>
                </ul>
              </div>
            </section>

            <section className="glass-card p-8">
              <h2 className="text-2xl font-semibold mb-4">Development Tools</h2>

              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-medium mb-3">AI Assistance</h3>
                  <ul className="list-disc pl-6 space-y-2">
                    <li>
                      <span className="font-medium">Lovable:</span> AI-powered
                      coding platform for real-time development
                    </li>
                    <li>
                      <span className="font-medium">Claude:</span> Anthropic's
                      AI assistant for creative content and problem-solving
                    </li>
                    <li>
                      <span className="font-medium">Grok:</span> Advanced AI for
                      technical insights and code optimization
                    </li>
                    <li>
                      <span className="font-medium">Cursor:</span> AI-enhanced
                      code editor for improved productivity
                    </li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-xl font-medium mb-3">
                    Workflow & Deployment
                  </h3>
                  <ul className="list-disc pl-6 space-y-2">
                    <li>
                      <span className="font-medium">Git & GitHub:</span> Version
                      control and code collaboration
                    </li>
                    <li>
                      <span className="font-medium">Vite:</span> Next-generation
                      frontend build tool
                    </li>
                    <li>
                      <span className="font-medium">Docker:</span>{" "}
                      Containerization for consistent environments
                    </li>
                    <li>
                      <span className="font-medium">Vercel:</span> Frontend
                      deployment and hosting
                    </li>
                    <li>
                      <span className="font-medium">Render:</span> Backend
                      deployment and scaling
                    </li>
                  </ul>
                </div>
              </div>
            </section>

            <div className="text-center">
              <Button
                size="lg"
                className="group"
                onClick={() => window.history.back()}
              >
                Back to Home
                <ArrowRight
                  size={16}
                  className="ml-2 transition-transform group-hover:translate-x-0.5"
                />
              </Button>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Learn;
