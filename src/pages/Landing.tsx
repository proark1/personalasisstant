import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Activity,
  ArrowRight,
  BadgeCheck,
  Bell,
  Bot,
  Brain,
  Calendar,
  CheckCircle2,
  CheckSquare,
  Clock,
  FileText,
  Heart,
  LayoutDashboard,
  LockKeyhole,
  Mail,
  Mic,
  Route,
  Shield,
  Sparkles,
  Target,
  Users,
  Wallet,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import doriFish from "@/assets/dori-fish.png";

type Feature = {
  icon: LucideIcon;
  title: string;
  description: string;
  detail: string;
  className: string;
};

type WorkflowStep = {
  icon: LucideIcon;
  title: string;
  description: string;
};

const navItems = [
  { label: "Assistant", href: "#assistant" },
  { label: "Outcomes", href: "#outcomes" },
  { label: "Trust", href: "#trust" },
];

const features: Feature[] = [
  {
    icon: Brain,
    title: "Turns chaos into a plan",
    description:
      "Drop in the messy version. Dori turns it into a realistic next move you can start now.",
    detail: "Daily focus",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  {
    icon: Calendar,
    title: "Protects your schedule",
    description:
      "Meetings, deadlines, prep work, and conflicts stay visible before they become urgent.",
    detail: "Time aware",
    className: "bg-sky-50 text-sky-700 border-sky-200",
  },
  {
    icon: Users,
    title: "Runs family logistics",
    description: "Meals, shopping, school notes, and shared reminders move through one assistant.",
    detail: "Shared context",
    className: "bg-violet-50 text-violet-700 border-violet-200",
  },
  {
    icon: Heart,
    title: "Keeps routines alive",
    description:
      "Health signals, habits, mood, sleep, and daily check-ins become practical nudges instead of another dashboard.",
    detail: "Gentle nudges",
    className: "bg-rose-50 text-rose-700 border-rose-200",
  },
  {
    icon: Wallet,
    title: "Catches money leaks",
    description:
      "Subscriptions, renewals, bills, and contracts surface while there is still time to act.",
    detail: "Cost control",
    className: "bg-amber-50 text-amber-700 border-amber-200",
  },
  {
    icon: Shield,
    title: "Understands your context",
    description:
      "DarAI works from your authenticated workspace, history, and connected daily context.",
    detail: "Personalized",
    className: "bg-slate-50 text-slate-700 border-slate-200",
  },
];

const workflow: WorkflowStep[] = [
  {
    icon: Mic,
    title: "Say what is on your mind",
    description: "Voice, type, or brain-dump the messy version. Dori can work with that.",
  },
  {
    icon: Route,
    title: "Dori checks the real context",
    description:
      "Tasks, calendar, family, health, contracts, and email signals are connected before advice is given.",
  },
  {
    icon: Target,
    title: "You get a clear next move",
    description:
      "The assistant gives priorities, prep, reminders, and follow-ups without adding decision fatigue.",
  },
];

const proofPoints = [
  { label: "Tasks, calendar, family, health", value: "10+", icon: LayoutDashboard },
  { label: "Actions Dori can prepare", value: "22", icon: Bot },
  { label: "Daily plan status", value: "Ready", icon: Activity },
];

const assistantTasks = [
  { label: "Move dentist prep to tomorrow", status: "Handled", icon: CheckCircle2 },
  { label: "Flag contract renewal window", status: "Needs action", icon: FileText },
  { label: "Build family dinner list", status: "Ready", icon: Users },
];

const salesHighlights = [
  "Plan the day in minutes, not mental loops",
  "Catch renewals, tasks, and appointments before they slip",
  "Give your family one assistant for shared follow-through",
];

const stagger = {
  container: {
    hidden: {},
    show: { transition: { staggerChildren: 0.08, delayChildren: 0.12 } },
  },
  item: {
    hidden: { opacity: 0, y: 18 },
    show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: "easeOut" } },
  },
};

function LogoMark({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <div
      className={`${className} flex items-center justify-center rounded-[8px] bg-primary text-primary-foreground shadow-lg shadow-primary/20`}
    >
      <Sparkles className="h-4 w-4" />
    </div>
  );
}

