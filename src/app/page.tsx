'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { motion, useScroll, useTransform, useMotionValueEvent, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  BookOpen,
  GraduationCap,
  ShieldCheck,
  Users,
  CalendarCheck,
  IndianRupee,
  BarChart3,
  School,
  Sparkles,
  ChevronRight,
  UserRoundPlus,
  Zap,
  CheckCircle2,
  Lock,
  Layers
} from 'lucide-react'
import { Button } from '@/components/ui/button'

const SCROLL_HIGHLIGHTS = [
  {
    tag: "Speed & Efficiency",
    title: "Lightning fast execution.",
    desc: "Built on edge-computing architecture. No more waiting for attendance sheets or financial reports to load. Everything happens instantly, saving hours per week.",
    float1: { icon: CheckCircle2, text: "Fees Collected", sub: "Just now", color: "text-emerald-400", bg: "bg-emerald-500/20" },
    float2: { icon: CalendarCheck, text: "Class X marked", sub: "100% Present", color: "text-blue-400", bg: "bg-blue-500/20" }
  },
  {
    tag: "Intuitive Design",
    title: "Consumer-grade experience.",
    desc: "Most school software is clunky and hard to learn. EduNexus brings a clean, modern interface that requires near-zero training for your staff and teachers to master.",
    float1: { icon: Sparkles, text: "UI Updated", sub: "Clean & Modern", color: "text-amber-400", bg: "bg-amber-500/20" },
    float2: { icon: Users, text: "Staff Onboarded", sub: "No training needed", color: "text-pink-400", bg: "bg-pink-500/20" }
  },
  {
    tag: "Enterprise Security",
    title: "Robust data protection.",
    desc: "Row Level Security (RLS) combined with strict role-based access control (RBAC) ensures your school's data remains safe, compliant, and completely isolated.",
    float1: { icon: Lock, text: "Access Granted", sub: "Teacher Role", color: "text-violet-400", bg: "bg-violet-500/20" },
    float2: { icon: ShieldCheck, text: "Data Encrypted", sub: "Secure Vault", color: "text-cyan-400", bg: "bg-cyan-500/20" }
  },
  {
    tag: "Fully Managed",
    title: "Zero IT overhead.",
    desc: "Powered by a robust cloud infrastructure. No servers to maintain, no manual backups to schedule, no painful upgrades. We handle the complexity for you.",
    float1: { icon: Layers, text: "Cloud Sync", sub: "Status: Optimal", color: "text-emerald-400", bg: "bg-emerald-500/20" },
    float2: { icon: Zap, text: "Auto-scaled", sub: "Resources optimized", color: "text-orange-400", bg: "bg-orange-500/20" }
  }
]

