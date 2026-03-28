"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Eye, EyeOff, Loader2, Lock, Mail, ArrowRight, ShieldCheck, AlertCircle, KeyRound, Check } from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";
import { API_URL, getAuthHeaders } from "@/lib/api";

export default function LoginPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { login, ssoLogin, ssoCallback, isLoading, error, clearError, mustChangePassword } = useAuthStore();
    const [showPassword, setShowPassword] = useState(false);
    const [formData, setFormData] = useState({ email: "", password: "" });
    const [ssoProcessing, setSsoProcessing] = useState(false);

    const isSSO = formData.email.toLowerCase().endsWith("@qbadvisory.com");

    // Handle Microsoft OAuth redirect callback
    useEffect(() => {
        const code = searchParams.get('code');
        if (code && !ssoProcessing) {
            setSsoProcessing(true);
            // Clean URL immediately
            window.history.replaceState({}, '', '/login');
            ssoCallback(code).then((success) => {
                if (success) {
                    router.push("/dashboard");
                }
                setSsoProcessing(false);
            });
        }
    }, [searchParams, ssoCallback, router, ssoProcessing]);

    // Set-password modal state
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showNew, setShowNew] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [setPasswordError, setSetPasswordError] = useState("");
    const [setSaving, setSetSaving] = useState(false);
    const [setPasswordDone, setSetPasswordDone] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        clearError();

        let success: boolean;
        if (isSSO) {
            success = await ssoLogin(formData.email);
        } else {
            success = await login(formData.email, formData.password);
        }

        if (success && !useAuthStore.getState().mustChangePassword) {
            router.push("/dashboard");
        }
    };

    const handleSetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setSetPasswordError("");
        if (newPassword.length < 6) {
            setSetPasswordError("Password must be at least 6 characters.");
            return;
        }
        if (newPassword !== confirmPassword) {
            setSetPasswordError("Passwords do not match.");
            return;
        }
        setSetSaving(true);
        try {
            const res = await fetch(`${API_URL}/api/auth/set-password`, {
                method: "PATCH",
                headers: getAuthHeaders(),
                body: JSON.stringify({ newPassword }),
            });
            const data = await res.json();
            if (!res.ok) {
                setSetPasswordError(data.error || "Failed to set password.");
                return;
            }
            setSetPasswordDone(true);
            // Clear mustChangePassword flag in store, then redirect
            useAuthStore.setState({ mustChangePassword: false });
            setTimeout(() => router.push("/dashboard"), 1200);
        } catch {
            setSetPasswordError("Network error. Please try again.");
        } finally {
            setSetSaving(false);
        }
    };

    // Show processing screen while handling SSO callback
    if (ssoProcessing) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950 text-white flex flex-col items-center justify-center p-4">
                <Loader2 className="w-10 h-10 animate-spin text-blue-400 mb-4" />
                <p className="text-neutral-300 text-sm">Verifying Microsoft SSO authentication...</p>
                {error && (
                    <div className="mt-4 flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm max-w-md">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        {error}
                    </div>
                )}
            </div>
        );
    }

    // Show set-password screen after first login
    if (mustChangePassword) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950 text-white flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="w-full max-w-md"
                >
                    <div className="glass-card-dark p-6 md:p-8 border border-white/10 shadow-2xl backdrop-blur-xl rounded-xl">
                        <div className="text-center mb-6">
                            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/30 mb-4">
                                <KeyRound className="w-6 h-6 text-amber-400" />
                            </div>
                            <h1 className="text-xl font-bold mb-1">Set Your Password</h1>
                            <p className="text-neutral-400 text-xs">This is your first login. Please set a new password to continue.</p>
                        </div>

                        {setPasswordDone ? (
                            <div className="flex flex-col items-center gap-2 py-4 text-emerald-400">
                                <Check className="w-10 h-10" />
                                <p className="font-semibold">Password set! Redirecting...</p>
                            </div>
                        ) : (
                            <form onSubmit={handleSetPassword} className="space-y-4">
                                {setPasswordError && (
                                    <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                                        <AlertCircle className="w-4 h-4 shrink-0" />
                                        {setPasswordError}
                                    </div>
                                )}
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-neutral-300 ml-1">New Password</label>
                                    <div className="relative">
                                        <Lock className="absolute left-4 top-3.5 w-5 h-5 text-neutral-500" />
                                        <input
                                            type={showNew ? "text" : "password"}
                                            placeholder="Min. 6 characters"
                                            className="w-full bg-neutral-900/50 border border-neutral-700 rounded-xl py-3 pl-12 pr-12 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                                            value={newPassword}
                                            onChange={(e) => setNewPassword(e.target.value)}
                                            required
                                        />
                                        <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-4 top-3.5 text-neutral-500 hover:text-neutral-300">
                                            {showNew ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                        </button>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-neutral-300 ml-1">Confirm Password</label>
                                    <div className="relative">
                                        <Lock className="absolute left-4 top-3.5 w-5 h-5 text-neutral-500" />
                                        <input
                                            type={showConfirm ? "text" : "password"}
                                            placeholder="Repeat your password"
                                            className="w-full bg-neutral-900/50 border border-neutral-700 rounded-xl py-3 pl-12 pr-12 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            required
                                        />
                                        <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-4 top-3.5 text-neutral-500 hover:text-neutral-300">
                                            {showConfirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                        </button>
                                    </div>
                                </div>
                                    <button
                                    type="submit"
                                    disabled={setSaving}
                                    className="w-full py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {setSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
                                    {setSaving ? "Saving..." : "Set Password & Continue"}
                                </button>
                            </form>
                        )}
                    </div>
                </motion.div>
            </div>
        );
    }

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
                <div className="glass-card-dark p-6 md:p-8 border border-white/10 shadow-2xl backdrop-blur-xl rounded-xl">

                    {/* Header */}
                    <div className="text-center mb-6">
                        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl gradient-primary mb-4 shadow-glow-primary">
                            <ShieldCheck className="w-6 h-6 text-white" />
                        </div>
                        <h1 className="text-2xl font-bold mb-1 tracking-tight">Welcome Back</h1>
                        <p className="text-neutral-400 text-sm">Sign in to your Q-CRM account</p>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Error Message */}
                        {error && (
                            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                                <AlertCircle className="w-4 h-4 shrink-0" />
                                {error}
                            </div>
                        )}

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

                        {/* Password field — hidden for SSO users */}
                        {!isSSO && (
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
                        )}

                        {/* SSO info banner */}
                        {isSSO && (
                            <div className="flex items-center gap-2 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-400 text-sm">
                                <ShieldCheck className="w-4 h-4 shrink-0" />
                                You will be redirected to Microsoft to sign in
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full btn-primary py-2.5 text-sm font-semibold shadow-lg shadow-primary-500/20 group relative overflow-hidden"
                        >
                            <span className="relative z-10 flex items-center justify-center gap-2">
                                {isLoading ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        {isSSO ? "Authenticating via SSO..." : "Signing in..."}
                                    </>
                                ) : (
                                    <>
                                        {isSSO ? "Sign In with SSO" : "Sign In"}
                                        <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                    </>
                                )}
                            </span>
                        </button>
                    </form>


                </div>

                {/* Footer Links */}
                <div className="mt-6 flex justify-center gap-6 text-xs text-neutral-500">
                    <Link href="#" className="hover:text-neutral-300 transition-colors">Privacy Policy</Link>
                    <Link href="#" className="hover:text-neutral-300 transition-colors">Terms of Service</Link>
                    <Link href="#" className="hover:text-neutral-300 transition-colors">Contact Support</Link>
                </div>
            </motion.div>
        </div>
    );
}