function ProductPreview() {
  return (
    <Link
      to="/auth?mode=signup"
      className="group relative mx-auto block w-full max-w-5xl rounded-[8px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      aria-label="Create your DarAI account from the product preview"
    >
      <div className="relative overflow-hidden rounded-[8px] border border-border bg-card shadow-2xl shadow-foreground/10 transition-transform duration-200 group-hover:-translate-y-1">
        <div className="flex h-10 items-center justify-between border-b border-border bg-muted/40 px-4">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
          </div>
          <div className="hidden rounded-full border border-border bg-background px-3 py-1 text-xs text-muted-foreground sm:block">
            Dori assistant workspace
          </div>
        </div>

        <div className="grid min-h-[430px] grid-cols-1 bg-background lg:grid-cols-[156px_1fr] 2xl:grid-cols-[170px_1fr_260px]">
          <div className="hidden border-r border-border bg-muted/25 p-3 lg:block">
            <div className="mb-8 flex items-center gap-2">
              <LogoMark className="h-7 w-7" />
              <div>
                <p className="text-sm font-semibold">DarAI</p>
                <p className="text-xs text-muted-foreground">AI assistant</p>
              </div>
            </div>

            <div className="space-y-1.5">
              {[
                { icon: LayoutDashboard, label: "Overview", active: true },
                { icon: CheckSquare, label: "Tasks" },
                { icon: Calendar, label: "Calendar" },
                { icon: Heart, label: "Health" },
                { icon: FileText, label: "Contracts" },
              ].map((item) => (
                <div
                  key={item.label}
                  className={`flex items-center gap-2 rounded-[8px] px-3 py-2 text-sm ${
                    item.active
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground"
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="p-4 sm:p-5">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="mb-1 text-sm text-muted-foreground">Today</p>
                <h2 className="text-xl font-semibold sm:text-2xl">Dori built your next move.</h2>
              </div>
              <div className="flex w-fit items-center gap-2 rounded-[8px] border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                <BadgeCheck className="h-4 w-4" />
                <span>Plan ready</span>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {proofPoints.map((point) => (
                <div key={point.label} className="rounded-[8px] border border-border bg-card p-3">
                  <point.icon className="mb-2 h-5 w-5 text-primary" />
                  <p className="text-xl font-semibold">{point.value}</p>
                  <p className="text-xs text-muted-foreground">{point.label}</p>
                </div>
              ))}
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_190px]">
              <div className="rounded-[8px] border border-border bg-card p-4">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">Priority stack</h3>
                    <p className="text-xs text-muted-foreground">
                      Ordered by time, energy, and risk
                    </p>
                  </div>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="space-y-3">
                  {[
                    {
                      title: "Reply to the high-value email",
                      meta: "12 min - highest leverage",
                      color: "bg-emerald-500",
                      width: "w-10/12",
                    },
                    {
                      title: "Prepare the school form",
                      meta: "Due tomorrow - family",
                      color: "bg-sky-500",
                      width: "w-8/12",
                    },
                  ].map((task) => (
                    <div
                      key={task.title}
                      className="rounded-[8px] border border-border bg-background p-3"
                    >
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium">{task.title}</p>
                          <p className="text-xs text-muted-foreground">{task.meta}</p>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <div className={`h-full rounded-full ${task.color} ${task.width}`} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[8px] border border-border bg-card p-4">
                <div className="mb-4 flex items-center gap-2">
                  <Bell className="h-4 w-4 text-amber-600" />
                  <h3 className="font-semibold">Signals</h3>
                </div>
                <div className="space-y-3 text-sm">
                  <div className="rounded-[8px] bg-amber-50 p-3 text-amber-800">
                    Contract renewal can still be cancelled.
                  </div>
                  <div className="rounded-[8px] bg-sky-50 p-3 text-sky-800">
                    Two calendar blocks can be protected.
                  </div>
                  <div className="rounded-[8px] bg-rose-50 p-3 text-rose-800">
                    Sleep trend is below baseline.
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="hidden border-l border-border bg-muted/20 p-5 2xl:block">
            <div className="mb-5 flex items-center gap-3">
              <div className="h-12 w-12 overflow-hidden rounded-full border border-border bg-background">
                <img
                  src={doriFish}
                  alt="Dori assistant avatar"
                  className="h-full w-full object-cover"
                />
              </div>
              <div>
                <p className="font-semibold">Dori</p>
                <p className="text-xs text-muted-foreground">Personal assistant</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="rounded-[8px] bg-primary p-4 text-sm text-primary-foreground">
                I checked your calendar, open loops, family tasks, and renewal dates. Here is the
                shortest safe plan.
              </div>
              <div className="rounded-[8px] border border-border bg-card p-4 text-sm text-muted-foreground">
                Show me only what needs action.
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {assistantTasks.map((task) => (
                <div
                  key={task.label}
                  className="flex items-center gap-3 rounded-[8px] border border-border bg-card p-3"
                >
                  <task.icon className="h-4 w-4 text-primary" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{task.label}</p>
                    <p className="text-xs text-muted-foreground">{task.status}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="absolute bottom-4 right-4 hidden items-center gap-2 rounded-[8px] border border-border bg-background/95 px-3 py-2 text-sm font-medium text-primary shadow-lg shadow-foreground/10 transition-colors group-hover:bg-primary group-hover:text-primary-foreground lg:flex">
          Open your workspace
          <ArrowRight className="h-4 w-4" />
        </div>
      </div>
    </Link>
  );
}

function MobileAssistantPreview() {
  return (
    <Link
      to="/auth?mode=signup"
      className="mx-auto block w-full max-w-sm rounded-[8px] border border-border bg-card p-4 text-left shadow-xl shadow-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      aria-label="Create your DarAI account from the mobile assistant preview"
    >
      <div className="mb-4 flex items-center gap-3">
        <img
          src={doriFish}
          alt="Dori assistant avatar"
          className="h-12 w-12 rounded-full border border-border bg-background object-cover"
        />
        <div>
          <p className="font-semibold">Dori sorted your day</p>
          <p className="text-sm text-muted-foreground">3 open loops need action</p>
        </div>
      </div>
      <div className="space-y-2">
        {["Today's plan is ready", "Contract renewal flagged", "Family dinner list prepared"].map(
          (item) => (
            <div
              key={item}
              className="flex items-center gap-2 rounded-[8px] border border-border bg-background px-3 py-2 text-sm"
            >
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <span>{item}</span>
            </div>
          ),
        )}
      </div>
      <div className="mt-4 flex items-center gap-2 text-sm font-medium text-primary">
        Open your workspace
        <ArrowRight className="h-4 w-4" />
      </div>
    </Link>
  );
}

export default function Landing() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-border/70 bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          <Link to="/landing" className="flex h-11 items-center gap-3" aria-label="DarAI home">
            <LogoMark />
            <span className="text-lg font-semibold">DarAI</span>
          </Link>

          <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="inline-flex h-11 items-center transition-colors hover:text-foreground"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="h-11 min-h-[44px] text-sm" asChild>
              <Link to="/auth">Log in</Link>
            </Button>
            <Button size="sm" className="h-11 min-h-[44px] gap-1 text-sm" asChild>
              <Link to="/auth?mode=signup">
                Sign up <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <section
        id="assistant"
        className="relative overflow-hidden border-b border-border px-4 pb-7 pt-20 lg:pb-10 lg:pt-24"
      >
        <div
          className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(180deg,hsl(var(--secondary))_0%,hsl(var(--background))_42%,hsl(var(--background))_100%)]"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute inset-0 -z-10 opacity-[0.32] [background-image:linear-gradient(hsl(var(--border))_1px,transparent_1px),linear-gradient(90deg,hsl(var(--border))_1px,transparent_1px)] [background-size:44px_44px]"
          aria-hidden="true"
        />

        <div className="mx-auto max-w-7xl">
          <div className="grid gap-8 lg:grid-cols-[0.88fr_1.12fr] lg:items-center lg:gap-10">
            <motion.div
              className="mx-auto max-w-3xl text-center lg:mx-0 lg:text-left"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            >
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-background px-3 py-1.5 text-sm font-medium text-primary shadow-sm">
                <Zap className="h-4 w-4" />
                Meet Dori, the AI assistant for the work between your apps
              </div>

              <h1 className="text-4xl font-semibold leading-tight sm:text-6xl lg:leading-none xl:text-7xl">
                DarAI AI Assistant
              </h1>

              <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8 lg:mx-0">
                Stop carrying life admin in your head. Dori plans your day, catches what might slip,
                and turns tasks, calendar, email, family, health, and contracts into one clear next
                move.
              </p>

              <div className="mx-auto mt-5 max-w-2xl rounded-[8px] border border-border bg-background/90 p-3 text-left shadow-sm lg:mx-0">
                <p className="text-sm font-medium text-foreground">
                  Try: "What should I focus on today?"
                </p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Dori answers from your calendar, tasks, family reminders, and open loops.
                </p>
              </div>

              <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row lg:justify-start">
                <Button size="lg" className="w-full gap-2 sm:w-auto" asChild>
                  <Link to="/auth?mode=signup">
                    <Sparkles className="h-4 w-4" />
                    Start with Dori
                  </Link>
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="w-full gap-2 bg-background sm:w-auto"
                  asChild
                >
                  <a href="#outcomes">
                    See what Dori does <ArrowRight className="h-4 w-4" />
                  </a>
                </Button>
              </div>

              <div className="mt-5 hidden flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm text-muted-foreground sm:flex lg:justify-start">
                {["Start free", "Private workspace", "Built for daily follow-through"].map(
                  (item) => (
                    <span key={item} className="inline-flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                      {item}
                    </span>
                  ),
                )}
              </div>
              <div className="mt-4 flex justify-center sm:hidden">
                <a
                  href="#trust"
                  className="inline-flex min-h-[44px] items-center gap-1 text-sm font-medium text-primary"
                >
                  Private workspace and trust details
                  <ArrowRight className="h-4 w-4" />
                </a>
              </div>
            </motion.div>

            <motion.div
              className="min-w-0"
              initial={{ opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.12, ease: "easeOut" }}
            >
              <div className="lg:hidden">
                <MobileAssistantPreview />
              </div>
              <div className="hidden lg:block">
                <ProductPreview />
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="border-b border-border bg-card px-4 py-6">
        <div className="mx-auto grid max-w-7xl gap-4 text-sm text-muted-foreground md:grid-cols-3">
          {salesHighlights.map((item) => (
            <div key={item} className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </section>

      <section id="outcomes" className="px-4 py-14 md:py-20">
        <div className="mx-auto max-w-7xl">
          <div className="mb-10 max-w-3xl">
            <p className="mb-3 text-sm font-semibold uppercase text-primary">
              Why people come back every day
            </p>
            <h2 className="text-4xl font-semibold leading-tight">
              One assistant for the things that usually fall between apps.
            </h2>
            <p className="mt-4 text-lg leading-8 text-muted-foreground">
              DarAI gives you time, clarity, and follow-through. Dori gives every part of your life
              a place to land, then helps you act before small misses become expensive.
            </p>
          </div>

          <motion.div
            className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
            variants={stagger.container}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-80px" }}
          >
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                variants={stagger.item}
                className={index > 2 ? "hidden md:block" : undefined}
              >
                <Link
                  to="/auth?mode=signup"
                  className="block h-full rounded-[8px] border border-border bg-card p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  aria-label={`Start with Dori: ${feature.title}`}
                >
                  <div
                    className={`mb-5 inline-flex h-11 w-11 items-center justify-center rounded-[8px] border ${feature.className}`}
                  >
                    <feature.icon className="h-5 w-5" />
                  </div>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h3 className="font-semibold">{feature.title}</h3>
                    <span className="rounded-full border border-border bg-muted px-2 py-1 text-xs text-muted-foreground">
                      {feature.detail}
                    </span>
                  </div>
                  <p className="text-sm leading-6 text-muted-foreground">{feature.description}</p>
                  <div className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-primary">
                    Start with this
                    <ArrowRight className="h-4 w-4" />
                  </div>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      <section className="border-y border-border bg-muted/30 px-4 py-14 md:py-20">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
          <div>
            <p className="mb-3 text-sm font-semibold uppercase text-primary">How Dori works</p>
            <h2 className="text-4xl font-semibold leading-tight">
              From messy thought to finished follow-up.
            </h2>
            <p className="mt-4 text-lg leading-8 text-muted-foreground">
              The assistant is built for the moment you do not want another tool to manage. Capture
              the messy input, let Dori connect the context, then act on the clean version.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {workflow.map((step, index) => (
              <div
                key={step.title}
                className="rounded-[8px] border border-border bg-card p-5 shadow-sm"
              >
                <div className="mb-5 flex items-center justify-between">
                  <div className="flex h-11 w-11 items-center justify-center rounded-[8px] bg-primary/10 text-primary">
                    <step.icon className="h-5 w-5" />
                  </div>
                  <span className="text-sm font-semibold text-muted-foreground">0{index + 1}</span>
                </div>
                <h3 className="mb-2 font-semibold">{step.title}</h3>
                <p className="text-sm leading-6 text-muted-foreground">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="trust" className="px-4 py-14 md:py-20">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1fr_1fr] lg:items-stretch">
          <div className="rounded-[8px] border border-border bg-card p-6 shadow-sm">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-[8px] bg-slate-100 text-slate-700">
                <LockKeyhole className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold uppercase text-primary">Trust layer</p>
                <h2 className="text-3xl font-semibold">
                  Professional enough for your personal data.
                </h2>
              </div>
            </div>
            <p className="text-lg leading-8 text-muted-foreground">
              DarAI handles sensitive context like schedules, family details, health notes, and
              contracts, so the assistant is designed around authenticated access, scoped
              workspaces, and clear operational boundaries.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {[
              {
                icon: LockKeyhole,
                title: "Workspace boundaries",
                desc: "Personal and shared family contexts stay organized by space.",
              },
              {
                icon: Shield,
                title: "Protected app access",
                desc: "Your account gates access before personal modules can load.",
              },
              {
                icon: Mail,
                title: "Email-aware workflows",
                desc: "Summaries and follow-ups are treated as sensitive productivity data.",
              },
              {
                icon: Clock,
                title: "Reliability checks",
                desc: "Automated checks keep issues visible before they reach daily use.",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-[8px] border border-border bg-card p-5 shadow-sm"
              >
                <item.icon className="mb-4 h-5 w-5 text-primary" />
                <h3 className="mb-2 font-semibold">{item.title}</h3>
                <p className="text-sm leading-6 text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 pb-20">
        <div className="mx-auto overflow-hidden rounded-[8px] border border-border bg-foreground text-background shadow-2xl shadow-foreground/15">
          <div className="grid gap-8 p-6 md:p-10 lg:grid-cols-[1fr_360px] lg:items-center">
            <div>
              <p className="mb-3 text-sm font-semibold uppercase text-emerald-200">Start simple</p>
              <h2 className="text-4xl font-semibold leading-tight">
                Let Dori turn today into a plan you can actually follow.
              </h2>
              <p className="mt-4 max-w-2xl text-lg leading-8 text-background/70">
                Use DarAI for one day of tasks, calendar, family reminders, health context, and
                follow-ups. The value shows up when the assistant understands the whole picture.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button size="lg" className="w-full gap-2 sm:w-auto" asChild>
                  <Link to="/auth?mode=signup">
                    <Sparkles className="h-4 w-4" />
                    Start with Dori
                  </Link>
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="w-full border-background/20 bg-transparent text-background hover:bg-background/10 hover:text-background sm:w-auto"
                  asChild
                >
                  <a href="#assistant">Back to preview</a>
                </Button>
              </div>
            </div>

            <div className="rounded-[8px] border border-background/10 bg-background/10 p-5">
              <div className="mb-5 flex items-center gap-3">
                <img
                  src={doriFish}
                  alt="Dori assistant avatar"
                  className="h-14 w-14 rounded-full border border-background/20 bg-background object-cover"
                />
                <div>
                  <p className="font-semibold text-background">Dori is ready</p>
                  <p className="text-sm text-background/75">Planning, reminders, and context</p>
                </div>
              </div>
              <div className="space-y-3 text-sm">
                <div className="rounded-[8px] bg-background p-3 text-foreground">
                  Start with: "What should I focus on today?"
                </div>
                <div className="rounded-[8px] border border-background/15 p-3 text-background/75">
                  Dori will pull together your calendar, tasks, family signals, and open loops.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-border px-4 py-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <LogoMark className="h-8 w-8" />
            <span>&copy; {new Date().getFullYear()} DarAI. Built for busy minds.</span>
          </div>
          <div className="flex gap-4">
            <Link
              to="/auth"
              className="inline-flex min-h-[44px] min-w-[44px] items-center hover:text-foreground"
            >
              Log in
            </Link>
            <a
              href="#trust"
              className="inline-flex min-h-[44px] min-w-[44px] items-center hover:text-foreground"
            >
              Trust
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
