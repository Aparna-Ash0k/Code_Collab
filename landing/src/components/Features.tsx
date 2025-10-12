import { motion } from 'motion/react';
import { useState } from 'react';
import { Code, Users, Zap, Shield } from 'lucide-react';
import { ImageWithFallback } from './figma/ImageWithFallback';

export function Features() {
  const [hoveredFeature, setHoveredFeature] = useState<number | null>(null);

  const features = [
    {
      icon: Code,
      title: "Ship code 3x faster with real-time editing",
      description: "Multiple developers can edit the same file simultaneously without conflicts. See changes instantly as they happen.",
      benefit: "Reduce development time by 70%",
      demo: "Real-time collaborative editing in action",
      stats: "50% fewer merge conflicts"
    },
    {
      icon: Users,
      title: "Collaborate seamlessly across teams",
      description: "Built-in voice chat, screen sharing, and collaborative debugging tools that keep your team in sync.",
      benefit: "Improve team productivity",
      demo: "Team collaboration features demo",
      stats: "3x faster code reviews"
    },
    {
      icon: Zap,
      title: "Stay in sync, never lose context",
      description: "Shared cursors, live comments, and synchronized file navigation ensure everyone stays on the same page.",
      benefit: "Zero context switching",
      demo: "Context preservation in action",
      stats: "90% less time spent explaining code"
    },
    {
      icon: Shield,
      title: "Enterprise-grade security & reliability",
      description: "End-to-end encryption, SSO integration, and 99.9% uptime SLA. Your code stays secure and accessible.",
      benefit: "Peace of mind for your team",
      demo: "Security features overview",
      stats: "SOC 2 Type II compliant"
    }
  ];

  return (
    <section className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="text-center space-y-4 mb-20"
        >
          <span className="inline-block px-4 py-2 bg-blue-100 text-blue-800 rounded-full text-sm tracking-wide uppercase">
            Features
          </span>
          <h2 className="text-4xl lg:text-5xl text-gray-900 max-w-3xl mx-auto leading-tight">
            Everything you need to{' '}
            <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              collaborate effectively
            </span>
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
            Powerful features designed by developers, for developers. Stop fighting your tools and start building amazing software together.
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-12">
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
              <div className="h-full p-8 bg-gray-50 rounded-2xl border border-gray-200 hover:border-blue-300 transition-all duration-300 hover:shadow-xl hover:shadow-blue-100/50">
                {/* Icon and Badge */}
                <div className="flex items-start justify-between mb-6">
                  <motion.div
                    className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl flex items-center justify-center"
                    whileHover={{ scale: 1.1, rotate: 5 }}
                    transition={{ duration: 0.3 }}
                  >
                    <feature.icon className="h-6 w-6 text-white" />
                  </motion.div>
                  
                  <motion.span
                    className="text-xs text-green-600 bg-green-100 px-3 py-1 rounded-full"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.5 }}
                  >
                    {feature.stats}
                  </motion.span>
                </div>

                {/* Content */}
                <div className="space-y-4">
                  <h3 className="text-2xl text-gray-900 group-hover:text-blue-600 transition-colors duration-300">
                    {feature.title}
                  </h3>
                  
                  <p className="text-gray-600 leading-relaxed">
                    {feature.description}
                  </p>

                  <div className="pt-4 border-t border-gray-200">
                    <p className="text-sm text-blue-600 mb-4">
                      ✓ {feature.benefit}
                    </p>
                  </div>
                </div>

                {/* Interactive Demo Area */}
                <motion.div
                  className="mt-6 aspect-video bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl overflow-hidden border border-gray-300"
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
                          className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-4"
                          animate={{ rotate: 360 }}
                          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                        >
                          <feature.icon className="h-8 w-8 text-white" />
                        </motion.div>
                        <p className="text-gray-700">{feature.demo}</p>
                      </motion.div>
                    ) : (
                      <div className="text-center p-6">
                        <div className="w-16 h-16 bg-gray-300 rounded-full flex items-center justify-center mx-auto mb-4">
                          <feature.icon className="h-8 w-8 text-gray-500" />
                        </div>
                        <p className="text-gray-500">Hover to see demo</p>
                      </div>
                    )}
                  </div>
                </motion.div>

                {/* Hover Overlay */}
                <motion.div
                  className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                />
              </div>
            </motion.div>
          ))}
        </div>

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
                className="text-center"
              >
                <div className="text-3xl text-blue-600 mb-2">{stat.number}</div>
                <div className="text-sm text-gray-600">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}