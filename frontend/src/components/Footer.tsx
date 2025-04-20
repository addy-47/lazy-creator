import { NavLink } from "react-router-dom";
import { Youtube, Github, Heart, ChevronRight } from "lucide-react";
import StickFigureAnimation from "./StickFigureAnimation";
import Logo from "./Logo";

const Footer = () => {
  const year = new Date().getFullYear();

  return (
    <footer className="relative overflow-hidden border-t border-border pt-12 pb-8">
      {/* Subtle background gradient */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-t dark:from-black/40 dark:to-transparent from-gray-50/80 to-transparent"></div>

      {/* Subtle pattern */}
      <div className="absolute inset-0 -z-10 opacity-[0.03]">
        <div className="h-full w-full bg-[radial-gradient(#E0115F_1px,transparent_1px)] [background-size:20px_20px]"></div>
      </div>

      {/* Animated stick figure in corner */}
      {/* Removed for performance optimization
      <div className="absolute right-8 bottom-16 opacity-60 hidden lg:block">
        <StickFigureAnimation type="wave" delay={200} height={60} />
      </div>
      */}

      <div className="container-wide">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
          <div className="md:col-span-5 space-y-4">
            <NavLink to="/" className="flex items-center space-x-2">
              <Logo />
              <span className="text-xl font-semibold">
                <span className="text-foreground">Lazy</span>
                <span className="text-[#E0115F]">Creator</span>
              </span>
            </NavLink>
            <p className="text-muted-foreground text-sm leading-relaxed max-w-md">
              The smartest way to create engaging YouTube Shorts. Turn your
              ideas into viral content in minutes with our AI-powered platform.
            </p>
            <div className="pt-2">
              <div className="inline-flex items-center gap-1 text-xs px-3 py-1 rounded-full text-[#E0115F] bg-[#E0115F]/10 border border-[#E0115F]/20">
                <Heart size={12} className="fill-[#E0115F] text-[#E0115F]" />
                <span>Made with passion</span>
              </div>
            </div>
          </div>

          <div className="md:col-span-7">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-8">
              <div className="space-y-4">
                <h4 className="font-medium text-foreground text-sm mb-2">
                  Product
                </h4>
                <ul className="space-y-2">
                  <li>
                    <NavLink
                      to="/"
                      className="text-muted-foreground text-sm hover:text-[#E0115F] transition-colors flex items-center gap-1"
                    >
                      <ChevronRight size={14} />
                      <span>Home</span>
                    </NavLink>
                  </li>
                  <li>
                    <NavLink
                      to="/create"
                      className="text-muted-foreground text-sm hover:text-[#E0115F] transition-colors flex items-center gap-1"
                    >
                      <ChevronRight size={14} />
                      <span>Create</span>
                    </NavLink>
                  </li>
                  <li>
                    <NavLink
                      to="/gallery"
                      className="text-muted-foreground text-sm hover:text-[#E0115F] transition-colors flex items-center gap-1"
                    >
                      <ChevronRight size={14} />
                      <span>Gallery</span>
                    </NavLink>
                  </li>
                  <li>
                    <NavLink
                      to="/learn"
                      className="text-muted-foreground text-sm hover:text-[#E0115F] transition-colors flex items-center gap-1"
                    >
                      <ChevronRight size={14} />
                      <span>Learn More</span>
                    </NavLink>
                  </li>
                </ul>
              </div>

              <div className="space-y-4">
                <h4 className="font-medium text-foreground text-sm mb-2">
                  Legal
                </h4>
                <ul className="space-y-2">
                  <li>
                    <NavLink
                      to="/privacy-policy"
                      className="text-muted-foreground text-sm hover:text-[#E0115F] transition-colors flex items-center gap-1"
                    >
                      <ChevronRight size={14} />
                      <span>Privacy Policy</span>
                    </NavLink>
                  </li>
                  <li>
                    <NavLink
                      to="/terms-of-service"
                      className="text-muted-foreground text-sm hover:text-[#E0115F] transition-colors flex items-center gap-1"
                    >
                      <ChevronRight size={14} />
                      <span>Terms of Service</span>
                    </NavLink>
                  </li>
                </ul>
              </div>

              <div className="space-y-4 col-span-2 sm:col-span-1">
                <h4 className="font-medium text-foreground text-sm mb-2">
                  Connect
                </h4>
                <div className="flex flex-col space-y-4">
                  <a
                    href="mailto:support@lazycreator.com"
                    className="text-muted-foreground text-sm hover:text-[#E0115F] transition-colors"
                  >
                    support@lazycreator.com
                  </a>
                  <div className="flex gap-4">
                    <a
                      href="https://www.youtube.com/channel/UC6OLDh-EUFrhmf8-RmvaYnA"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-9 h-9 rounded-full bg-[#E0115F]/10 hover:bg-[#E0115F]/20 flex items-center justify-center text-[#E0115F] transition-colors"
                      aria-label="YouTube"
                    >
                      <Youtube size={16} />
                    </a>
                    <a
                      href="https://github.com/addy-47"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-9 h-9 rounded-full bg-[#E0115F]/10 hover:bg-[#E0115F]/20 flex items-center justify-center text-[#E0115F] transition-colors"
                      aria-label="GitHub"
                    >
                      <Github size={16} />
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-border/50 mt-10 pt-6 flex flex-col md:flex-row justify-between items-center">
          <p className="text-xs text-muted-foreground">
            © {year} LazyCreator. All rights reserved.
          </p>
          <div className="mt-4 md:mt-0 text-xs text-muted-foreground">
            <span>Designed with 🧠 by AI, built for creators</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
