import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { ThemeToggle } from './ThemeToggle';
import '../styles/landing.css';
import { 
  Code2, 
  Users, 
  MessageSquare, 
  Zap, 
  Play,
  ArrowRight,
  Check,
  Github,
  Terminal,
  Search,
  ChevronDown,
  TrendingUp,
  Shield,
  Cpu,
  Globe
} from 'lucide-react';

import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { ThemeToggle } from './ThemeToggle';
import '../styles/landing.css';
import { 
  Code2, 
  MessageSquare, 
  Zap, 
  Play,
  ArrowRight,
  Check,
  Github,
  Search,
  TrendingUp,
  Shield,
  Activity,
  Layers,
  Globe,
  Smartphone,
  ChevronRight
} from 'lucide-react';

interface LandingPageProps {
  onGetStarted: () => void;
}

export function LandingPage({ onGetStarted }: LandingPageProps) {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [activeMetric, setActiveMetric] = useState(0);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };

    window.addEventListener('mousemove', handleMouseMove);
    
    // Cycle through metrics
    const metricInterval = setInterval(() => {
      setActiveMetric(prev => (prev + 1) % 4);
    }, 3000);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      clearInterval(metricInterval);
    };
  }, []);

  const navigationItems = [
    { label: 'Features', href: '#features' },
    { label: 'Solutions', href: '#solutions' },
    { label: 'Developers', href: '#developers' },
    { label: 'Enterprise', href: '#enterprise' }
  ];

  const features = [
    {
      icon: Code2,
      title: "Real-time Editing",
      description: "Collaborative code editing with live cursors and instant synchronization",
      metric: "99.9%",
      label: "Uptime",
      color: "from-blue-500 to-cyan-400"
    },
    {
      icon: MessageSquare,
      title: "Integrated Chat",
      description: "Built-in communication without leaving your development environment",
      metric: "< 50ms",
      label: "Latency",
      color: "from-green-500 to-emerald-400"
    },
    {
      icon: Shield,
      title: "Enterprise Security",
      description: "Bank-grade encryption and enterprise-level security controls",
      metric: "256-bit",
      label: "Encryption",
      color: "from-purple-500 to-violet-400"
    },
    {
      icon: TrendingUp,
      title: "Performance Analytics",
      description: "Real-time insights into team productivity and code quality metrics",
      metric: "10x",
      label: "Faster Deploy",
      color: "from-orange-500 to-yellow-400"
    }
  ];

  const technologies = [
    { name: "React", icon: Activity, description: "Modern UI framework" },
    { name: "TypeScript", icon: Layers, description: "Type-safe development" },
    { name: "Firebase", icon: Globe, description: "Real-time database" },
    { name: "WebRTC", icon: Smartphone, description: "Peer-to-peer communication" }
  ];

  const metrics = [
    { value: "10K+", label: "Active developers", change: "+23%" },
    { value: "1M+", label: "Lines of code", change: "+156%" },
    { value: "99.9%", label: "Uptime", change: "+0.1%" },
    { value: "< 50ms", label: "Latency", change: "-15%" }
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white relative overflow-hidden">
      {/* Animated background */}
      <div className="fixed inset-0 opacity-30">
        <div 
          className="absolute inset-0 transition-all duration-500 ease-out"
          style={{
            background: `radial-gradient(600px circle at ${mousePosition.x}px ${mousePosition.y}px, rgba(59, 130, 246, 0.1), transparent 40%)`
          }}
        />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:50px_50px]" />
      </div>

      {/* Header */}
      <header className="fixed top-0 w-full z-50 bg-black/80 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                <div className="relative">
                  <img 
                    src="/codecollab-logo.svg" 
                    alt="CodeCollab" 
                    className="h-7 w-7 brightness-0 invert"
                  />
                  <div className="absolute inset-0 bg-blue-500/20 blur-lg rounded-full animate-pulse" />
                </div>
                <span className="text-lg font-semibold tracking-tight">CodeCollab</span>
              </div>
            </div>

            <nav className="hidden md:flex items-center space-x-8">
              {navigationItems.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  className="text-gray-400 hover:text-white transition-colors duration-200 text-sm font-medium"
                >
                  {item.label}
                </a>
              ))}
            </nav>

            <div className="flex items-center space-x-3">
              <Button 
                variant="ghost" 
                size="sm"
                className="text-gray-400 hover:text-white border border-white/20 hover:border-white/40 px-3 py-1.5 h-8"
              >
                <Search className="h-3.5 w-3.5 mr-1.5" />
                Search
              </Button>
              <Button 
                onClick={onGetStarted}
                className="bg-blue-600 hover:bg-blue-700 text-white border-0 px-4 py-1.5 h-8 text-sm"
              >
                Get started
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-2 mb-8">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-sm text-gray-300">Real-time collaborative IDE</span>
            </div>
            
            <h1 className="text-6xl md:text-8xl lg:text-9xl font-black tracking-tighter mb-8">
              <span className="block text-white">EMPOWER</span>
              <span className="block bg-gradient-to-r from-blue-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent">
                YOUR TEAM
              </span>
            </h1>
            
            <p className="text-xl text-gray-400 max-w-3xl mx-auto mb-12 leading-relaxed">
              Take control of your development workflow with CodeCollab — a secure, smart, and easy-to-use 
              collaborative coding platform.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
              <Button 
                onClick={onGetStarted}
                className="bg-white text-black hover:bg-gray-100 px-8 py-3 text-lg font-semibold flex items-center gap-2"
              >
                <Play className="h-5 w-5" />
                Start coding now
              </Button>
              <Button 
                variant="outline"
                className="border-white/20 text-white hover:bg-white/10 px-8 py-3 text-lg"
              >
                View demo
                <ChevronRight className="h-5 w-5 ml-2" />
              </Button>
            </div>
          </div>

          {/* Interactive Converter Widget */}
          <div className="max-w-4xl mx-auto">
            <Card className="bg-white/5 border-white/10 backdrop-blur-xl">
              <CardContent className="p-6">
                <div className="grid md:grid-cols-3 gap-6 items-center">
                  <div className="text-center">
                    <div className="text-sm text-gray-400 mb-2">From:</div>
                    <div className="text-2xl font-bold text-white">Traditional IDE</div>
                  </div>
                  
                  <div className="flex justify-center">
                    <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                      <ArrowRight className="h-6 w-6 text-white" />
                    </div>
                  </div>
                  
                  <div className="text-center">
                    <div className="text-sm text-gray-400 mb-2">To:</div>
                    <div className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                      {metrics[activeMetric].value}
                    </div>
                    <div className="text-sm text-gray-400">{metrics[activeMetric].label}</div>
                    <div className="text-xs text-green-400">{metrics[activeMetric].change}</div>
                  </div>
                </div>
                
                <div className="mt-6 text-center">
                  <Button 
                    onClick={onGetStarted}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2"
                  >
                    Start collaborating
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 md:py-32 lg:py-40 container-spacing">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/10" />
        <div className="container relative mx-auto text-center max-w-7xl">
          <div className="mx-auto max-w-5xl">
            <Badge variant="secondary" className="mb-8 px-6 py-3 text-sm animate-fade-in-up">
              <Sparkles className="mr-2 h-4 w-4" />
              Real-time Collaborative IDE
            </Badge>
            
            <h1 className="mb-10 text-5xl font-bold tracking-tight md:text-7xl lg:text-8xl leading-tight animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
              Code Together,
              <br />
              <span className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent animate-gradient">
                Build Faster
              </span>
            </h1>
            
            <p className="mx-auto mb-12 max-w-3xl text-xl text-muted-foreground md:text-2xl leading-relaxed animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
              The ultimate collaborative coding platform that brings teams together. 
              Edit code in real-time, chat seamlessly, and ship features faster than ever before.
            </p>
            
            <div className="flex flex-col gap-6 sm:flex-row sm:justify-center mb-20 animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
              <Button 
                size="lg" 
                onClick={onGetStarted}
                className="group px-10 py-6 text-xl font-semibold btn-ripple card-hover-lift hover:scale-105 transition-all duration-200"
              >
                <Play className="mr-3 h-6 w-6" />
                Start Coding Now
                <ArrowRight className="ml-3 h-6 w-6 transition-transform group-hover:translate-x-1" />
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                className="px-10 py-6 text-xl card-hover-lift hover:scale-105 transition-all duration-200"
                onClick={() => {
                  document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                <Eye className="mr-3 h-6 w-6" />
                See Features
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-muted/30 container-spacing">
        <div className="container mx-auto max-w-7xl">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4 animate-fade-in-up">
            {stats.map((stat, index) => (
              <div key={index} className="text-center animate-scale-in" style={{ animationDelay: `${index * 0.1}s` }}>
                <div className="text-4xl font-bold text-primary md:text-5xl mb-3">{stat.number}</div>
                <div className="text-base text-muted-foreground font-medium">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 md:py-32 container-spacing">
        <div className="container mx-auto max-w-7xl">
          <div className="text-center mb-20 animate-fade-in-up">
            <h2 className="text-4xl font-bold tracking-tight md:text-6xl mb-6">
              Everything you need to collaborate
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              Powerful features designed to make team coding effortless and productive
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-2 max-w-6xl mx-auto">
            {features.map((feature, index) => (
              <Card 
                key={index}
                className={`group relative overflow-hidden transition-all duration-300 hover:shadow-2xl hover:-translate-y-2 animate-scale-in border-0 bg-card/50 backdrop-blur-sm`}
                style={{ animationDelay: `${index * 0.2}s` }}
                onMouseEnter={() => setHoveredFeature(index)}
                onMouseLeave={() => setHoveredFeature(null)}
              >
                <CardHeader className="pb-6">
                  <div className={`inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/10 transition-all duration-300 mb-6 ${
                    hoveredFeature === index ? `scale-110 shadow-lg` : ''
                  }`}>
                    <feature.icon className={`h-8 w-8 transition-all duration-300 ${
                      hoveredFeature === index ? feature.color : 'text-primary'
                    }`} />
                  </div>
                  <CardTitle className="text-2xl mb-4 group-hover:text-primary transition-colors">
                    {feature.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <CardDescription className="text-lg leading-relaxed text-muted-foreground">
                    {feature.description}
                  </CardDescription>
                </CardContent>
                {hoveredFeature === index && (
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent pointer-events-none animate-fade-in-up" />
                )}
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Technology Stack */}
      <section className="py-24 md:py-32 container-spacing bg-muted/30">
        <div className="container mx-auto max-w-7xl">
          <div className="text-center mb-20 animate-fade-in-up">
            <h2 className="text-4xl font-bold tracking-tight md:text-6xl mb-6">
              Built with Modern Technologies
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              Leveraging the best tools and frameworks for performance, security, and developer experience
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3 max-w-6xl mx-auto">
            {technologies.map((tech, index) => (
              <Card 
                key={index} 
                className={`text-center group hover:shadow-xl hover:-translate-y-1 transition-all duration-300 animate-slide-in-left border-0 bg-background/80 backdrop-blur-sm`}
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <CardContent className="p-8">
                  <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/10 mb-6 mx-auto group-hover:scale-110 transition-transform duration-300">
                    <div className="h-8 w-8 bg-primary/20 rounded-lg"></div>
                  </div>
                  <h3 className="font-semibold text-2xl mb-4 group-hover:text-primary transition-colors">
                    {tech.name}
                  </h3>
                  <p className="text-muted-foreground text-lg leading-relaxed">{tech.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Call to Action */}
      <section className="py-24 md:py-32 container-spacing">
        <div className="container mx-auto max-w-7xl">
          <Card className="relative overflow-hidden animate-scale-in border-0 bg-gradient-to-br from-primary/10 via-background to-primary/5">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-primary/10 to-transparent" />
            <CardContent className="relative p-16 md:p-20 lg:p-24 text-center">
              <div className="max-w-4xl mx-auto">
                <h2 className="text-4xl font-bold tracking-tight md:text-6xl mb-8 animate-fade-in-up">
                  Ready to transform your workflow?
                </h2>
                <p className="text-xl text-muted-foreground mb-12 max-w-3xl mx-auto leading-relaxed animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
                  Join thousands of developers who are already coding together with CodeCollab. 
                  Start your first collaborative project in minutes.
                </p>
                <div className="flex flex-col gap-6 sm:flex-row sm:justify-center mb-12 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
                  <Button 
                    size="lg" 
                    onClick={onGetStarted}
                    className="px-12 py-6 text-xl font-semibold group btn-ripple hover:scale-105 transition-all duration-200 bg-primary hover:bg-primary/90"
                  >
                    <Zap className="mr-3 h-6 w-6" />
                    Get Started Free
                    <ArrowRight className="ml-3 h-6 w-6 transition-transform group-hover:translate-x-1" />
                  </Button>
                  <Button 
                    size="lg" 
                    variant="outline" 
                    className="px-12 py-6 text-xl hover:scale-105 transition-all duration-200 border-2"
                    asChild
                  >
                    <a href="https://github.com" target="_blank" rel="noopener noreferrer">
                      <Github className="mr-3 h-6 w-6" />
                      View on GitHub
                    </a>
                  </Button>
                </div>
                
                <div className="flex items-center justify-center gap-8 text-base text-muted-foreground flex-wrap animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
                  <div className="flex items-center gap-2">
                    <Check className="h-5 w-5 text-green-500" />
                    Free forever
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-5 w-5 text-green-500" />
                    No credit card required
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-5 w-5 text-green-500" />
                    Open source
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-20 container-spacing bg-muted/20 animate-fade-in-up">
        <div className="container mx-auto max-w-7xl">
          <div className="flex flex-col items-center justify-between gap-8 md:flex-row">
            <div className="flex items-center gap-4 animate-scale-in">
              <div className="flex h-10 w-10 items-center justify-center animate-float">
                <img 
                  src="/codecollab-logo.svg" 
                  alt="CodeCollab Logo" 
                  className="h-8 w-8 logo-responsive"
                  style={{ filter: 'var(--logo-filter, none)' }}
                />
              </div>
              <span className="font-bold text-2xl">CodeCollab</span>
            </div>
            <p className="text-lg text-muted-foreground text-center animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
              Built for developers who love to collaborate
            </p>
            <div className="flex items-center gap-8 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
              <Button variant="ghost" size="lg" className="hover:scale-110 transition-all duration-200 p-4" asChild>
                <a href="https://github.com" target="_blank" rel="noopener noreferrer">
                  <Github className="h-6 w-6" />
                </a>
              </Button>
              <ThemeToggle />
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}