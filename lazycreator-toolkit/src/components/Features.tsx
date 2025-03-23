
import { Sparkles, Sliders, Clock, Image, Upload, MessageSquare } from "lucide-react";

const features = [
  {
    icon: <Sparkles className="h-6 w-6 text-primary" />,
    title: "AI-Powered Prompts",
    description: "Choose from curated prompts or create your own to generate engaging content for your YouTube Shorts."
  },
  {
    icon: <Sliders className="h-6 w-6 text-primary" />,
    title: "Customizable Options",
    description: "Adjust every aspect of your Short to match your style and preferences with intuitive controls."
  },
  {
    icon: <Clock className="h-6 w-6 text-primary" />,
    title: "Perfect Duration",
    description: "Set the exact length for your Shorts with our smooth duration slider for optimal viewer engagement."
  },
  {
    icon: <Image className="h-6 w-6 text-primary" />,
    title: "Background Selection",
    description: "Choose from our library of backgrounds or upload your own images and videos for a personalized touch."
  },
  {
    icon: <Upload className="h-6 w-6 text-primary" />,
    title: "Direct Upload",
    description: "Publish your finished Shorts directly to YouTube or download them for later use."
  },
  {
    icon: <MessageSquare className="h-6 w-6 text-primary" />,
    title: "Latest AI News",
    description: "Stay current with predefined prompts featuring the latest AI news and trending topics."
  }
];

const Features = () => {
  return (
    <section className="section bg-gradient-to-b from-background to-secondary/20">
      <div className="container-wide">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="font-semibold mb-4">Powerful Features</h2>
          <p className="text-lg text-foreground/70">
            Everything you need to create professional YouTube Shorts without the hassle
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, index) => (
            <div 
              key={index} 
              className="glass-card p-6 flex flex-col animate-fade-in"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className="rounded-full w-12 h-12 flex items-center justify-center bg-primary/10 mb-4">
                {feature.icon}
              </div>
              <h3 className="text-xl font-medium mb-2">{feature.title}</h3>
              <p className="text-foreground/70">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;