export default function LandingPage() {
  const targetRef = useRef<HTMLDivElement>(null)
  const featuresRef = useRef<HTMLDivElement>(null)
  
  const { scrollYProgress } = useScroll({
    target: targetRef,
    offset: ['start start', 'end start'],
  })

  const { scrollYProgress: featuresScrollY } = useScroll({
    target: featuresRef,
    offset: ['start start', 'end end'],
  })
  
  const [activeIndex, setActiveIndex] = useState(0)

  useMotionValueEvent(featuresScrollY, 'change', (latest) => {
    if (latest < 0.25) setActiveIndex(0)
    else if (latest < 0.50) setActiveIndex(1)
    else if (latest < 0.75) setActiveIndex(2)
    else setActiveIndex(3)
  })

  const activeHighlight = SCROLL_HIGHLIGHTS[activeIndex] ?? SCROLL_HIGHLIGHTS[0]!
  
  const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0])
  const y = useTransform(scrollYProgress, [0, 0.5], [0, 100])

  return (
    <div className="min-h-screen bg-[#020202] text-white selection:bg-blue-500/30 font-sans relative">
      {/* Animated Dynamic Background */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <motion.div 
          animate={{ 
            scale: [1, 1.1, 1],
            opacity: [0.15, 0.25, 0.15],
            rotate: [0, 90, 0]
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute -top-[20%] -left-[10%] h-[70vh] w-[70vw] rounded-full bg-blue-600/20 blur-[120px]" 
        />
        <motion.div 
          animate={{ 
            scale: [1, 1.2, 1],
            opacity: [0.1, 0.2, 0.1],
            rotate: [0, -90, 0]
          }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          className="absolute top-[40%] -right-[20%] h-[80vh] w-[60vw] rounded-full bg-violet-600/20 blur-[130px]" 
        />
      </div>

      {/* Navbar */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-white/[0.05] bg-[#020202]/70 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 shadow-lg shadow-blue-500/20">
              <ShieldCheck className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-400">EduNexus</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-zinc-400">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#stats" className="hover:text-white transition-colors">Impact</a>
            <a href="#roles" className="hover:text-white transition-colors">For Who</a>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm font-medium text-zinc-300 hover:text-white transition-colors">
              Sign In
            </Link>
            <Button asChild className="hidden sm:inline-flex bg-blue-600 hover:bg-blue-500 text-white rounded-full px-5 shadow-lg shadow-blue-600/20 transition-all hover:scale-105 border-0">
              <Link href="#get-started">Join EduNexus</Link>
            </Button>
          </div>
        </div>
      </nav>

      <main className="relative z-10 pt-16">
        {/* Hero Section */}
        <section ref={targetRef} className="relative min-h-[90vh] flex flex-col items-center justify-center px-6 text-center pt-20 pb-32">
          <motion.div style={{ opacity, y }} className="flex flex-col items-center w-full max-w-5xl z-10 relative">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, type: 'spring' }}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-300 text-xs font-semibold uppercase tracking-wider mb-8 backdrop-blur-md"
            >
              <Sparkles className="h-4 w-4" /> The Future of School Management
            </motion.div>
            
            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.1, ease: 'easeOut' }}
              className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-br from-white via-zinc-200 to-zinc-600 leading-[1.1] pb-2"
            >
              Connecting Every Layer of Your School.
            </motion.h1>
            
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="mt-6 text-lg md:text-xl text-zinc-400 max-w-2xl font-light leading-relaxed"
            >
              Digitize and streamline operations, academics, and finances in one beautifully designed, secure platform build for modern education.
            </motion.p>
            
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.5 }}
              className="mt-10 flex flex-col sm:flex-row gap-4 w-full justify-center"
            >
              <Button asChild size="lg" className="rounded-full h-14 px-8 text-base bg-blue-600 hover:bg-blue-500 text-white border-0 shadow-[0_0_40px_rgba(37,99,235,0.3)] hover:shadow-[0_0_60px_rgba(37,99,235,0.5)] transition-all hover:scale-105 cursor-pointer">
                <Link href="#get-started">
                  Access Portal <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="rounded-full h-14 px-8 text-base border-white/[0.1] bg-white/[0.03] hover:bg-white/[0.08] text-white backdrop-blur-md transition-all hover:scale-105 cursor-pointer">
                <a href="mailto:sales@edunexus.app?subject=Demo%20Request">
                  Book a Demo
                </a>
              </Button>
            </motion.div>
          </motion.div>
          
          {/* Trusted By / Stats Ribbon */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 0.8 }}
            className="absolute bottom-10 inset-x-0 z-0"
          >
            <div className="max-w-4xl mx-auto px-6 border-t border-white/[0.05] pt-8 flex flex-wrap justify-center gap-8 md:gap-24 text-center">
              <div>
                <h4 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-blue-600">99.9%</h4>
                <p className="text-xs text-zinc-500 uppercase tracking-widest mt-1">Uptime SLA</p>
              </div>
              <div>
                <h4 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-violet-400 to-violet-600">Enterprise</h4>
                <p className="text-xs text-zinc-500 uppercase tracking-widest mt-1">Grade Security</p>
              </div>
              <div>
                <h4 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-emerald-600">Real-time</h4>
                <p className="text-xs text-zinc-500 uppercase tracking-widest mt-1">Data Sync</p>
              </div>
            </div>
          </motion.div>
        </section>

        {/* Value Prop Modules Bento Grid */}
        <section id="features" className="py-32 px-6 max-w-7xl mx-auto relative z-10">
          <div className="text-center mb-16">
            <h2 className="text-sm font-semibold text-blue-400 tracking-wider uppercase mb-3">Capabilities</h2>
            <h3 className="text-4xl md:text-5xl font-black tracking-tight">Everything a school needs.</h3>
            <p className="mt-4 text-zinc-400 max-w-2xl mx-auto text-lg">A unified ecosystem that replaces dozens of fragmented tools, saving time and resources.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: Users, title: 'Student Management', desc: 'Complete profiles, admissions, and document handling with ease.', color: 'from-blue-500/20 to-blue-500/5', border: 'hover:border-blue-500/30', iconColor: 'text-blue-400', bg: 'bg-blue-500/10' },
              { icon: CalendarCheck, title: 'Smart Attendance', desc: 'Fast daily marking, class views, and automated parent alerts for absences.', color: 'from-violet-500/20 to-violet-500/5', border: 'hover:border-violet-500/30', iconColor: 'text-violet-400', bg: 'bg-violet-500/10' },
              { icon: IndianRupee, title: 'Fees & Billing', desc: 'POS interface for fast collection, pending tracking, and digital receipts.', color: 'from-emerald-500/20 to-emerald-500/5', border: 'hover:border-emerald-500/30', iconColor: 'text-emerald-400', bg: 'bg-emerald-500/10' },
              { icon: BookOpen, title: 'Academics & Exams', desc: 'Manage subjects, seamless mark entry, and dynamic report cards.', color: 'from-cyan-500/20 to-cyan-500/5', border: 'hover:border-cyan-500/30', iconColor: 'text-cyan-400', bg: 'bg-cyan-500/10' },
              { icon: GraduationCap, title: 'Teacher Portals', desc: 'Dedicated tools for staff to manage their classes and focus on teaching.', color: 'from-indigo-500/20 to-indigo-500/5', border: 'hover:border-indigo-500/30', iconColor: 'text-indigo-400', bg: 'bg-indigo-500/10' },
              { icon: BarChart3, title: 'Analytics Dashboard', desc: 'Real-time financial, attendance, and academic insights for school leaders.', color: 'from-amber-500/20 to-amber-500/5', border: 'hover:border-amber-500/30', iconColor: 'text-amber-400', bg: 'bg-amber-500/10' },
            ].map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
                className={`group p-8 rounded-3xl bg-white/[0.02] border border-white/[0.08] ${feature.border} transition-all cursor-default relative overflow-hidden`}
              >
                <div className={`absolute -right-10 -top-10 w-40 h-40 bg-gradient-to-br ${feature.color} blur-[50px] opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
                <div className={`h-14 w-14 rounded-2xl ${feature.bg} flex items-center justify-center mb-6 border border-white/5 group-hover:scale-110 transition-transform duration-300 relative z-10`}>
                  <feature.icon className={`h-7 w-7 ${feature.iconColor}`} />
                </div>
                <h4 className="text-xl font-bold mb-3 relative z-10">{feature.title}</h4>
                <p className="text-zinc-400 leading-relaxed text-sm relative z-10">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Platform Highlight / Differentiator Section (Scroll Animation) */}
        <section ref={featuresRef} className="relative h-[300vh] border-t border-white/[0.05]">
          <div className="sticky top-0 h-screen flex items-center px-6 max-w-7xl mx-auto z-10 overflow-hidden">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center w-full">
              
              <div className="relative h-[300px]">
                <AnimatePresence mode="wait">
                  <motion.div 
                    key={activeIndex}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.4 }}
                    className="absolute inset-0 flex flex-col justify-center"
                  >
                    <div>
                      <h2 className="text-sm font-semibold text-violet-400 tracking-wider uppercase mb-3">{activeHighlight.tag}</h2>
                      <h3 className="text-4xl md:text-5xl font-black tracking-tight leading-tight">{activeHighlight.title}</h3>
                      <p className="mt-6 text-zinc-400 text-lg leading-relaxed">
                        {activeHighlight.desc}
                      </p>
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>

              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-tr from-blue-600/20 to-violet-600/20 blur-[80px] rounded-full" />
                <div className="relative rounded-[2rem] bg-zinc-900 border border-white/10 p-2 shadow-2xl overflow-hidden h-[400px]">
                  <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
                  <div className="rounded-[1.5rem] bg-[#050505] p-6 lg:p-10 border border-white/5 relative z-10 h-full flex flex-col justify-center">
                    
                    {/* Abstract UI representation */}
                    <div className="space-y-4 w-full opacity-60">
                      <div className="h-8 w-1/3 bg-white/5 rounded-lg mb-8" />
                      <div className="flex gap-4 h-24">
                        <div className="w-2/3 bg-blue-500/10 border border-blue-500/20 rounded-xl" />
                        <div className="w-1/3 bg-violet-500/10 border border-violet-500/20 rounded-xl" />
                      </div>
                      <div className="flex gap-4 h-20">
                        <div className="w-1/4 bg-white/5 rounded-xl" />
                        <div className="w-3/4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl" />
                      </div>
                      <div className="h-10 w-full bg-white/5 rounded-xl mt-4" />
                    </div>
                    
                    <AnimatePresence>
                      {SCROLL_HIGHLIGHTS.map((h, i) => i === activeIndex && (
                        <div key={`float-${i}`}>
                          <motion.div 
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0, y: [0, -10, 0] }}
                            exit={{ opacity: 0, x: 20 }}
                            transition={{ y: { duration: 4, repeat: Infinity, ease: "easeInOut" }, opacity: { duration: 0.3 }, x: { duration: 0.3 } }}
                            className="absolute -right-6 top-1/4 bg-zinc-800 border border-white/10 p-4 rounded-2xl shadow-xl flex items-center gap-3 backdrop-blur-md"
                          >
                            <div className={`h-8 w-8 rounded-full ${h.float1.bg} flex items-center justify-center`}>
                              <h.float1.icon className={`h-4 w-4 ${h.float1.color}`} />
                            </div>
                            <div>
                              <p className="text-sm font-bold truncate leading-tight">{h.float1.text}</p>
                              <p className="text-xs text-zinc-400 mt-0.5">{h.float1.sub}</p>
                            </div>
                          </motion.div>

                          <motion.div 
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0, y: [0, 10, 0] }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ y: { duration: 5, repeat: Infinity, ease: "easeInOut" }, opacity: { duration: 0.3 }, x: { duration: 0.3 } }}
                            className="absolute -left-6 bottom-1/4 bg-zinc-800 border border-white/10 p-4 rounded-2xl shadow-xl flex items-center gap-3 backdrop-blur-md"
                          >
                            <div className={`h-8 w-8 rounded-full ${h.float2.bg} flex items-center justify-center`}>
                              <h.float2.icon className={`h-4 w-4 ${h.float2.color}`} />
                            </div>
                            <div>
                              <p className="text-sm font-bold truncate leading-tight">{h.float2.text}</p>
                              <p className="text-xs text-zinc-400 mt-0.5">{h.float2.sub}</p>
                            </div>
                          </motion.div>
                        </div>
                      ))}
                    </AnimatePresence>

                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Roles / Get Started Flow */}
        <section id="roles" className="py-24 px-6 relative overflow-hidden border-t border-white/[0.05]">
          <div className="max-w-7xl mx-auto relative z-10">
            <div className="text-center mb-16">
              <h2 className="text-sm font-semibold text-violet-400 tracking-widest uppercase mb-2">Access Portal</h2>
              <h3 className="text-3xl md:text-5xl font-black tracking-tight">Choose your journey</h3>
              <p className="mt-4 text-zinc-400 max-w-2xl mx-auto">A hyper-personalized workspace for every role. Select your portal to proceed.</p>
            </div>

            <div id="get-started" className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
              
              {/* Parent */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                whileHover={{ y: -8 }}
                className="flex flex-col p-8 rounded-[2rem] bg-zinc-900/50 backdrop-blur-sm border border-white/[0.08] hover:border-white/[0.2] transition-all"
              >
                <div className="h-14 w-14 rounded-2xl bg-zinc-800 flex items-center justify-center mb-6">
                  <UserRoundPlus className="h-7 w-7 text-zinc-300" />
                </div>
                <h4 className="text-2xl font-bold mb-3">Parents</h4>
                <p className="text-zinc-400 text-sm mb-8 flex-1 leading-relaxed">
                  Track attendance, view exams, and pay fees. Activate using your school-registered email or phone.
                </p>
                <div className="space-y-3">
                  <Button asChild className="w-full bg-white text-black hover:bg-zinc-200 rounded-xl h-12 font-semibold">
                    <Link href="/create-account">Activate Account</Link>
                  </Button>
                  <Button asChild variant="outline" className="w-full border-white/10 bg-transparent hover:bg-white/5 text-white rounded-xl h-12">
                    <Link href="/login">Log In</Link>
                  </Button>
                </div>
              </motion.div>

              {/* Staff / Teacher */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 }}
                whileHover={{ y: -8 }}
                className="flex flex-col p-8 rounded-[2rem] bg-gradient-to-b from-blue-900/30 to-zinc-900/50 backdrop-blur-sm border border-blue-500/30 hover:border-blue-500/60 transition-all shadow-[0_0_50px_rgba(37,99,235,0.15)] relative overflow-hidden"
              >
                <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-blue-400 to-blue-600"></div>
                <div className="h-14 w-14 rounded-2xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center mb-6">
                  <GraduationCap className="h-7 w-7 text-blue-400" />
                </div>
                <h4 className="text-2xl font-bold mb-3 text-blue-50">Teachers & Staff</h4>
                <p className="text-blue-200/70 text-sm mb-8 flex-1 leading-relaxed">
                  Mark attendance, grade exams, and manage classes. Access is provided exclusively by administrators.
                </p>
                <div className="space-y-3 mt-auto">
                  <Button asChild className="w-full bg-blue-600 hover:bg-blue-500 text-white rounded-xl h-12 font-semibold shadow-lg shadow-blue-900/20">
                    <Link href="/login">Staff Sign In</Link>
                  </Button>
                  <p className="text-xs text-center text-blue-300/40 pt-2 font-medium">
                    Forgot password? Ask your principal.
                  </p>
                </div>
              </motion.div>

              {/* School Admin */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2 }}
                whileHover={{ y: -8 }}
                className="flex flex-col p-8 rounded-[2rem] bg-zinc-900/50 backdrop-blur-sm border border-white/[0.08] hover:border-white/[0.2] transition-all"
              >
                <div className="h-14 w-14 rounded-2xl bg-zinc-800 flex items-center justify-center mb-6">
                  <School className="h-7 w-7 text-zinc-300" />
                </div>
                <h4 className="text-2xl font-bold mb-3">Schools</h4>
                <p className="text-zinc-400 text-sm mb-8 flex-1 leading-relaxed">
                  Run your institution seamlessly. EduNexus for enterprises is available via guided onboarding.
                </p>
                <div className="space-y-3">
                  <Button asChild className="w-full bg-white text-black hover:bg-zinc-200 rounded-xl h-12 font-semibold">
                    <Link href="/login">Admin Sign In</Link>
                  </Button>
                  <Button asChild variant="outline" className="w-full border-white/10 bg-transparent hover:bg-white/5 text-white rounded-xl h-12 group">
                    <a href="mailto:sales@edunexus.app?subject=Demo%20Request">
                      Schedule Demo <ChevronRight className="ml-1 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                    </a>
                  </Button>
                </div>
              </motion.div>

            </div>
          </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="border-t border-white/[0.05] bg-[#020202] py-14 px-6 mt-12 relative z-10">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-800">
               <ShieldCheck className="h-4 w-4 text-zinc-400" />
            </div>
            <span className="font-bold text-lg text-zinc-200 tracking-tight">EduNexus</span>
          </div>
          <div className="flex gap-8 text-sm font-medium text-zinc-500">
            <a href="#" className="hover:text-zinc-300 transition-colors">Privacy</a>
            <a href="#" className="hover:text-zinc-300 transition-colors">Terms</a>
            <a href="mailto:support@edunexus.app" className="hover:text-zinc-300 transition-colors">Support</a>
          </div>
          <p className="text-xs text-zinc-600 font-medium">
            © {new Date().getFullYear()} EduNexus Inc. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}
