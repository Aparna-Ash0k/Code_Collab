import { motion } from 'motion/react';
import { useState, useEffect } from 'react';
import { Star, Quote, ChevronLeft, ChevronRight, Github, Twitter } from 'lucide-react';
import { ImageWithFallback } from './figma/ImageWithFallback';

export function SocialProof() {
  const [currentTestimonial, setCurrentTestimonial] = useState(0);

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

  const stats = [
    { value: "4.9/5", label: "Average Rating", icon: Star },
    { value: "2.5M+", label: "Lines of Code", icon: Github },
    { value: "500+", label: "Active Teams", icon: Twitter },
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTestimonial((prev) => (prev + 1) % testimonials.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="py-24 bg-gray-900 text-white overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="text-center space-y-4 mb-20"
        >
          <span className="inline-block px-4 py-2 bg-blue-900/50 text-blue-300 rounded-full text-sm tracking-wide uppercase">
            Social Proof
          </span>
          <h2 className="text-4xl lg:text-5xl max-w-3xl mx-auto leading-tight">
            Join{' '}
            <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              5,000+ developers
            </span>{' '}
            already collaborating
          </h2>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto leading-relaxed">
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
            <div>
              <h3 className="text-2xl mb-6">Trusted by the best</h3>
              <div className="space-y-6">
                {stats.map((stat, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: index * 0.1 }}
                    viewport={{ once: true }}
                    className="flex items-center gap-4 p-4 bg-gray-800 rounded-xl"
                  >
                    <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                      <stat.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-2xl text-white">{stat.value}</div>
                      <div className="text-sm text-gray-400">{stat.label}</div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Case Study Preview */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.3 }}
              viewport={{ once: true }}
              className="p-6 bg-gradient-to-br from-purple-900/50 to-blue-900/50 rounded-xl border border-purple-700/50"
            >
              <h4 className="text-lg mb-3">Case Study</h4>
              <p className="text-gray-300 text-sm mb-4">
                See how Stripe's payments team reduced deployment time by 70% using CodeCollab's real-time collaboration features.
              </p>
              <button className="text-blue-400 text-sm hover:text-blue-300 transition-colors">
                Read full case study →
              </button>
            </motion.div>
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
                className="bg-gray-800 rounded-2xl p-8 lg:p-12 border border-gray-700"
              >
                {/* Quote Icon */}
                <Quote className="h-12 w-12 text-blue-400 mb-6" />

                {/* Rating */}
                <div className="flex items-center gap-1 mb-6">
                  {[...Array(testimonials[currentTestimonial].rating)].map((_, i) => (
                    <Star key={i} className="h-5 w-5 text-yellow-400 fill-yellow-400" />
                  ))}
                </div>

                {/* Content */}
                <blockquote className="text-xl lg:text-2xl text-gray-100 leading-relaxed mb-8">
                  "{testimonials[currentTestimonial].content}"
                </blockquote>

                {/* Author */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white text-lg">
                      {testimonials[currentTestimonial].avatar}
                    </div>
                    <div>
                      <div className="text-white text-lg">{testimonials[currentTestimonial].name}</div>
                      <div className="text-gray-400">
                        {testimonials[currentTestimonial].role} at {testimonials[currentTestimonial].company}
                      </div>
                      <div className="text-sm text-blue-400 mt-1">
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
                          ? 'bg-blue-500 w-8' 
                          : 'bg-gray-600 hover:bg-gray-500'
                      }`}
                    />
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentTestimonial((prev) => 
                      prev === 0 ? testimonials.length - 1 : prev - 1
                    )}
                    className="w-10 h-10 bg-gray-700 hover:bg-gray-600 rounded-full flex items-center justify-center transition-colors"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => setCurrentTestimonial((prev) => 
                      (prev + 1) % testimonials.length
                    )}
                    className="w-10 h-10 bg-gray-700 hover:bg-gray-600 rounded-full flex items-center justify-center transition-colors"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* GitHub Activity Stats */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          viewport={{ once: true }}
          className="mt-20 p-8 bg-gray-800 rounded-2xl border border-gray-700"
        >
          <div className="text-center mb-8">
            <h3 className="text-2xl mb-2">Live GitHub Activity</h3>
            <p className="text-gray-400">Real-time stats from our open source community</p>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { label: "Stars", value: "4,286", change: "+23 today" },
              { label: "Forks", value: "892", change: "+8 today" },
              { label: "Contributors", value: "156", change: "+3 this week" },
              { label: "Issues Closed", value: "2,143", change: "98% closed" }
            ].map((stat, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="text-center"
              >
                <div className="text-3xl text-white mb-1">{stat.value}</div>
                <div className="text-gray-400 text-sm mb-2">{stat.label}</div>
                <div className="text-green-400 text-xs">{stat.change}</div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}