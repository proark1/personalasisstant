import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Sparkles,
  CheckSquare,
  Calendar,
  Users,
  Heart,
  Bot,
  FileText,
  ArrowRight,
  Zap,
  Brain,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const features = [
  {
    icon: CheckSquare,
    title: "Smart Tasks",
    description: "AI-prioritized tasks that adapt to your energy and schedule.",
    gradient: "from-primary to-primary/60",
  },
  {
    icon: Calendar,
    title: "Calendar Hub",
    description: "Unified calendar with smart scheduling and conflict detection.",
    gradient: "from-accent to-accent/60",
  },
  {
    icon: Users,
    title: "Family Manager",
    description: "Meals, shopping, budgets, and health — all in one place.",
    gradient: "from-[hsl(var(--success))] to-[hsl(var(--success))]/60",
  },
  {
    icon: Heart,
    title: "Health Tracking",
    description: "Track mood, sleep, exercise, and get AI-powered insights.",
    gradient: "from-[hsl(var(--destructive))] to-[hsl(var(--destructive))]/60",
  },
  {
    icon: Bot,
    title: "Dori AI Assistant",
    description: "Your personal AI that learns your patterns and helps you act.",
    gradient: "from-primary to-accent",
  },
  {
    icon: FileText,
    title: "Contract Manager",
    description: "Never miss a renewal or cancellation deadline again.",
    gradient: "from-[hsl(var(--warning))] to-[hsl(var(--warning))]/60",
  },
];

const stagger = {
  container: {
    hidden: {},
    show: { transition: { staggerChildren: 0.08, delayChildren: 0.3 } },
  },
  item: {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
  },
};

export default function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* Nav */}
      <header className="fixed top-0 inset-x-0 z-50 backdrop-blur-xl bg-background/70 border-b border-border/50">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-4 h-16">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg tracking-tight">DarAI</span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/auth">Log in</Link>
            </Button>
            <Button size="sm" className="gap-1" asChild>
              <Link to="/auth">
                Get Started <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative pt-32 pb-20 px-4">
        {/* Glow blobs */}
        <div className="absolute top-20 left-1/4 w-72 h-72 rounded-full bg-primary/10 blur-[120px] pointer-events-none" />
        <div className="absolute top-40 right-1/4 w-60 h-60 rounded-full bg-accent/10 blur-[100px] pointer-events-none" />

        <div className="max-w-3xl mx-auto text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-medium mb-6 border border-primary/20">
              <Zap className="w-3 h-3" />
              Built for ADHD minds
            </div>

            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold leading-[1.1] tracking-tight mb-5">
              Your life,{" "}
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                intelligently
              </span>{" "}
              organized
            </h1>

            <p className="text-lg sm:text-xl text-muted-foreground max-w-xl mx-auto mb-8 leading-relaxed">
              DarAI combines AI assistance, task management, calendar, health tracking, and family
              tools into one beautifully simple app.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button size="lg" className="gap-2 px-8 text-base" asChild>
                <Link to="/auth">
                  <Sparkles className="w-4 h-4" />
                  Get Started Free
                </Link>
              </Button>
              <Button variant="outline" size="lg" className="gap-2 px-8 text-base" asChild>
                <a href="#features">See Features</a>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <motion.div
            className="text-center mb-14"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="text-3xl sm:text-4xl font-bold mb-3 tracking-tight">
              Everything you need, nothing you don't
            </h2>
            <p className="text-muted-foreground text-lg max-w-lg mx-auto">
              Six pillars designed to reduce overwhelm and help you take action.
            </p>
          </motion.div>

          <motion.div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
            variants={stagger.container}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
          >
            {features.map((f) => (
              <motion.div
                key={f.title}
                variants={stagger.item}
                className="group relative rounded-xl border border-border/60 bg-card/50 backdrop-blur-sm p-6 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300"
              >
                <div
                  className={`w-10 h-10 rounded-lg bg-gradient-to-br ${f.gradient} flex items-center justify-center mb-4 text-primary-foreground`}
                >
                  <f.icon className="w-5 h-5" />
                </div>
                <h3 className="font-semibold text-base mb-1.5">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.description}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ADHD Section */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="max-w-4xl mx-auto">
          <motion.div
            className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-sm p-8 md:p-12 text-center"
            initial={{ opacity: 0, scale: 0.97 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <Brain className="w-10 h-10 text-accent mx-auto mb-4" />
            <h2 className="text-2xl sm:text-3xl font-bold mb-4 tracking-tight">
              Designed for how your brain actually works
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-8 text-left">
              {[
                {
                  icon: Zap,
                  title: "Low-friction capture",
                  desc: "Voice dumps, quick-add, brain dump inbox — capture thoughts before they vanish.",
                },
                {
                  icon: Brain,
                  title: '"What now?" guidance',
                  desc: "AI picks your next best task based on energy, time, and priority.",
                },
                {
                  icon: Shield,
                  title: "Gentle accountability",
                  desc: "Streak tracking, nudges, and celebrations — not guilt.",
                },
              ].map((item) => (
                <div key={item.title} className="flex flex-col gap-2">
                  <item.icon className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold text-sm">{item.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 px-4 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-3xl sm:text-4xl font-bold mb-4 tracking-tight">
            Ready to take control?
          </h2>
          <p className="text-muted-foreground mb-8 text-lg">
            Free to start. No credit card required.
          </p>
          <Button size="lg" className="gap-2 px-10 text-base" asChild>
            <Link to="/auth">
              <Sparkles className="w-4 h-4" />
              Get Started Free
            </Link>
          </Button>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-8 px-4 text-center text-sm text-muted-foreground">
        <p>© {new Date().getFullYear()} DarAI. Built with ❤️ for busy minds.</p>
      </footer>
    </div>
  );
}
