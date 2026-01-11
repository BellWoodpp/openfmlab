"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, CheckCircle, Users, Zap, Shield, Rocket, ChevronDown, ChevronLeft, ChevronRight, Mic, Play, Sparkles, Languages, Activity, Clock, Lock, Headphones, Megaphone, Globe, GraduationCap, MessageSquareText } from "lucide-react";
import type { AppDictionary } from "@/i18n";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { TtsUiMockup } from "./tts-ui-mockup";

interface HomePageProps {
  dictionary: AppDictionary;
}

export function HomePage({ dictionary }: HomePageProps) {
  const { home } = dictionary;
  const isVoiceCloningUiEnabled = process.env.NEXT_PUBLIC_VOICE_CLONING_ENABLED === "1";
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const [isSamplePlaying, setIsSamplePlaying] = useState<"original" | "clone" | null>(null);
  const sampleWaveHeights = [6, 10, 7, 12, 8, 14, 9, 16, 10, 13, 7, 15, 9, 12, 8, 14, 10, 16, 9, 13, 7, 15, 8, 14, 9, 12, 8, 10];

  const sampleSets = home.sampleVoicesSets?.length
    ? home.sampleVoicesSets
    : [
        { originalName: home.sampleVoicesOriginalName, cloneName: home.sampleVoicesCloneName, originalAvatarText: home.sampleOriginalAvatarText, cloneAvatarText: home.sampleCloneAvatarText },
      ];

  const hasCarousel = sampleSets.length > 1;
  const extendedSamples = hasCarousel ? [sampleSets[sampleSets.length - 1], ...sampleSets, sampleSets[0]] : sampleSets;
  const [carouselIndex, setCarouselIndex] = useState(() => (hasCarousel ? 1 : 0));
  const [isCarouselAnimating, setIsCarouselAnimating] = useState(false);
  const [isCarouselTransitionEnabled, setIsCarouselTransitionEnabled] = useState(true);
  const [isCarouselJumping, setIsCarouselJumping] = useState(false);
  const carouselLockRef = useRef(false);
  const carouselRafRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (carouselRafRef.current) window.cancelAnimationFrame(carouselRafRef.current);
    };
  }, []);

  const activeIndex = hasCarousel ? (carouselIndex - 1 + sampleSets.length) % sampleSets.length : 0;
  const prevPreview = sampleSets[(activeIndex - 1 + sampleSets.length) % sampleSets.length];
  const nextPreview = sampleSets[(activeIndex + 1) % sampleSets.length];
  const canSlidePrev = hasCarousel && !isCarouselAnimating && !isCarouselJumping;
  const canSlideNext = hasCarousel && !isCarouselAnimating && !isCarouselJumping;

  const slidePrev = () => {
    if (!canSlidePrev) return;
    if (carouselLockRef.current) return;
    carouselLockRef.current = true;
    setIsSamplePlaying(null);
    setIsCarouselAnimating(true);
    setIsCarouselTransitionEnabled(true);
    setCarouselIndex((idx) => idx - 1);
  };

  const slideNext = () => {
    if (!canSlideNext) return;
    if (carouselLockRef.current) return;
    carouselLockRef.current = true;
    setIsSamplePlaying(null);
    setIsCarouselAnimating(true);
    setIsCarouselTransitionEnabled(true);
    setCarouselIndex((idx) => idx + 1);
  };

  const handleCarouselTransitionEnd: React.TransitionEventHandler<HTMLDivElement> = (event) => {
    if (event.target !== event.currentTarget) return;
    
    // Only handle transition end if we are animating
    if (!isCarouselAnimating) return;
    
    setIsCarouselAnimating(false);

    if (!hasCarousel) return;

    // If we reached the clone of the first item (at the end)
    if (carouselIndex >= sampleSets.length + 1) {
      setIsCarouselJumping(true);
      setIsCarouselTransitionEnabled(false);
      setCarouselIndex(1); // Jump to real first item
      
      setTimeout(() => {
        setIsCarouselTransitionEnabled(true);
        setIsCarouselJumping(false);
        carouselLockRef.current = false;
      }, 100);
      return;
    }

    // If we reached the clone of the last item (at the start)
    if (carouselIndex <= 0) {
      setIsCarouselJumping(true);
      setIsCarouselTransitionEnabled(false);
      setCarouselIndex(sampleSets.length); // Jump to real last item
      
      setTimeout(() => {
        setIsCarouselTransitionEnabled(true);
        setIsCarouselJumping(false);
        carouselLockRef.current = false;
      }, 100);
      return;
    }

    carouselLockRef.current = false;
  };

  return (
    <div className="min-h-screen bg-white text-neutral-900 dark:bg-black dark:text-white selection:bg-blue-500/30 font-sans transition-colors duration-300">
      
      {/* Hero Section */}
      <section className="relative isolate overflow-hidden px-6 py-24 sm:px-10 lg:px-16 min-h-[90vh] flex flex-col justify-center">
        {/* Background Gradients - Adapted for Light/Dark */}
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_40%,rgba(76,29,149,0.05),transparent_60%)] dark:bg-[radial-gradient(circle_at_50%_40%,rgba(76,29,149,0.15),transparent_60%)]" />

        {/* The Orb / Bubble Effect */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[550px] w-[550px] -translate-x-1/2 -translate-y-1/2 sm:h-[700px] sm:w-[700px] lg:h-[950px] lg:w-[950px] animate-orb-float rounded-full">
           {/* Layer 1 (Outer Glow) */}
           <div className="animate-orb-fluid absolute inset-0 bg-gradient-to-br from-purple-600/30 via-amber-500/20 to-purple-800/30 dark:from-purple-600/60 dark:via-amber-500/40 dark:to-purple-800/60 opacity-100 blur-[80px] rounded-full" />
           
           {/* Layer 2 (The Ring/Structure) */}
           <div 
             className="animate-orb-fluid absolute inset-0 bg-[conic-gradient(from_0deg,transparent_0deg,rgba(168,85,247,0.6)_120deg,rgba(234,179,8,0.6)_180deg,rgba(168,85,247,0.6)_240deg,transparent_360deg)] dark:bg-[conic-gradient(from_0deg,transparent_0deg,rgba(168,85,247,0.8)_120deg,rgba(234,179,8,0.8)_180deg,rgba(168,85,247,0.8)_240deg,transparent_360deg)] opacity-100 blur-[50px] mix-blend-normal dark:mix-blend-screen rounded-full" 
             style={{ animationDelay: '-2s', animationDuration: '35s' }} 
           />
           
           {/* Inner void */}
           <div className="animate-orb-fluid absolute inset-[60px] bg-white/90 dark:bg-black/90 blur-[40px] rounded-full" />
        </div>

        <div className="mx-auto max-w-7xl relative z-20">
          <div className="text-center">
            <div className="mb-8 flex justify-center">
              <Badge
                variant="secondary"
                className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white/50 dark:border-white/10 dark:bg-white/5 px-4 py-1.5 text-xs font-medium tracking-wide text-neutral-600 dark:text-neutral-300 backdrop-blur-sm"
              >
                <Sparkles className="h-3 w-3 text-amber-500 dark:text-yellow-500" />
                VOICE STUDIO
              </Badge>
            </div>

            <h1 className="mx-auto max-w-5xl text-6xl font-bold tracking-tight text-neutral-900 dark:text-white sm:text-7xl lg:text-8xl leading-[0.95] mb-2">
              <span className="block">Create your own AI</span>
              <span className="block text-transparent bg-clip-text bg-gradient-to-b from-neutral-800 to-neutral-500 dark:from-white dark:to-white/60">voice in seconds</span>
            </h1>

	            <div className="mt-2 text-6xl font-bold tracking-tight sm:text-7xl lg:text-8xl">
	              <span className="glitch relative inline-block text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 dark:from-blue-400 dark:via-purple-400 dark:to-pink-400 text-balance" data-text="Text to Speed — clone and speak in seconds.">
	                Text to Speed — clone and speak in seconds.
	              </span>
	            </div>

	            <p className="mx-auto mt-8 max-w-2xl text-lg text-neutral-600 dark:text-neutral-400 sm:text-xl font-light leading-relaxed">
	              Generate natural-sounding speech from text in seconds. Pick a voice, tweak speed, and create voiceovers, podcasts, and content from a script. (Voice cloning coming soon.)
	            </p>

            <div className="mt-12 flex flex-col items-center justify-center">
                <Button
                  size="lg"
                  className="h-14 rounded-full bg-neutral-900 dark:bg-white/10 px-8 text-base font-medium text-white hover:bg-neutral-800 dark:hover:bg-white/20 border border-transparent dark:border-white/10 backdrop-blur-md transition-all duration-300 group shadow-xl dark:shadow-none"
                  asChild
                >
                  <Link href="/podcast-mvp">
                    {home.ctaPrimary} 
                    <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Link>
                </Button>
                
                <div className="mt-12 flex gap-8 text-xs font-medium text-neutral-500 uppercase tracking-widest">
                  <div className="flex items-center gap-2">
                     <Play className="w-3 h-3 fill-current" />
                     {home.heroHighlightFidelity}
                  </div>
                  <div className="flex items-center gap-2">
                     <div className="w-1.5 h-1.5 rounded-full bg-neutral-400 dark:bg-neutral-600" />
                     {home.heroHighlightNoCard}
                  </div>
                  <div className="flex items-center gap-2">
                     <Headphones className="w-3 h-3" />
                     {home.heroHighlightManyVoices}
                  </div>
                </div>
            </div>
            
	            <div className="mt-16 flex justify-center">
	               <ChevronDown className="h-6 w-6 text-neutral-400 dark:text-neutral-600 animate-bounce" />
	            </div>
	          </div>
	        </div>
	      </section>

      {/* Product UI Mockup */}
      <section className="px-6 pt-24 pb-24 bg-white dark:bg-black transition-colors duration-300">
        <div className="mx-auto max-w-7xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold text-neutral-900 dark:text-white mb-6 tracking-tight">
              Text to Speech
            </h2>
            <p className="text-lg text-neutral-600 dark:text-neutral-400 max-w-2xl mx-auto">
              Listen to the difference. Our AI captures every nuance, breath, and emotion.
            </p>
          </div>
          <div className="relative mx-auto max-w-6xl">
            <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_30%,rgba(59,130,246,0.10),transparent_60%)] dark:bg-[radial-gradient(circle_at_50%_30%,rgba(59,130,246,0.18),transparent_60%)]" />
            <div className="rounded-[2.25rem] border border-neutral-200 dark:border-white/10 bg-white/60 dark:bg-white/5 backdrop-blur-xl shadow-2xl overflow-hidden">
              <div className="p-6 sm:p-8">
                <TtsUiMockup />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Sample Voices Section */}
      {isVoiceCloningUiEnabled ? (
      <section className="py-24 px-6 bg-white dark:bg-neutral-950 relative overflow-hidden transition-colors duration-300">
         <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_0%,rgba(59,130,246,0.05),transparent_70%)] dark:bg-[radial-gradient(circle_at_50%_0%,rgba(59,130,246,0.1),transparent_70%)]" />
        <div className="mx-auto max-w-7xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold text-neutral-900 dark:text-white mb-6 tracking-tight">
              {home.sampleVoicesTitle}
            </h2>
            <p className="text-lg text-neutral-600 dark:text-neutral-400 max-w-2xl mx-auto">
              {home.sampleVoicesSubtitle}
            </p>
          </div>

          <div className="relative mx-auto max-w-5xl">
            {/* Carousel Controls */}
            {hasCarousel && (
              <>
                <button
                  onClick={slidePrev}
                  disabled={!canSlidePrev}
                  className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-12 z-20 hidden lg:flex h-12 w-12 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-600 shadow-md hover:bg-neutral-50 dark:border-white/10 dark:bg-neutral-900 dark:text-white dark:hover:bg-neutral-800 transition-all disabled:opacity-50"
                >
                  <ChevronLeft className="h-6 w-6" />
                </button>
                <button
                  onClick={slideNext}
                  disabled={!canSlideNext}
                  className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-12 z-20 hidden lg:flex h-12 w-12 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-600 shadow-md hover:bg-neutral-50 dark:border-white/10 dark:bg-neutral-900 dark:text-white dark:hover:bg-neutral-800 transition-all disabled:opacity-50"
                >
                  <ChevronRight className="h-6 w-6" />
                </button>
              </>
            )}

            {/* Carousel Track */}
            <div className="relative w-full overflow-hidden py-8">
               <div
                className="flex w-full items-center"
                style={{ 
                  transform: `translate3d(calc(-${carouselIndex * 75}% + 12.5%),0,0)`,
                  transition: isCarouselTransitionEnabled ? "transform 700ms cubic-bezier(0.4, 0, 0.2, 1)" : "none",
                  willChange: "transform"
                }}
                onTransitionEnd={handleCarouselTransitionEnd}
              >
                {extendedSamples.map((sample, idx) => {
                  const isActive = idx === carouselIndex;
                  return (
                  <div 
                    key={`${idx}`} 
                    className={`w-[75%] shrink-0 px-3 md:px-6 ${isCarouselTransitionEnabled ? "transition-all duration-500 ease-out" : "transition-none"} ${isActive ? "scale-100 opacity-100 z-10" : "scale-90 opacity-40 z-0 grayscale"}`}
                  >
                    <div className="relative rounded-3xl bg-white dark:bg-[#0f1115] border border-neutral-200 dark:border-white/10 shadow-xl dark:shadow-blue-900/10 overflow-hidden group transition-colors duration-300">
                        {/* Top Highlight Line */}
                        <div className="absolute top-0 left-0 right-0 h-[4px] bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-90 shadow-[0_0_15px_rgba(59,130,246,0.5)]" />
                        
                        <div className={`grid gap-8 ${isVoiceCloningUiEnabled ? "md:grid-cols-2" : "md:grid-cols-1"} relative p-6 md:p-10`}>
                            {/* Center Divider */}
                            {isVoiceCloningUiEnabled ? (
                              <div className="hidden md:block absolute left-1/2 top-8 bottom-8 w-px bg-gradient-to-b from-transparent via-neutral-200 dark:via-white/10 to-transparent" />
                            ) : null}

                            {/* Original Voice */}
                            <div className="flex flex-col justify-between h-full">
                                <div className="flex items-center gap-4 mb-8">
                                    <div className="relative">
                                        <div className="h-16 w-16 md:h-20 md:w-20 rounded-full bg-blue-100 dark:bg-blue-950 flex items-center justify-center border-2 border-white dark:border-white/10 overflow-hidden relative z-10 shadow-lg">
                                             <Image 
                                                src={`https://api.dicebear.com/9.x/avataaars/png?seed=${sample.originalName}&backgroundColor=b6e3f4`} 
                                                alt="Original"
                                                width={80}
                                                height={80}
                                                className="h-full w-full object-cover"
                                             />
                                        </div>
                                        <div className="absolute inset-0 bg-blue-500/30 blur-2xl rounded-full -z-10" />
                                        <div className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center border-4 border-white dark:border-[#0f1115] z-20 shadow-sm">
                                            <Mic className="h-4 w-4 text-white" />
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-xs font-bold text-blue-600 dark:text-blue-400 tracking-[0.2em] uppercase mb-1.5">Original</div>
                                        <div className="text-2xl font-bold text-neutral-900 dark:text-white tracking-tight">{sample.originalName}</div>
                                    </div>
                                </div>

                                <div className="rounded-2xl bg-neutral-50 border border-neutral-200 dark:bg-white/5 dark:border-white/5 p-4 flex items-center gap-4">
                                    <button
                                        onClick={() => setIsSamplePlaying(isSamplePlaying === "original" ? null : "original")}
                                        className="h-12 w-12 shrink-0 rounded-full border-2 border-blue-500/30 text-blue-600 dark:text-blue-400 flex items-center justify-center hover:bg-blue-500/10 hover:border-blue-500/60 transition-all"
                                        aria-label="Play original"
                                    >
                                        {isSamplePlaying === "original" ? (
                                            <div className="h-3 w-3 bg-blue-600 dark:bg-blue-400 rounded-[1px]" />
                                        ) : (
                                            <Play className="h-5 w-5 fill-current ml-1" />
                                        )}
                                    </button>
                                    <div className="flex-1 h-10 flex items-center gap-[3px]">
                                        {sampleWaveHeights.map((h, i) => (
                                            <div
                                                key={i}
                                                style={{ height: `${Math.max(6, h * 0.8)}px` }}
                                                className={`w-1 rounded-full transition-all duration-300 ${
                                                    isSamplePlaying === "original" ? "bg-blue-500 animate-pulse" : "bg-neutral-300 dark:bg-white/10"
                                                }`}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* AI Clone */}
                            {isVoiceCloningUiEnabled ? (
                              <div className="flex flex-col justify-between h-full">
                                <div className="flex items-center gap-4 mb-8 md:flex-row-reverse md:text-right">
                                    <div className="relative">
                                        <div className="h-16 w-16 md:h-20 md:w-20 rounded-full bg-indigo-100 dark:bg-indigo-950 flex items-center justify-center border-2 border-white dark:border-white/10 overflow-hidden relative z-10 shadow-lg">
                                             <Image 
                                                src={`https://api.dicebear.com/9.x/shapes/png?seed=${sample.cloneName}&backgroundColor=c0aede`} 
                                                alt="Clone"
                                                width={80}
                                                height={80}
                                                className="h-full w-full object-cover"
                                             />
                                        </div>
                                        <div className="absolute inset-0 bg-purple-500/30 blur-2xl rounded-full -z-10" />
                                        <div className="absolute -bottom-1 -left-1 h-8 w-8 rounded-full bg-purple-600 flex items-center justify-center border-4 border-white dark:border-[#0f1115] z-20 shadow-sm">
                                            <Sparkles className="h-4 w-4 text-white" />
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-xs font-bold text-purple-600 dark:text-purple-400 tracking-[0.2em] uppercase mb-1.5">AI Clone</div>
                                        <div className="text-2xl font-bold text-neutral-900 dark:text-white tracking-tight">{sample.cloneName}</div>
                                    </div>
                                </div>

                                <div className="rounded-2xl bg-neutral-50 border border-neutral-200 dark:bg-white/5 dark:border-white/5 p-4 flex items-center gap-4">
                                    <button
                                        onClick={() => setIsSamplePlaying(isSamplePlaying === "clone" ? null : "clone")}
                                        className="h-12 w-12 shrink-0 rounded-full border-2 border-purple-500/30 text-purple-600 dark:text-purple-400 flex items-center justify-center hover:bg-purple-500/10 hover:border-purple-500/60 transition-all"
                                        aria-label="Play clone"
                                    >
                                        {isSamplePlaying === "clone" ? (
                                            <div className="h-3 w-3 bg-purple-600 dark:bg-purple-400 rounded-[1px]" />
                                        ) : (
                                            <Play className="h-5 w-5 fill-current ml-1" />
                                        )}
                                    </button>
                                    <div className="flex-1 h-10 flex items-center gap-[3px]">
                                        {sampleWaveHeights.map((h, i) => (
                                            <div
                                                key={i}
                                                style={{ height: `${Math.max(6, h * 0.8)}px` }}
                                                className={`w-1 rounded-full transition-all duration-300 ${
                                                    isSamplePlaying === "clone" ? "bg-purple-500 animate-pulse" : "bg-neutral-300 dark:bg-white/10"
                                                }`}
                                            />
                                        ))}
                                    </div>
                                </div>
                              </div>
                            ) : null}
                        </div>
                    </div>
                  </div>
                  );
                })}
               </div>
            </div>
          </div>
        </div>
      </section>
      ) : null}

      {/* Voice Cloning Info Section */}
      {isVoiceCloningUiEnabled ? (
      <section className="py-24 px-6 relative bg-white dark:bg-black transition-colors duration-300">
        <div className="mx-auto max-w-7xl grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-100 text-sm text-blue-600 dark:bg-blue-500/10 dark:border-blue-500/20 dark:text-blue-400 mb-6">
               <Sparkles className="w-4 h-4" />
               {home.voiceCloningKicker}
            </div>
            <h2 className="text-4xl md:text-5xl font-bold text-neutral-900 dark:text-white mb-6 leading-tight">
              {home.voiceCloningTitle}
            </h2>
            <p className="text-lg text-neutral-600 dark:text-neutral-400 mb-8 leading-relaxed">
              {home.voiceCloningDescription}
            </p>
            
            <div className="grid gap-6">
              {home.voiceCloningHighlights?.map((item, i) => (
                <div key={i} className="flex gap-4">
                  <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 border border-blue-100 dark:bg-white/5 dark:border-white/10">
                    <CheckCircle className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <h4 className="text-lg font-semibold text-neutral-900 dark:text-white">{item.title}</h4>
                    <p className="text-neutral-600 dark:text-neutral-400 text-sm mt-1">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-10 flex gap-4">
              <Button size="lg" className="rounded-full bg-neutral-900 text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200">
                <Link href="/podcast-mvp">{home.voiceCloningPrimaryCta}</Link>
              </Button>
               <Button size="lg" variant="outline" className="rounded-full border-neutral-200 dark:border-white/10 text-neutral-900 dark:text-white hover:bg-neutral-50 dark:hover:bg-white/5">
                <Link href="/pricing">{home.voiceCloningSecondaryCta}</Link>
              </Button>
            </div>
          </div>

          <div className="relative">
             <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/20 to-purple-500/20 blur-[80px] -z-10" />
             <div className="rounded-[2.5rem] border border-neutral-200 dark:border-white/10 bg-white/50 dark:bg-neutral-900/50 backdrop-blur-xl p-8 shadow-2xl">
                <div className="aspect-square relative rounded-3xl overflow-hidden bg-neutral-100 dark:bg-neutral-800">
                   <Image src="/api/placeholder/600/600" alt="Voice Cloning Demo" fill className="object-cover opacity-90 dark:opacity-80" />
                   <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                   
                   <div className="absolute bottom-6 left-6 right-6 space-y-3">
                      <div className="flex items-center gap-3 p-3 rounded-xl bg-white/80 dark:bg-white/10 backdrop-blur-md border border-white/20">
                         <div className="h-10 w-10 rounded-full bg-blue-500 flex items-center justify-center">
                            <Play className="h-5 w-5 text-white fill-white" />
                         </div>
                         <div className="flex-1">
                            <div className="h-2 w-2/3 bg-neutral-300 dark:bg-white/50 rounded-full mb-1.5" />
                            <div className="h-2 w-1/3 bg-neutral-200 dark:bg-white/30 rounded-full" />
                         </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 rounded-xl bg-white/80 dark:bg-white/10 backdrop-blur-md border border-white/20">
                         <div className="h-10 w-10 rounded-full bg-purple-500 flex items-center justify-center">
                             <Users className="h-5 w-5 text-white" />
                         </div>
                         <div className="flex-1">
                             <div className="h-2 w-3/4 bg-neutral-300 dark:bg-white/50 rounded-full mb-1.5" />
                            <div className="h-2 w-1/2 bg-neutral-200 dark:bg-white/30 rounded-full" />
                         </div>
                      </div>
                   </div>
                </div>
             </div>
          </div>
        </div>
      </section>
      ) : null}

      {/* Fast Processing Section (3.png Style) */}
      <section className="py-24 px-6 bg-white dark:bg-black transition-colors duration-300">
        <div className="mx-auto max-w-7xl grid lg:grid-cols-2 gap-20 items-center">
           {/* Left: Image Card */}
           <div className="relative">
              <div className="aspect-[4/3] rounded-[2.5rem] bg-gradient-to-br from-pink-100 to-purple-100 dark:from-pink-900/20 dark:to-purple-900/20 overflow-hidden relative shadow-2xl">
                  {/* Background Glow */}
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3/4 h-3/4 bg-purple-500/20 blur-[100px] rounded-full" />
                  
                  {/* Main Image Mockup */}
                  <div className="absolute inset-0 flex items-end justify-center">
                      <div className="relative w-3/4 h-[90%]">
                         <Image 
                            src="https://images.unsplash.com/photo-1516387938699-a93567ec168e?q=80&w=2671&auto=format&fit=crop" 
                            alt="Fast Processing" 
                            fill 
                            unoptimized
                            className="object-cover rounded-t-3xl shadow-lg"
                         />
                      </div>
                  </div>

                  {/* Floating Widgets */}
                  <div className="absolute right-8 top-1/2 -translate-y-1/2 space-y-4">
                      {/* Timer Widget */}
                      <div className="bg-white dark:bg-[#1a1d24] p-4 rounded-2xl shadow-xl flex items-center gap-4 animate-bounce hover:scale-105 transition-transform" style={{ animationDuration: '3s' }}>
                          <div className="relative h-12 w-12 flex items-center justify-center">
                              <svg className="absolute inset-0 w-full h-full -rotate-90">
                                  <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="4" fill="none" className="text-gray-100 dark:text-gray-700" />
                                  <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="4" fill="none" className="text-purple-600 dark:text-purple-500" strokeDasharray="126" strokeDashoffset="40" strokeLinecap="round" />
                              </svg>
                              <span className="text-sm font-bold text-gray-900 dark:text-white">3s</span>
                          </div>
                          <div className="h-8 w-px bg-gray-200 dark:bg-gray-700" />
                          <Clock className="h-6 w-6 text-gray-400 dark:text-gray-500" />
                      </div>

                      {/* Audio Widget */}
                      <div className="bg-white dark:bg-[#1a1d24] p-4 rounded-2xl shadow-xl flex items-center gap-4 animate-bounce hover:scale-105 transition-transform" style={{ animationDuration: '4s', animationDelay: '1s' }}>
                          <div className="flex items-center gap-1 h-8">
                              {[0.4, 0.8, 0.6, 1.0, 0.5, 0.9].map((h, i) => (
                                  <div key={i} className="w-1 bg-gray-300 dark:bg-gray-600 rounded-full" style={{ height: `${h * 100}%` }} />
                              ))}
                          </div>
                          <div className="h-8 w-px bg-gray-200 dark:bg-gray-700" />
                          <Play className="h-6 w-6 fill-black dark:fill-white text-black dark:text-white" />
                      </div>
                  </div>
              </div>
           </div>

           {/* Right: Text Content */}
           <div>
              <div className="inline-flex items-center gap-2 mb-6">
                  <Zap className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  <span className="text-sm font-bold tracking-widest text-gray-500 dark:text-gray-400 uppercase">Text to Speech</span>
              </div>
              <h2 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-6">
                  Text to Speech
              </h2>
              <p className="text-lg text-gray-600 dark:text-gray-400 mb-8 leading-relaxed">
                  Turn any text into natural-sounding audio in seconds. Pick a voice, choose the right tone, and generate clean voiceovers for videos, podcasts, and scripts—without recording.
              </p>
              <div className="flex flex-wrap gap-4">
                  <Button asChild className="h-12 rounded-full px-8 bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200">
                      <Link href="/podcast-mvp">AI Text to Speech Now</Link>
                  </Button>
                  <Button asChild variant="outline" className="h-12 rounded-full px-8 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white">
                      <Link href="/pricing">View Pricing Plans</Link>
                  </Button>
              </div>
           </div>
        </div>
      </section>

      {/* Security Section (4.png Style) */}
      <section className="py-24 px-6 bg-white dark:bg-black transition-colors duration-300">
        <div className="mx-auto max-w-7xl grid lg:grid-cols-2 gap-20 items-center">
           {/* Left: Text Content */}
           <div className="order-2 lg:order-1">
              <div className="inline-flex items-center gap-2 mb-6">
                  <Lock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  <span className="text-sm font-bold tracking-widest text-gray-500 dark:text-gray-400 uppercase">Security</span>
              </div>
              <h2 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-6">
                  Secure and Private
              </h2>
              <p className="text-lg text-gray-600 dark:text-gray-400 mb-8 leading-relaxed">
                  Your text stays yours. We protect your content with secure processing and strict access controls, so you can generate speech confidently for scripts, videos, and podcasts—without compromising privacy.
              </p>
              <div className="flex flex-wrap gap-4">
                  <Button asChild className="h-12 rounded-full px-8 bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200">
                      <Link href="/podcast-mvp">AI Text to Speech Now</Link>
                  </Button>
                  <Button asChild variant="outline" className="h-12 rounded-full px-8 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white">
                      <Link href="/pricing">View Pricing Plans</Link>
                  </Button>
              </div>
           </div>

           {/* Right: Image Card */}
           <div className="order-1 lg:order-2 relative">
              <div className="aspect-video rounded-[2.5rem] bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-900 dark:to-indigo-900 overflow-hidden relative shadow-2xl flex items-center justify-center">
                  {/* Abstract Waves */}
                  <div className="absolute inset-0 opacity-30">
                      <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                          <path d="M0 50 Q 25 30 50 50 T 100 50 V 100 H 0 Z" fill="white" fillOpacity="0.1" />
                          <path d="M0 70 Q 25 50 50 70 T 100 70 V 100 H 0 Z" fill="white" fillOpacity="0.2" />
                      </svg>
                  </div>
                  
                  {/* Silhouette and Locks Art */}
                  <div className="relative w-full h-full">
                      {/* Silhouette - Simulated with CSS Mask or SVG */}
                      <div className="absolute right-0 bottom-0 w-2/3 h-full">
                          <div className="w-full h-full bg-gradient-to-t from-black/80 to-transparent mix-blend-overlay" />
                          {/* Use a placeholder image that looks like a silhouette if available, or just a dark shape */}
                          <Image 
                             src="https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80" 
                             alt="Security" 
                             fill 
                             unoptimized
                             className="object-cover mix-blend-multiply opacity-50 grayscale contrast-125"
                             style={{ maskImage: 'linear-gradient(to left, black 50%, transparent 100%)' }}
                          />
                      </div>

                      {/* Lock Icons Overlay */}
                      <div className="absolute left-16 top-1/2 -translate-y-1/2 z-10">
                          <div className="relative">
                              <div className="absolute inset-0 bg-white/20 blur-xl rounded-full" />
                              <Shield className="h-32 w-32 text-white/90 drop-shadow-2xl" strokeWidth={1} />
                              <Lock className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-12 w-12 text-blue-900 fill-blue-100" />
                          </div>
                      </div>
                      <div className="absolute left-48 top-2/3 z-0 opacity-50 transform scale-75 blur-[2px]">
                           <Lock className="h-24 w-24 text-white/50" />
                      </div>
                  </div>
              </div>
           </div>
        </div>
      </section>

      {/* Use Cases Section (5.png & 6.png Style) */}
      {isVoiceCloningUiEnabled ? (
      <section className="py-24 px-6 bg-white dark:bg-black transition-colors duration-300 border-t border-neutral-200 dark:border-white/5">
        <div className="mx-auto max-w-7xl">
          <div className="text-center mb-20">
            <span className="text-sm font-bold text-purple-600 dark:text-purple-400 tracking-widest uppercase mb-4 block">Everything You Need</span>
            <h2 className="text-3xl md:text-5xl font-bold text-neutral-900 dark:text-white mb-6">
              What are the use cases of Voice Cloning?
            </h2>
            <p className="text-lg text-neutral-600 dark:text-neutral-400 max-w-3xl mx-auto">
              With instant voice cloning, recreate your and any of your favorite sounds in just a few seconds.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 border-l border-t border-neutral-200 dark:border-white/10">
             {[
                {
                  icon: Headphones,
                  title: "Audiobooks & Podcasts",
                  desc: "Create audiobooks in the author's own voice with AI voice cloning. Make podcasts without endless recording sessions while keeping your unique sound and style."
                },
                {
                  icon: Megaphone,
                  title: "Marketing & Ads",
                  desc: "Voice cloning powers video ads and product updates. Make marketing content in your voice quickly without booking studio time, saving money while sounding professional."
                },
                {
                  icon: Users,
                  title: "Company Communications",
                  desc: "Leaders use voice cloning for team messages and meetings. Share updates in your voice across global teams, ensuring clear and consistent internal communication."
                },
                {
                  icon: Globe,
                  title: "Global Content Creation",
                  desc: "Voice cloning lets you speak in languages you don't know. Your voice can reach worldwide audiences naturally, making your content feel local in any market."
                },
                {
                  icon: GraduationCap,
                  title: "Learning & Development",
                  desc: "Voice cloning makes better training videos. Using familiar voices in learning materials helps teams stay engaged and remember more, while making updates simple."
                },
                {
                  icon: MessageSquareText,
                  title: "Customer Support",
                  desc: "Voice cloning personalizes customer experiences. Speak directly to customers in their language with your voice, building stronger connections and improving satisfaction."
                }
             ].map((item, i) => (
                <div key={i} className="group p-8 md:p-10 border-r border-b border-neutral-200 dark:border-white/10 hover:bg-neutral-50 dark:hover:bg-white/[0.02] transition-colors">
                   <div className="mb-6 inline-flex p-3 rounded-xl bg-neutral-100 dark:bg-white/5 text-neutral-900 dark:text-white group-hover:scale-110 transition-transform">
                      <item.icon className="h-6 w-6" />
                   </div>
                   <h3 className="text-xl font-bold text-neutral-900 dark:text-white mb-4">
                      {item.title}
                   </h3>
                   <p className="text-neutral-600 dark:text-neutral-400 leading-relaxed text-sm md:text-base">
                      {item.desc}
                   </p>
                </div>
             ))}
          </div>
        </div>
      </section>
      ) : null}





      {/* Launch Steps */}
      <section className="py-24 px-6 bg-white dark:bg-neutral-950 transition-colors duration-300">
        <div className="mx-auto max-w-7xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-neutral-900 dark:text-white mb-6">
              {home.launchStepsTitle}
            </h2>
            <p className="text-lg text-neutral-600 dark:text-neutral-400">
              {home.launchStepsSubtitle}
            </p>
          </div>
          
          <div className="grid gap-8 md:grid-cols-4 relative">
             {/* Connector Line (Desktop) */}
            <div className="hidden md:block absolute top-8 left-[10%] right-[10%] h-0.5 bg-gradient-to-r from-blue-100 via-blue-200 to-blue-100 dark:from-blue-900/0 dark:via-blue-900 dark:to-blue-900/0" />
            
            {home.launchSteps.map((step, index) => (
              <div key={index} className="relative text-center group">
                <div className="relative z-10 mb-6 flex justify-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 text-neutral-900 dark:text-white text-xl font-bold shadow-lg group-hover:border-blue-500/50 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-all duration-300">
                    {step.step}
                  </div>
                </div>
                <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-3">
                  {step.title}
                </h3>
                <p className="text-sm text-neutral-600 dark:text-neutral-400">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Key Features List */}
      <section className="py-24 px-6 bg-neutral-50 dark:bg-black transition-colors duration-300">
        <div className="mx-auto max-w-7xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-neutral-900 dark:text-white mb-4">
              {home.keyFeaturesTitle}
            </h2>
            <p className="text-lg text-neutral-600 dark:text-neutral-400">
              {home.keyFeaturesSubtitle}
            </p>
          </div>
          
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {home.keyFeatures.map((feature, index) => (
              <div key={index} className="flex p-6 rounded-2xl bg-white border border-neutral-200 shadow-sm dark:bg-white/[0.02] dark:border-white/5 dark:shadow-none hover:bg-neutral-50 dark:hover:bg-white/[0.04] transition-colors">
                <CheckCircle className="h-6 w-6 text-blue-600 dark:text-blue-500 mr-4 flex-shrink-0" />
                <div>
                  <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">
                    {feature.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-24 px-6 bg-neutral-50 dark:bg-black transition-colors duration-300">
        <div className="mx-auto max-w-3xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-neutral-900 dark:text-white mb-4">
              {home.faqTitle}
            </h2>
            <p className="text-lg text-neutral-600 dark:text-neutral-400">
              {home.faqSubtitle}
            </p>
          </div>
          
          <div className="space-y-4">
            {home.faqs.map((faq, index) => (
              <div key={index} className="rounded-2xl bg-white border border-neutral-200 dark:bg-white/[0.02] dark:border-white/5 overflow-hidden">
                <button
                  className="w-full p-6 text-left flex items-center justify-between hover:bg-neutral-50 dark:hover:bg-white/[0.02] transition-colors"
                  onClick={() => setOpenFaqIndex(openFaqIndex === index ? null : index)}
                >
                  <h3 className="text-lg font-medium text-neutral-900 dark:text-white pr-8">
                    {faq.question}
                  </h3>
                  <ChevronDown 
                    className={`h-5 w-5 text-neutral-500 transition-transform duration-300 ${
                      openFaqIndex === index ? 'rotate-180' : ''
                    }`} 
                  />
                </button>
                <div 
                  className={`grid transition-[grid-template-rows] duration-300 ease-out ${
                    openFaqIndex === index ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                  }`}
                >
                  <div className="overflow-hidden">
                    <div className="px-6 pb-6 pt-0 text-neutral-600 dark:text-neutral-400 leading-relaxed">
                      {faq.answer}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 px-6 bg-white dark:bg-neutral-950 transition-colors duration-300">
        <div className="mx-auto max-w-5xl">
          <div className="relative rounded-[2.5rem] overflow-hidden bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-900 dark:to-purple-900 px-6 py-20 text-center">
             <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150 mix-blend-overlay"></div>
            <div className="relative z-10">
              <h2 className="mb-6 text-4xl sm:text-5xl font-bold text-white tracking-tight">
                {home.finalCtaTitle}
              </h2>
              <p className="mb-10 text-xl text-blue-100 max-w-2xl mx-auto">
                {home.finalCtaSubtitle}
              </p>
              <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
                <Button size="lg" className="h-14 px-8 rounded-full text-lg bg-white text-blue-600 hover:bg-blue-50 dark:text-blue-900 font-bold border-0" asChild>
                   <Link href="/podcast-mvp">
                    <Rocket className="mr-2 h-5 w-5" />
                    {home.finalCtaButton}
                  </Link>
                </Button>
                <Button variant="outline" size="lg" className="h-14 px-8 rounded-full text-lg border-white/20 bg-white/10 text-white hover:bg-white/20 backdrop-blur-sm" asChild>
                   <Link href="/pricing">
                    {home.finalCtaSecondary}
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
