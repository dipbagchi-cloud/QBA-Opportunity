"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Sparkles,
  Zap,
  Shield,
  TrendingUp,
  Users,
  Brain,
  ArrowRight,
  CheckCircle2,
  Bot,
  Workflow,
  BarChart3,
  Lock,
  Heart,
} from "lucide-react";
import Link from "next/link";
import { API_URL } from "@/lib/api";

interface LandingStats {
  totalOpportunities: number;
  uniqueClients: number;
  winRate: number;
  totalPipelineValue: number;
  totalUsers: number;
  closedWon: number;
}

function formatCurrency(val: number): string {
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `$${(val / 1_000).toFixed(0)}K`;
  return `$${val}`;
}

export default function HomePage() {
  const [stats, setStats] = useState<LandingStats | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/api/public/stats`)
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data) setStats(data); })
      .catch(() => {});
  }, []);
  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950 text-white overflow-hidden">
      {/* Animated background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/2 -right-1/2 w-full h-full bg-primary-900/20 rounded-full blur-3xl animate-pulse-glow" />
        <div className="absolute -bottom-1/2 -left-1/2 w-full h-full bg-secondary-900/20 rounded-full blur-3xl animate-pulse-glow animation-delay-200" />
      </div>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center px-6">
        <div className="max-w-7xl mx-auto text-center">
          <div className="space-y-6">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 glass-dark rounded-full border border-primary-500/30">
              <Sparkles className="w-4 h-4 text-primary-400" />
              <span className="text-sm font-medium bg-gradient-to-r from-primary-400 to-secondary-400 bg-clip-text text-transparent">
                Powered by Advanced Agentic AI
              </span>
            </div>

            {/* Main Headline */}
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight">
              <span className="block">Transform Your</span>
              <span className="block bg-gradient-to-r from-primary-400 via-secondary-400 to-accent-400 bg-clip-text text-transparent">
                Sales Pipeline
              </span>
            </h1>

            {/* Subheadline */}
            <p className="text-lg md:text-xl text-neutral-300 max-w-3xl mx-auto leading-relaxed">
              AI-powered CRM that automates workflows, predicts outcomes, and
              accelerates deal closure with autonomous intelligent agents.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-6">
              <Link href="/login">
                <button className="btn-primary px-6 py-3 text-base group transition-transform hover:scale-105 active:scale-95">
                  Get Started
                  <ArrowRight className="inline-block ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
              </Link>
              <Link href="#features">
                <button className="btn-glass px-6 py-3 text-base transition-transform hover:scale-105 active:scale-95">
                  Explore Features
                </button>
              </Link>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-6 pt-12 max-w-2xl mx-auto">
              {stats ? (
                [
                  { value: String(stats.totalOpportunities), label: "Opportunities" },
                  { value: String(stats.uniqueClients), label: "Clients" },
                  { value: `${stats.winRate}%`, label: "Win Rate" },
                ].map((stat, idx) => (
                  <div key={idx} className="text-center">
                    <div className="text-3xl font-bold text-gradient">
                      {stat.value}
                    </div>
                    <div className="text-sm text-neutral-400 mt-1">
                      {stat.label}
                    </div>
                  </div>
                ))
              ) : (
                [
                  { value: "—", label: "Opportunities" },
                  { value: "—", label: "Clients" },
                  { value: "—", label: "Win Rate" },
                ].map((stat, idx) => (
                  <div key={idx} className="text-center">
                    <div className="text-3xl font-bold text-gradient">
                      {stat.value}
                    </div>
                    <div className="text-sm text-neutral-400 mt-1">
                      {stat.label}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="relative py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold mb-4">
              <span className="text-gradient">Agentic AI</span> at Your Service
            </h2>
            <p className="text-lg text-neutral-400 max-w-2xl mx-auto">
              Autonomous agents that work 24/7 to optimize your sales operations
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, idx) => (
              <div
                key={idx}
                className="glass-card-dark p-6 group cursor-pointer transition-transform hover:-translate-y-1"
              >
                <div className="w-12 h-12 rounded-lg gradient-primary flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <feature.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
                <p className="text-neutral-400 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AI Capabilities Section */}
      <section className="relative py-20 px-6 bg-gradient-to-br from-primary-950/20 via-transparent to-secondary-950/20">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold mb-4">
              What Our AI Agents Can Do
            </h2>
            <p className="text-lg text-neutral-400 max-w-2xl mx-auto">
              Intelligent automation that feels like magic
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {aiCapabilities.map((capability, idx) => (
              <div
                key={idx}
                className="glass-dark p-6 rounded-xl border border-white/10 flex items-start gap-4 hover:border-primary-500/50 transition-colors"
              >
                <CheckCircle2 className="w-5 h-5 text-success-500 flex-shrink-0 mt-1" />
                <div>
                  <h4 className="font-semibold text-base mb-1">
                    {capability.title}
                  </h4>
                  <p className="text-neutral-400 text-sm">
                    {capability.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="glass-card-dark p-8 rounded-2xl border-2 border-primary-500/30">
            <div className="w-16 h-16 rounded-full gradient-primary flex items-center justify-center mx-auto mb-6">
              <Bot className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Ready to Transform Your Sales?
            </h2>
            <p className="text-lg text-neutral-400 mb-8 max-w-2xl mx-auto">
              Join leading teams using AI to close more deals, faster.
            </p>
            <Link href="/login">
              <button className="btn-primary px-8 py-4 text-lg transition-transform hover:scale-105 active:scale-95">
                Get Started
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative py-8 px-6 border-t border-white/10 bg-neutral-900/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
            <div>
              <h3 className="text-base font-semibold mb-3 text-white">Product</h3>
              <ul className="space-y-2 text-neutral-400">
                <li>
                  <Link
                    href="#features"
                    className="hover:text-primary-400 transition-colors"
                  >
                    Features
                  </Link>
                </li>
                <li>
                  <Link
                    href="/pricing"
                    className="hover:text-primary-400 transition-colors"
                  >
                    Pricing
                  </Link>
                </li>
                <li>
                  <Link
                    href="/login"
                    className="hover:text-primary-400 transition-colors"
                  >
                    Login
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="text-base font-semibold mb-3 text-white">Company</h3>
              <ul className="space-y-2 text-neutral-400">
                <li>
                  <Link
                    href="/about"
                    className="hover:text-primary-400 transition-colors"
                  >
                    About Us
                  </Link>
                </li>
                <li>
                  <Link
                    href="/contact"
                    className="hover:text-primary-400 transition-colors"
                  >
                    Contact
                  </Link>
                </li>
                <li>
                  <Link
                    href="/careers"
                    className="hover:text-primary-400 transition-colors"
                  >
                    Careers
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="text-base font-semibold mb-3 text-white">
                Resources
              </h3>
              <ul className="space-y-2 text-neutral-400">
                <li>
                  <Link
                    href="/blog"
                    className="hover:text-primary-400 transition-colors"
                  >
                    Blog
                  </Link>
                </li>
                <li>
                  <Link
                    href="/docs"
                    className="hover:text-primary-400 transition-colors"
                  >
                    Documentation
                  </Link>
                </li>
                <li>
                  <Link
                    href="/help"
                    className="hover:text-primary-400 transition-colors"
                  >
                    Help Center
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="text-base font-semibold mb-3 text-white">Legal</h3>
              <ul className="space-y-2 text-neutral-400">
                <li>
                  <Link
                    href="/privacy"
                    className="hover:text-primary-400 transition-colors"
                  >
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link
                    href="/terms"
                    className="hover:text-primary-400 transition-colors"
                  >
                    Terms of Service
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="pt-6 border-t border-white/10 text-center flex flex-col items-center justify-center gap-1">
            <p className="flex items-center gap-1 text-neutral-500">
              Build with{" "}
              <Heart className="w-4 h-4 text-red-500 fill-red-500" /> at
              Quantum Business Advisory
            </p>
            <p className="text-neutral-500 text-sm">
              Copyright © QBA. All Rights Reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

const features = [
  {
    icon: Brain,
    title: "Intelligent Prioritization",
    description:
      "AI analyzes your pipeline and suggests which leads to focus on for maximum impact and revenue potential.",
  },
  {
    icon: Zap,
    title: "Automated Workflows",
    description:
      "Set it and forget it. Agents handle follow-ups, task creation, and stage transitions automatically.",
  },
  {
    icon: BarChart3,
    title: "Predictive Analytics",
    description:
      "Forecast deal closure probability, identify at-risk opportunities, and spot trends before they happen.",
  },
  {
    icon: Bot,
    title: "AI Assistant",
    description:
      "Natural language interface to query data, generate insights, and draft communications instantly.",
  },
  {
    icon: Workflow,
    title: "Smart Automation",
    description:
      "Intelligent triggers that adapt to your sales process and learn from successful patterns.",
  },
  {
    icon: Lock,
    title: "Enterprise Security",
    description:
      "Bank-level encryption, RBAC, audit logs, and compliance with SOC2, GDPR, and industry standards.",
  },
];

const aiCapabilities = [
  {
    title: "Daily Priority Briefings",
    description:
      'Ask "What should I do today?" and get AI-curated action items ranked by impact.',
  },
  {
    title: "Auto-Draft Outreach",
    description:
      "Generate personalized emails and messages using full opportunity context and past interactions.",
  },
  {
    title: "Stalled Deal Detection",
    description:
      "Identify deals losing momentum and receive recommended intervention strategies.",
  },
  {
    title: "Automatic Task Creation",
    description:
      "After logging a meeting, AI creates follow-up tasks with due dates and assignments.",
  },
  {
    title: "Lead Scoring & Enrichment",
    description:
      "ML models score leads based on conversion likelihood and auto-enrich with firmographics.",
  },
  {
    title: "Duplicate Detection",
    description:
      "Smart fuzzy matching prevents duplicate entries and suggests merge actions.",
  },
  {
    title: "Explainable Insights",
    description:
      'Every AI suggestion comes with "why" explanations so you understand the reasoning.',
  },
  {
    title: "Human-in-the-Loop",
    description:
      "All AI actions require your approval. You stay in control with a simple approve/reject interface.",
  },
];
