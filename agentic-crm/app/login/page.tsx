"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Eye, EyeOff, Loader2, Lock, Mail, ArrowRight, ShieldCheck } from "lucide-react";

export default function LoginPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [formData, setFormData] = useState({
        email: "",
        password: "",
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        // Simulate API call
        await new Promise((resolve) => setTimeout(resolve, 1500));

        // Demo login success
        setIsLoading(false);
        router.push("/dashboard");
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950 text-white flex items-center justify-center p-4 relative overflow-hidden">
            {/* Ambient Background Effects */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary-900/20 rounded-full blur-3xl animate-pulse-glow" />
                <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-secondary-900/20 rounded-full blur-3xl animate-pulse-glow animation-delay-200" />
            </div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="w-full max-w-md relative z-10"
            >
                <div className="glass-card-dark p-8 md:p-10 border border-white/10 shadow-2xl backdrop-blur-xl rounded-2xl">

                    {/* Header */}
                    <div className="text-center mb-10">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl gradient-primary mb-6 shadow-glow-primary">
                            <ShieldCheck className="w-8 h-8 text-white" />
                        </div>
                        <h1 className="text-3xl font-bold mb-2 tracking-tight">Welcome Back</h1>
                        <p className="text-neutral-400">Sign in to your Agentic CRM account</p>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-neutral-300 ml-1">Email Address</label>
                            <div className="relative group">
                                <Mail className="absolute left-4 top-3.5 w-5 h-5 text-neutral-500 group-focus-within:text-primary-400 transition-colors" />
                                <input
                                    type="email"
                                    placeholder="name@company.com"
                                    className="w-full bg-neutral-900/50 border border-neutral-700 rounded-xl py-3 pl-12 pr-4 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-transparent transition-all"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex justify-between items-center ml-1">
                                <label className="text-sm font-medium text-neutral-300">Password</label>
                                <Link href="#" className="text-xs text-primary-400 hover:text-primary-300 transition-colors">Forgot password?</Link>
                            </div>
                            <div className="relative group">
                                <Lock className="absolute left-4 top-3.5 w-5 h-5 text-neutral-500 group-focus-within:text-primary-400 transition-colors" />
                                <input
                                    type={showPassword ? "text" : "password"}
                                    placeholder="••••••••"
                                    className="w-full bg-neutral-900/50 border border-neutral-700 rounded-xl py-3 pl-12 pr-12 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-transparent transition-all"
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-3.5 text-neutral-500 hover:text-neutral-300 transition-colors focus:outline-none"
                                >
                                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full btn-primary py-3.5 text-lg font-semibold shadow-lg shadow-primary-500/20 group relative overflow-hidden"
                        >
                            <span className="relative z-10 flex items-center justify-center gap-2">
                                {isLoading ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        Signing in...
                                    </>
                                ) : (
                                    <>
                                        Sign In
                                        <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                    </>
                                )}
                            </span>
                        </button>
                    </form>

                    {/* Footer */}
                    <div className="mt-8 text-center">
                        <p className="text-neutral-400 text-sm">
                            Don't have an account?{" "}
                            <Link href="/register" className="text-primary-400 font-medium hover:text-primary-300 transition-colors">
                                Start a free trial
                            </Link>
                        </p>
                    </div>
                </div>

                {/* Footer Links */}
                <div className="mt-8 flex justify-center gap-6 text-xs text-neutral-500">
                    <Link href="#" className="hover:text-neutral-300 transition-colors">Privacy Policy</Link>
                    <Link href="#" className="hover:text-neutral-300 transition-colors">Terms of Service</Link>
                    <Link href="#" className="hover:text-neutral-300 transition-colors">Contact Support</Link>
                </div>
            </motion.div>
        </div>
    );
}
