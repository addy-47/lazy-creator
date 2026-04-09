export const DEFAULT_DURATION = 20;
export const MIN_DURATION = 10;
export const MAX_DURATION = 60;

export interface PredefinedPrompt {
  id: number;
  title: string;
  prompt: string;
}

export const PREDEFINED_PROMPTS: PredefinedPrompt[] = [
  {
    id: 1,
    title: "Latest AI News",
    prompt: "Create a short about the latest developments in AI technology",
  },
  {
    id: 2,
    title: "Tech Gadget Review",
    prompt: "Review the latest smartphone features in a compelling short format",
  },
  {
    id: 3,
    title: "Coding Tips",
    prompt: "Share 3 essential coding tips for beginners in a brief tutorial",
  },
  {
    id: 4,
    title: "Daily Motivation",
    prompt: "Create an inspirational short about overcoming challenges",
  },
  {
    id: 5,
    title: "Productivity Hack",
    prompt: "Explain a time-saving productivity technique in under 60 seconds",
  },
  {
    id: 6,
    title: "Life Hack",
    prompt: "Demonstrate a clever everyday life hack that saves time or money",
  },
];
