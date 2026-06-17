'use client'

import { useRef } from 'react'
import Link from 'next/link'
import { motion, useScroll, useTransform } from 'framer-motion'
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
} from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function LandingPage() {
  const targetRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: targetRef,
    offset: ['start start', 'end start'],
  })
  
  const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0])
  const y = useTransform(scrollYProgress, [0, 0.5], [0, 100])

  return (
    <div className="min-h-screen bg-[#050505] text-white selection:bg-blue-500/30 font-sans overflow-x-hidden">
      {/* Dynamic Background */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-[20%] -left-[10%] h-[70vh] w-[70vw] rounded-full bg-blue-900/10 blur-[120px]" />
        <div className="absolute top-[40%] -right-[20%] h-[60vh] w-[60vw] rounded-full bg-violet-900/10 blur-[120px]" />
      </div>

      {/* Navbar */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-white/[0.05] bg-[#050505]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
              <ShieldCheck className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight">EduNexus</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-zinc-400">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#roles" className="hover:text-white transition-colors">For Who</a>
            <a href="#get-started" className="hover:text-white transition-colors">Get Started</a>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm font-medium text-zinc-300 hover:text-white transition-colors">
              Sign In
            </Link>
            <Button asChild className="hidden sm:inline-flex bg-blue-600 hover:bg-blue-500 text-white rounded-full px-5">
              <Link href="#get-started">Join EduNexus</Link>
            </Button>
          </div>
        </div>
      </nav>

      <main className="relative z-10 pt-16">
        {/* Hero Section */}
        <section ref={targetRef} className="relative min-h-[90vh] flex flex-col items-center justify-center px-6 text-center">
          <motion.div style={{ opacity, y }} className="flex flex-col items-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-blue-500/20 bg-blue-500/10 text-blue-300 text-xs font-semibold uppercase tracking-wider mb-6"
            >
              <Sparkles className="h-3.5 w-3.5" /> Platform Reimagined
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-br from-white via-white to-zinc-500 max-w-5xl leading-tight"
            >
              Connecting Every Layer of School Management.
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="mt-6 text-lg md:text-xl text-zinc-400 max-w-2xl font-light leading-relaxed"
            >
              Digitize and streamline every operational, academic, and financial workflow from a single, static, and secure platform designed for modern schools.
            </motion.p>
            
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="mt-10 flex flex-col sm:flex-row gap-4"
            >
              <Button asChild size="lg" className="rounded-full h-14 px-8 text-base bg-blue-600 hover:bg-blue-500 text-white border-0 cursor-pointer">
                <Link href="#get-started">
                  Access Your Portal <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="rounded-full h-14 px-8 text-base border-white/[0.1] bg-white/[0.02] hover:bg-white/[0.05] text-white backdrop-blur-sm cursor-pointer">
                <a href="mailto:sales@edunexus.app?subject=Demo%20Request&body=Hi%20EduNexus%20Team%2C%0A%0AI%20am%20interested%20in%20a%20demo%20for%20our%20school.">
                  Book a Demo
                </a>
              </Button>
            </motion.div>
          </motion.div>
        </section>

        {/* Value Prop Modules Grid */}
        <section id="features" className="py-24 px-6 max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-sm font-semibold text-blue-400 tracking-wider uppercase mb-2">Capabilities</h2>
            <h3 className="text-3xl md:text-5xl font-bold tracking-tight">Everything a school needs.</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: Users, title: 'Student Management', desc: 'Complete profiles, admissions, and document handling with ease.' },
              { icon: CalendarCheck, title: 'Attendance', desc: 'Fast daily marking, class views, and automated parent alerts for absences.' },
              { icon: IndianRupee, title: 'Fees & Billing', desc: 'POS interface for fast collection, pending tracking, and digital receipts.' },
              { icon: BookOpen, title: 'Academics & Exams', desc: 'Manage subjects, seamless mark entry, and dynamic report cards.' },
              { icon: GraduationCap, title: 'Teacher Portals', desc: 'Dedicated tools for staff to manage their classes and focus on teaching.' },
              { icon: BarChart3, title: 'Analytics Dashboard', desc: 'Real-time financial, attendance, and academic insights for school leaders.' },
            ].map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="group p-8 rounded-3xl bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.04] hover:border-blue-500/30 transition-all cursor-default"
              >
                <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-blue-500/20 to-violet-500/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <feature.icon className="h-6 w-6 text-blue-400" />
                </div>
                <h4 className="text-xl font-semibold mb-2">{feature.title}</h4>
                <p className="text-zinc-400 leading-relaxed text-sm">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Roles / Get Started Flow */}
        <section id="get-started" className="py-24 px-6 relative overflow-hidden">
          <div className="max-w-7xl mx-auto relative z-10">
            <div className="text-center mb-16">
              <h2 className="text-sm font-semibold text-violet-400 tracking-wider uppercase mb-2">Access Portal</h2>
              <h3 className="text-3xl md:text-5xl font-bold tracking-tight">Choose your journey</h3>
              <p className="mt-4 text-zinc-400 max-w-2xl mx-auto">EduNexus is a secure, curated ecosystem. Select your role to reach your personalized dashboard.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
              
              {/* Parent */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                whileHover={{ y: -5 }}
                className="flex flex-col p-8 rounded-3xl bg-gradient-to-b from-white/[0.04] to-transparent border border-white/[0.05] hover:border-white/[0.1] transition-all"
              >
                <div className="h-14 w-14 rounded-2xl bg-white/10 flex items-center justify-center mb-6">
                  <UserRoundPlus className="h-7 w-7 text-white" />
                </div>
                <h4 className="text-2xl font-bold mb-3">Parents</h4>
                <p className="text-zinc-400 text-sm mb-8 flex-1 leading-relaxed">
                  Track attendance, view exam results, and pay fees online. You need your school-registered email or phone to activate.
                </p>
                <div className="space-y-3">
                  <Button asChild className="w-full bg-white text-black hover:bg-zinc-200 rounded-xl h-11 cursor-pointer">
                    <Link href="/create-account">Activate Account</Link>
                  </Button>
                  <Button asChild variant="outline" className="w-full border-white/10 bg-transparent hover:bg-white/5 rounded-xl h-11 cursor-pointer">
                    <Link href="/login">Log In</Link>
                  </Button>
                </div>
              </motion.div>

              {/* Staff / Teacher */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ delay: 0.1 }}
                whileHover={{ y: -5 }}
                className="flex flex-col p-8 rounded-3xl bg-gradient-to-b from-blue-900/20 to-transparent border border-blue-500/20 hover:border-blue-500/40 transition-all shadow-[0_0_40px_rgba(37,99,235,0.1)]"
              >
                <div className="h-14 w-14 rounded-2xl bg-blue-500/20 flex items-center justify-center mb-6">
                  <GraduationCap className="h-7 w-7 text-blue-400" />
                </div>
                <h4 className="text-2xl font-bold mb-3 text-blue-50">Teachers & Staff</h4>
                <p className="text-blue-200/60 text-sm mb-8 flex-1 leading-relaxed">
                  Access your classes, mark attendance, and grade exams. Your account is provided exclusively by your school administrator.
                </p>
                <div className="space-y-3">
                  <Button asChild className="w-full bg-blue-600 hover:bg-blue-500 text-white rounded-xl h-11 cursor-pointer">
                    <Link href="/login">Staff Portal Sign In</Link>
                  </Button>
                  <p className="text-xs text-center text-blue-300/50 pt-2">
                    Forgot password? Contact your school principal.
                  </p>
                </div>
              </motion.div>

              {/* School Admin */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ delay: 0.2 }}
                whileHover={{ y: -5 }}
                className="flex flex-col p-8 rounded-3xl bg-gradient-to-b from-white/[0.04] to-transparent border border-white/[0.05] hover:border-white/[0.1] transition-all"
              >
                <div className="h-14 w-14 rounded-2xl bg-white/10 flex items-center justify-center mb-6">
                  <School className="h-7 w-7 text-white" />
                </div>
                <h4 className="text-2xl font-bold mb-3">Schools</h4>
                <p className="text-zinc-400 text-sm mb-8 flex-1 leading-relaxed">
                  Run your entire institution seamlessly. EduNexus is an enterprise platform, available via guided onboarding.
                </p>
                <div className="space-y-3">
                  <Button asChild className="w-full bg-white text-black hover:bg-zinc-200 rounded-xl h-11 cursor-pointer">
                    <Link href="/login">Admin Sign In</Link>
                  </Button>
                  <Button asChild variant="outline" className="w-full border-white/10 bg-transparent hover:bg-white/5 rounded-xl h-11 group cursor-pointer">
                    <a href="mailto:sales@edunexus.app?subject=Demo%20Request&body=Hi%20EduNexus%20Team%2C%0A%0AI%20am%20interested%20in%20a%20demo%20for%20our%20school.">
                      Schedule Demo <ChevronRight className="ml-1 h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
                    </a>
                  </Button>
                </div>
              </motion.div>

            </div>
          </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="border-t border-white/[0.05] bg-[#020202] py-12 px-6 mt-12 relative z-10">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-blue-500" />
            <span className="font-semibold text-lg">EduNexus</span>
          </div>
          <div className="flex gap-6 text-sm text-zinc-500">
            <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
            <a href="mailto:support@edunexus.app" className="hover:text-white transition-colors">Support</a>
          </div>
          <p className="text-xs text-zinc-600">
            © {new Date().getFullYear()} EduNexus Inc. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}
