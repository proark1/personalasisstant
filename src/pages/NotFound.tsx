import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Home, LayoutDashboard, CheckSquare, Calendar, Users } from "lucide-react";
import doriImage from "@/assets/dori-fish.png";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6 relative overflow-hidden">
      {/* Floating orbs */}
      <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-primary/5 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-48 h-48 bg-primary/8 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center glass-card rounded-2xl p-8 max-w-md w-full relative z-10"
      >
        <motion.img
          src={doriImage}
          alt="Dori"
          className="w-20 h-20 rounded-full mx-auto mb-4 object-cover shadow-lg"
          initial={{ scale: 0 }}
          animate={{ scale: 1, y: [0, -6, 0] }}
          transition={{
            scale: { type: "spring", delay: 0.2 },
            y: { duration: 3, repeat: Infinity, ease: "easeInOut" },
          }}
        />
        <h1 className="mb-2 text-5xl font-bold text-foreground">404</h1>
        <p className="mb-2 text-lg text-muted-foreground">
          Oops! Dori couldn't find this page.
        </p>
        <p className="mb-6 text-xs text-muted-foreground/60 font-mono">
          {location.pathname}
        </p>

        <Button asChild size="lg" className="gap-2 w-full mb-4">
          <Link to="/">
            <Home className="w-4 h-4" />
            Return Home
          </Link>
        </Button>

        <div className="grid grid-cols-2 gap-2">
          {[
            { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
            { to: "/", icon: CheckSquare, label: "Tasks" },
            { to: "/contacts", icon: Users, label: "Contacts" },
            { to: "/contracts", icon: Calendar, label: "Contracts" },
          ].map((link) => (
            <Button key={link.to} asChild variant="ghost" size="sm" className="gap-1.5 text-xs">
              <Link to={link.to}>
                <link.icon className="w-3.5 h-3.5" />
                {link.label}
              </Link>
            </Button>
          ))}
        </div>
      </motion.div>
    </div>
  );
};

export default NotFound;
