import { Hero } from './components/Hero';
import { TrustIndicators } from './components/TrustIndicators';
import { ProblemSolution } from './components/ProblemSolution';
import { Features } from './components/Features';
import { SocialProof } from './components/SocialProof';
import { CTAFooter } from './components/CTAFooter';

export default function App() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <Hero />
      
      {/* Trust Indicators */}
      <TrustIndicators />
      
      {/* Problem/Solution Section */}
      <ProblemSolution />
      
      {/* Features Section */}
      <Features />
      
      {/* Social Proof Section */}
      <SocialProof />
      
      {/* CTA Footer */}
      <CTAFooter />
    </div>
  );
}