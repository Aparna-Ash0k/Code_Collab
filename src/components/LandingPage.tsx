import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { ThemeToggle } from './ThemeToggle';
import ParticleBackground from './ui/particles';
import '../styles/landing.css';
import { 
  Code2, 
  Users, 
  MessageSquare, 
  Zap, 
  Play,
  Sparkles,
  ArrowRight,
  Check,
  Github,
  Terminal,
  Eye,
  X,
  Star,
  Quote,
  ChevronLeft,
  ChevronRight,
  Twitter,
  BookOpen,
  Mail
} from 'lucide-react';

interface LandingPageProps {
  onGetStarted: () => void;
}

export function LandingPage({ onGetStarted }: LandingPageProps) {
  const [hoveredFeature, setHoveredFeature] = useState<number | null>(null);
  const [currentTestimonial, setCurrentTestimonial] = useState(0);
  const [email, setEmail] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      setIsSubmitted(true);
      setTimeout(() => setIsSubmitted(false), 3000);
    }
  };

  const testimonials = [
    {
      name: "Sarah Chen",
      role: "Tech Lead",
      company: "Stripe",
      avatar: "SC",
      content: "CodeCollab transformed how our team ships features. We went from weekly deployments to daily releases. The real-time collaboration is game-changing.",
      rating: 5,
      project: "Payment Infrastructure"
    },
    {
      name: "Mike Rodriguez",
      role: "Senior Engineer",
      company: "Discord",
      avatar: "MR",
      content: "Finally, a tool that actually understands how developers work. No more 'can you share your screen' every 5 minutes. Our code reviews are 3x faster now.",
      rating: 5,
      project: "Voice Chat Features"
    },
    {
      name: "Alex Kim",
      role: "Engineering Manager",
      company: "Vercel",
      avatar: "AK",
      content: "The onboarding experience for new developers has never been smoother. They can contribute meaningful code on day one instead of day thirty.",
      rating: 5,
      project: "Next.js Framework"
    },
    {
      name: "Jordan Taylor",
      role: "Full Stack Developer",
      company: "Linear",
      avatar: "JT",
      content: "CodeCollab eliminated our merge conflict nightmares. What used to take hours of coordination now happens automatically. It's like magic.",
      rating: 5,
      project: "Issue Tracking System"
    }
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTestimonial((prev) => (prev + 1) % testimonials.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [testimonials.length]);

  const features = [
    {
      icon: Code2,
      title: "Ship code 3x faster with real-time editing",
      description: "Multiple developers can edit the same file simultaneously without conflicts. See changes instantly as they happen.",
      benefit: "Reduce development time by 70%",
      demo: "Real-time collaborative editing in action",
      stats: "50% fewer merge conflicts",
      color: "text-blue-500"
    },
    {
      icon: MessageSquare,
      title: "Collaborate seamlessly across teams",
      description: "Built-in voice chat, screen sharing, and collaborative debugging tools that keep your team in sync.",
      benefit: "Improve team productivity",
      demo: "Team collaboration features demo", 
      stats: "3x faster code reviews",
      color: "text-green-500"
    },
    {
      icon: Users,
      title: "Stay in sync, never lose context",
      description: "Shared cursors, live comments, and synchronized file navigation ensure everyone stays on the same page.",
      benefit: "Zero context switching",
      demo: "Context preservation in action",
      stats: "90% less time spent explaining code",
      color: "text-purple-500"
    },
    {
      icon: Terminal,
      title: "Enterprise-grade security & reliability",
      description: "End-to-end encryption, SSO integration, and 99.9% uptime SLA. Your code stays secure and accessible.",
      benefit: "Peace of mind for your team",
      demo: "Security features overview",
      stats: "SOC 2 Type II compliant",
      color: "text-orange-500"
    }
  ];

  const stats = [
    { number: "10+", label: "Programming Languages" },
    { number: "∞", label: "Collaborators" },
    { number: "24/7", label: "Availability" },
    { number: "100%", label: "Free & Open Source" }
  ];

  return (
    <div className="min-h-screen bg-background">
      <ParticleBackground />
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 animate-slide-in-left">
        <div className="container flex h-20 items-center justify-between px-6 md:px-8 max-w-7xl mx-auto">
          <div className="flex items-center gap-3 animate-fade-in-up">
            <div className="flex h-10 w-10 items-center justify-center">
              <img 
                src="/codecollab-logo.svg" 
                alt="CodeCollab Logo" 
                className="h-8 w-8 logo-responsive"
                style={{ filter: 'var(--logo-filter, none)' }}
              />
            </div>
            <span className="text-2xl font-bold">CodeCollab</span>
          </div>
          <div className="flex items-center gap-6 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
            <ThemeToggle />
            <Button 
              onClick={onGetStarted}
              className="group btn-ripple px-6 py-3 text-lg"
            >
              Get Started
              <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden container-spacing flex items-center justify-center" style={{ minHeight: '100vh' }}>
        {/* Animated Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/10" />
        
        {/* Floating Particles Animation */}
        <div className="absolute inset-0">
          {[...Array(50)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1 h-1 bg-primary rounded-full opacity-30"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
              }}
              animate={{
                y: [0, -20, 0],
                opacity: [0.3, 0.8, 0.3],
              }}
              transition={{
                duration: 2 + Math.random() * 2,
                repeat: Infinity,
                delay: Math.random() * 2,
              }}
            />
          ))}
        </div>

        <div className="container relative mx-auto text-center max-w-6xl z-10 px-6 lg:px-8">
          <div className="mx-auto max-w-4xl flex flex-col justify-center min-h-screen py-20">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              <Badge variant="secondary" className="mb-12 px-6 py-3 text-sm">
                <Sparkles className="mr-2 h-4 w-4" />
                Real-time Collaborative IDE
              </Badge><div style={{ height: '1rem' }}></div>
            </motion.div>
            
            <motion.h1 
                className="mb-24 text-4xl font-bold tracking-tight md:text-6xl lg:text-7xl leading-relaxed mobile-text-responsive"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
            >
              Code Together,
              <br /><div style={{ height: '1rem' }}></div>
              <motion.span 
                className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent"
                animate={{
                  backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              >
                Build Faster
              </motion.span><div style={{ height: '1rem' }}></div>
            </motion.h1>
            
            <motion.p 
            className="mx-auto mb-24 max-w-2xl text-lg text-muted-foreground md:text-xl leading-relaxed"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.3 }}
            >
              The ultimate collaborative coding platform that brings teams together. 
              Edit code in real-time, chat seamlessly, and ship features faster than ever before.
            </motion.p>
            <div style={{ height: '2rem' }}></div>
            <motion.div 
            className="flex flex-col gap-8 sm:flex-row sm:justify-center sm:gap-12 mb-24"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
            >
              <Button 
                size="lg" 
                onClick={onGetStarted}
                className="group px-8 py-4 text-lg btn-ripple card-hover-lift"
              >
                <Play className="mr-2 h-5 w-5" />
                Start Coding Now
                <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Button><div style={{ width: '1rem' }}></div>
              <Button 
                size="lg" 
                variant="outline" 
                className="px-8 py-4 text-lg card-hover-lift"
                onClick={() => {
                  document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                <Eye className="mr-2 h-5 w-5" />
                See Features
              </Button>
            </motion.div>
                <div style={{ height: '2rem' }}></div>
            {/* Enhanced Stats */}
            <motion.div 
              className="mt-24 grid grid-cols-2 gap-12 md:grid-cols-4 md:gap-16"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.5 }}
            >
              {stats.map((stat, index) => (
                <motion.div 
                  key={index} 
                  className="text-center"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.5 + index * 0.1 }}
                  whileHover={{ scale: 1.05 }}
                >
                  <motion.div 
                    className="text-3xl font-bold text-primary md:text-4xl mb-2"
                    animate={{ 
                      scale: [1, 1.05, 1],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      delay: index * 0.5
                    }}
                  >
                    {stat.number}
                  </motion.div>
                  <div className="text-sm text-muted-foreground">{stat.label}</div>
                </motion.div>
              ))}
            </motion.div>


          </div>
        </div>
      </section>

      {/* Problem/Solution Section - True Side-by-Side Layout */}
      <section className="py-16 md:py-20 bg-muted/30">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 md:py-20">
          {/* Side-by-Side Grid */}
          <div className="grid md:grid-cols-2 gap-12 md:gap-16 lg:gap-24 items-start">
            {/* Left Side - Problems */}
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true }}
              className="space-y-8"
            >
              {/* Problem Header */}
              <div className="space-y-6">
                <Badge variant="destructive" className="px-4 py-2 text-sm font-medium">
                  THE PROBLEM
                </Badge><div style={{ height: '1rem' }}></div>
                <h2 className="text-3xl lg:text-4xl font-bold leading-tight">
                  Development shouldn't be this{' '}
                  <span className="text-destructive">complicated</span>
                </h2><div style={{ height: '2rem' }}></div>
              </div>

              {/* Problem Cards */}
              <div className="space-y-4">
                {[
                  "Tired of emailing code back and forth?",
                  "End the merge conflict nightmare.",
                  "Stop switching between Slack and your IDE."
                ].map((problem, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -30 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.6, delay: index * 0.1 }}
                    viewport={{ once: true }}
                    className="flex items-start gap-4 p-4 bg-background rounded-xl border border-destructive/20"
                  >
                    <X className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                    <p className="text-muted-foreground">{problem}</p>
                  </motion.div>
                ))}
              </div>


            </motion.div>

            {/* Right Side - Solutions */}
            <motion.div
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              viewport={{ once: true }}
              className="space-y-8"
            >
              {/* Solution Header */}
              <div className="space-y-6">
                <Badge className="px-4 py-2 text-sm font-medium bg-green-500 hover:bg-green-600">
                  THE SOLUTION
                </Badge><div style={{ height: '1rem' }}></div>
                <h2 className="text-3xl lg:text-4xl font-bold leading-tight">
                  Here's how CodeCollab{' '}
                  <span className="text-green-600">solves this</span>
                </h2><div style={{ height: '2rem' }}></div>
              </div>

              {/* Solution Cards */}
              <div className="space-y-4">
                {[
                  "Real-time collaborative editing",
                  "Intelligent conflict resolution",
                  "Integrated team communication"
                ].map((solution, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: 30 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.6, delay: index * 0.1 }}
                    viewport={{ once: true }}
                    className="flex items-start gap-4 p-4 bg-green-50 dark:bg-green-950/20 rounded-xl border border-green-200 dark:border-green-800"
                  >
                    <Check className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <p className="text-foreground">{solution}</p>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>

                <div style={{ height: '2rem' }}></div>
              {/* Before/After Comparison */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.6 }}
                viewport={{ once: true }}
                className="mt-12 p-6 bg-gradient-to-r from-blue-50 to-green-50 dark:from-blue-950/20 dark:to-green-950/20 rounded-2xl border"
              >
                <div className="flex items-center justify-between">
                  <div className="text-center flex-1">
                    <div className="text-2xl mb-2">⏱️</div>
                    <div className="text-xs text-muted-foreground mb-1">Before</div>
                    <div className="text-sm font-semibold text-foreground">Hours of conflicts</div>
                  </div>
                  
                  <motion.div 
                    className="mx-6"
                    animate={{ x: [0, 5, 0] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <ArrowRight className="h-5 w-5 text-muted-foreground" />
                  </motion.div>
                  
                  <div className="text-center flex-1">
                    <div className="text-2xl mb-2">⚡</div>
                    <div className="text-xs text-muted-foreground mb-1">After</div>
                    <div className="text-sm font-semibold text-green-600">Instant collaboration</div>
                  </div>
                </div>
              </motion.div>

        </div>
      </section>
      <div style={{ height: '15rem' }}></div>
      {/* Features Section */}
      <section id="features" className="py-16 md:py-20 container-spacing">
        <div className="container mx-auto max-w-6xl px-6 lg:px-8 py-16 md:py-20">
          <motion.div 
            className="text-center mb-20"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <Badge variant="secondary" className="mb-6 px-6 py-3 text-sm">
              Features
            </Badge><div style={{ height: '2rem' }}></div>
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl lg:text-5xl mb-4">
              Everything you need to{' '}
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                collaborate effectively
              </span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Powerful features designed by developers, for developers. Stop fighting your tools and start building amazing software together.
            </p>
          </motion.div>
                <div style={{ height: '2rem' }}></div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2 max-w-5xl mx-auto">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: index * 0.1 }}
                viewport={{ once: true }}
                onHoverStart={() => setHoveredFeature(index)}
                onHoverEnd={() => setHoveredFeature(null)}
                className="group relative"
              >
                <Card className="h-full p-8 bg-background/50 rounded-2xl border hover:border-primary/30 transition-all duration-300 hover:shadow-xl hover:shadow-primary/10">
                  {/* Icon and Badge */}
                  <div className="flex items-start justify-between mb-6">
                    <motion.div
                      className={`flex-shrink-0 w-12 h-12 bg-gradient-to-br from-primary to-accent rounded-xl flex items-center justify-center transition-all duration-300 ${
                        hoveredFeature === index ? 'scale-110 rotate-3' : ''
                      }`}
                      whileHover={{ scale: 1.1, rotate: 5 }}
                      transition={{ duration: 0.3 }}
                    >
                      <feature.icon className="h-6 w-6 text-primary-foreground" />
                    </motion.div>
                    
                    <motion.span
                      className="text-xs text-green-600 bg-green-100 dark:bg-green-950/50 dark:text-green-400 px-3 py-1 rounded-full"
                      initial={{ opacity: 0, scale: 0.8 }}
                      whileInView={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.5 }}
                      viewport={{ once: true }}
                    >
                      {feature.stats}
                    </motion.span>
                  </div>

                  {/* Content */}
                  <CardContent className="p-0 space-y-4">
                    <CardTitle className={`text-2xl group-hover:${feature.color} transition-colors duration-300`}>
                      {feature.title}
                    </CardTitle>
                    
                    <CardDescription className="text-base leading-relaxed">
                      {feature.description}
                    </CardDescription>

                    <div className="pt-4 border-t border-border/50">
                      <p className="text-sm text-primary mb-4">
                        ✓ {feature.benefit}
                      </p>
                    </div>
                  </CardContent>

                  {/* Interactive Demo Area */}
                  <motion.div
                    className="mt-6 aspect-video bg-gradient-to-br from-muted/50 to-muted/30 rounded-xl overflow-hidden border border-border/50"
                    whileHover={{ scale: 1.02 }}
                    transition={{ duration: 0.3 }}
                  >
                    <div className="h-full flex items-center justify-center">
                      {hoveredFeature === index ? (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="text-center p-6"
                        >
                          <motion.div
                            className={`w-16 h-16 bg-gradient-to-br from-primary to-accent rounded-full flex items-center justify-center mx-auto mb-4`}
                            animate={{ rotate: 360 }}
                            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                          >
                            <feature.icon className="h-8 w-8 text-primary-foreground" />
                          </motion.div>
                          <p className="text-foreground font-medium">{feature.demo}</p>
                        </motion.div>
                      ) : (
                        <div className="text-center p-6">
                          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                            <feature.icon className="h-8 w-8 text-muted-foreground" />
                          </div>
                          <p className="text-muted-foreground">Hover to see demo</p>
                        </div>
                      )}
                    </div>
                  </motion.div>

                  {/* Hover Overlay */}
                  {hoveredFeature === index && (
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-br from-primary/5 to-accent/5 rounded-2xl pointer-events-none"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.3 }}
                    />
                  )}
                </Card>
              </motion.div>
            ))}
          </div>
            <div style={{ height: '4rem' }}></div>
          {/* Additional Feature Highlights */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            viewport={{ once: true }}
            className="mt-20 text-center"
          >
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto">
              {[
                { number: "10ms", label: "Average latency" },
                { number: "99.9%", label: "Uptime SLA" },
                { number: "50+", label: "Language support" },
                { number: "24/7", label: "Expert support" }
              ].map((stat, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                  viewport={{ once: true }}
                  whileHover={{ scale: 1.05 }}
                  className="text-center"
                ><div style={{ height: '2rem' }}></div>
                  <div className="text-3xl text-primary font-bold mb-2">{stat.number}</div>
                  <div className="text-sm text-muted-foreground">{stat.label}</div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      <div style={{ height: '10rem' }}></div>
      {/* Social Proof Section */}
      <section className="py-20 md:py-24 bg-muted text-foreground overflow-hidden" style={{ marginTop: '4rem', marginBottom: '4rem' }}>
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-32 md:py-40">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-center space-y-4 mb-20"
          >
            <Badge variant="secondary" className="mb-6 px-6 py-3 text-sm">
              Social Proof
            </Badge>
            <h2 className="text-4xl lg:text-5xl font-bold max-w-3xl mx-auto leading-tight">
              Join{' '}
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                5,000+ developers
              </span>{' '}
              already collaborating
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              See why teams at the world's most innovative companies choose CodeCollab for their development workflow.
            </p>
          </motion.div>

          <div className="grid lg:grid-cols-3 gap-16 items-start">
            {/* Left - Stats */}
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true }}
              className="space-y-8"
            >
             
            </motion.div>

            {/* Center - Main Testimonial */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              viewport={{ once: true }}
              className="lg:col-span-2"
            >
              <div className="relative">
                {/* Testimonial Card */}
                <motion.div
                  key={currentTestimonial}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5 }}
                  className="bg-background/50 rounded-2xl p-8 lg:p-12 border"
                >
                  {/* Quote Icon */}
                  <Quote className="h-12 w-12 text-primary mb-6" />

                  {/* Rating */}
                  <div className="flex items-center gap-1 mb-6">
                    {[...Array(testimonials[currentTestimonial].rating)].map((_, i) => (
                      <Star key={i} className="h-5 w-5 text-yellow-400 fill-yellow-400" />
                    ))}
                  </div>

                  {/* Content */}
                  <blockquote className="text-xl lg:text-2xl leading-relaxed mb-8">
                    "{testimonials[currentTestimonial].content}"
                  </blockquote>

                  {/* Author */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-primary to-accent rounded-full flex items-center justify-center text-primary-foreground text-lg font-semibold">
                        {testimonials[currentTestimonial].avatar}
                      </div>
                      <div>
                        <div className="text-lg font-semibold">{testimonials[currentTestimonial].name}</div>
                        <div className="text-muted-foreground">
                          {testimonials[currentTestimonial].role} at {testimonials[currentTestimonial].company}
                        </div>
                        <div className="text-sm text-primary mt-1">
                          Working on: {testimonials[currentTestimonial].project}
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>

                {/* Navigation */}
                <div className="flex items-center justify-between mt-8">
                  <div className="flex items-center gap-2">
                    {testimonials.map((_, index) => (
                      <button
                        key={index}
                        onClick={() => setCurrentTestimonial(index)}
                        className={`w-3 h-3 rounded-full transition-all duration-300 ${
                          index === currentTestimonial 
                            ? 'bg-primary w-8' 
                            : 'bg-muted-foreground/30 hover:bg-muted-foreground/50'
                        }`}
                      />
                    ))}
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentTestimonial((prev) => 
                        prev === 0 ? testimonials.length - 1 : prev - 1
                      )}
                      className="w-10 h-10 p-0"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentTestimonial((prev) => 
                        (prev + 1) % testimonials.length
                      )}
                      className="w-10 h-10 p-0"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

    <div style={{ height: '10rem' }}></div>

      {/* Call to Action */}
      <section className="py-20 md:py-24 container-spacing relative overflow-hidden" style={{ marginTop: '4rem', marginBottom: '4rem' }}>
        {/* Background Effects */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-accent/10" />
          {[...Array(30)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1 h-1 bg-primary rounded-full opacity-30"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
              }}
              animate={{
                y: [0, -10, 0],
                opacity: [0.3, 0.7, 0.3],
              }}
              transition={{
                duration: 3 + Math.random() * 2,
                repeat: Infinity,
                delay: Math.random() * 2,
              }}
            />
          ))}
        </div>

        <div className="container mx-auto max-w-6xl relative z-10 px-6 lg:px-8">
          <Card className="relative overflow-hidden">
            <CardContent className="relative p-10 md:p-12 lg:p-16 text-center">
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
                viewport={{ once: true }}
                className="space-y-8"
              >
                {/* Headline */}
                <div className="space-y-4">
                  <h2 className="text-3xl font-bold tracking-tight md:text-4xl lg:text-5xl">
                    Ready to transform your{' '}
                    <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                      development workflow?
                    </span>
                  </h2>
                  <p className="text-lg text-muted-foreground mb-8 max-w-3xl mx-auto leading-relaxed">
                    Join thousands of developers who have already revolutionized how they code together.
                    Start collaborating in real-time today.
                  </p>
                </div>

                {/* Benefits Bar */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.8, delay: 0.2 }}
                  viewport={{ once: true }}
                  className="flex flex-col sm:flex-row items-center justify-center gap-6 text-sm text-muted-foreground mb-8"
                >
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    <span>No credit card required</span>
                  </div>
                  <div className="hidden sm:block w-1 h-1 bg-muted-foreground rounded-full"></div>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    <span>Setup in under 2 minutes</span>
                  </div>
                  <div className="hidden sm:block w-1 h-1 bg-muted-foreground rounded-full"></div>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    <span>Free for teams up to 5</span>
                  </div>
                </motion.div>

                {/* CTA Buttons */}
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.4 }}
                  viewport={{ once: true }}
                  className="flex flex-col gap-4 sm:flex-row sm:justify-center mobile-stack"
                >
                  <Button 
                    size="lg" 
                    onClick={onGetStarted}
                    className="px-12 py-6 text-xl group btn-ripple card-hover-lift mobile-full"
                  >
                    <Zap className="mr-2 h-5 w-5" />
                    Start Your Free Collaboration Session
                    <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
                  </Button>
                  <Button 
                    size="lg" 
                    variant="outline" 
                    className="px-8 py-6 text-xl card-hover-lift mobile-full"
                    asChild
                  >
                    <a href="https://github.com" target="_blank" rel="noopener noreferrer">
                      <Github className="mr-2 h-5 w-5" />
                      View on GitHub
                    </a>
                  </Button>
                </motion.div>

                {/* Email Signup */}
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.6 }}
                  viewport={{ once: true }}
                  className="max-w-md mx-auto"
                >
                  <p className="text-muted-foreground mb-4">Or get updates on new features:</p>
                  
                  {!isSubmitted ? (
                    <form onSubmit={handleSubmit} className="flex gap-3">
                      <Input
                        type="email"
                        placeholder="Enter your email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="flex-1"
                        required
                      />
                      <Button 
                        type="submit"
                        variant="outline"
                        className="px-6"
                      >
                        <Mail className="h-4 w-4" />
                      </Button>
                    </form>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="flex items-center justify-center gap-2 p-3 bg-green-100 dark:bg-green-950/50 border border-green-200 dark:border-green-800 rounded-lg text-green-700 dark:text-green-300"
                    >
                      <Check className="w-5 h-5" />
                      <span>Thanks! We'll keep you updated.</span>
                    </motion.div>
                  )}
                </motion.div>

                <motion.p 
                  className="text-sm text-muted-foreground"
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  transition={{ delay: 0.8 }}
                  viewport={{ once: true }}
                >
                  Trusted by developers worldwide
                </motion.p>
              </motion.div>
            </CardContent>
          </Card>
        </div>
      </section>
    <div style={{ height: '10rem' }}></div>
      {/* Footer */}
      <footer className="border-t py-16 md:py-20 container-spacing">
        <div className="container mx-auto max-w-7xl">
          {/* Footer Links */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-16">
            {/* Product */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
            >
              <h3 className="font-semibold mb-4">Product</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#features" className="hover:text-foreground transition-colors">Features</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Pricing</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Enterprise</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Security</a></li>
              </ul>
            </motion.div>

            {/* Developers */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              viewport={{ once: true }}
            >
              <h3 className="font-semibold mb-4">Developers</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground transition-colors">Documentation</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">API Reference</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">SDKs</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Integrations</a></li>
              </ul>
            </motion.div>

            {/* Company */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              viewport={{ once: true }}
            >
              <h3 className="font-semibold mb-4">Company</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground transition-colors">About</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Blog</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Careers</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Contact</a></li>
              </ul>
            </motion.div>

            {/* Community */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              viewport={{ once: true }}
            >
              <h3 className="font-semibold mb-4">Community</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground transition-colors">Discord</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">GitHub</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Twitter</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Stack Overflow</a></li>
              </ul>
            </motion.div>
          </div>
    <div style={{ height: '7rem' }}></div>
          {/* Bottom Bar */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            viewport={{ once: true }}
            className="pt-8 border-t border-border flex flex-col md:flex-row items-center justify-between gap-4"
          >
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center">
                  <img 
                    src="/codecollab-logo.svg" 
                    alt="CodeCollab Logo" 
                    className="h-6 w-6 logo-responsive"
                    style={{ filter: 'var(--logo-filter, none)' }}
                  />
                </div>
                <span className="font-semibold text-lg">CodeCollab</span>
              </div>
              <div className="text-muted-foreground text-sm">
                © 2025 CodeCollab. All rights reserved.
              </div>
            </div>

            <div className="flex items-center gap-6">
              <p className="text-base text-muted-foreground text-center">
                Built to collaborate
              </p>
              <div className="flex items-center gap-4">
                <Button variant="ghost" size="sm" className="card-hover-lift p-3" asChild>
                  <a href="https://github.com" target="_blank" rel="noopener noreferrer">
                    <Github className="h-5 w-5" />
                  </a>
                </Button>
                <Button variant="ghost" size="sm" className="card-hover-lift p-3" asChild>
                  <a href="https://twitter.com" target="_blank" rel="noopener noreferrer">
                    <Twitter className="h-5 w-5" />
                  </a>
                </Button>
                <Button variant="ghost" size="sm" className="card-hover-lift p-3" asChild>
                  <a href="#" target="_blank" rel="noopener noreferrer">
                    <BookOpen className="h-5 w-5" />
                  </a>
                </Button>
                <ThemeToggle />
              </div>
            </div>
          </motion.div>
        </div>
      </footer>
    </div>
  );
}