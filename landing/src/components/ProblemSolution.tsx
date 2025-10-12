import { motion, AnimatePresence } from 'motion/react';
import { useState, useEffect } from 'react';
import { X, Check, ArrowRight } from 'lucide-react';

export function ProblemSolution() {
  const problems = [
    "Tired of emailing code back and forth?",
    "End the merge conflict nightmare.",
    "Stop switching between Slack and your IDE."
  ];

  const solutions = [
    "Real-time collaborative editing",
    "Intelligent conflict resolution",
    "Integrated team communication"
  ];

  const [currentIndex, setCurrentIndex] = useState(0);
  const [showSolution, setShowSolution] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      if (!showSolution) {
        setShowSolution(true);
        setTimeout(() => {
          setShowSolution(false);
          setCurrentIndex((prev) => (prev + 1) % problems.length);
        }, 3000);
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [showSolution]);

  return (
    <section className="py-24 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left Side - Problems */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="space-y-8"
          >
            <div className="space-y-4">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                viewport={{ once: true }}
              >
                <span className="inline-block px-4 py-2 bg-red-100 text-red-800 rounded-full text-sm tracking-wide uppercase">
                  The Problem
                </span>
              </motion.div>

              <h2 className="text-4xl lg:text-5xl text-gray-900 leading-tight">
                Development shouldn't be this{' '}
                <span className="text-red-600">complicated</span>
              </h2>
            </div>

            {/* Animated Problems */}
            <div className="space-y-6">
              <AnimatePresence mode="wait">
                {!showSolution && (
                  <motion.div
                    key={`problem-${currentIndex}`}
                    initial={{ opacity: 0, y: 20, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -20, scale: 0.9 }}
                    transition={{ duration: 0.5 }}
                    className="flex items-start gap-4 p-6 bg-white rounded-xl border border-red-200 shadow-sm"
                  >
                    <X className="h-6 w-6 text-red-500 flex-shrink-0 mt-1" />
                    <p className="text-xl text-gray-700">
                      {problems[currentIndex]}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Static Problems List */}
              <div className="space-y-3 opacity-60">
                {problems.map((problem, index) => (
                  <div key={index} className="flex items-start gap-3 text-gray-600">
                    <X className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
                    <span className="text-sm">{problem}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Transition Arrow */}
            <motion.div
              className="flex justify-center py-8"
              animate={{ x: [0, 10, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <ArrowRight className="h-8 w-8 text-gray-400" />
            </motion.div>
          </motion.div>

          {/* Right Side - Solution */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            viewport={{ once: true }}
            className="space-y-8"
          >
            <div className="space-y-4">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                viewport={{ once: true }}
              >
                <span className="inline-block px-4 py-2 bg-green-100 text-green-800 rounded-full text-sm tracking-wide uppercase">
                  The Solution
                </span>
              </motion.div>

              <h2 className="text-4xl lg:text-5xl text-gray-900 leading-tight">
                Here's how CodeCollab{' '}
                <span className="text-green-600">solves this</span>
              </h2>
            </div>

            {/* Animated Solutions */}
            <div className="space-y-6">
              <AnimatePresence mode="wait">
                {showSolution && (
                  <motion.div
                    key={`solution-${currentIndex}`}
                    initial={{ opacity: 0, y: 20, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -20, scale: 0.9 }}
                    transition={{ duration: 0.5 }}
                    className="flex items-start gap-4 p-6 bg-green-50 rounded-xl border border-green-200 shadow-sm"
                  >
                    <Check className="h-6 w-6 text-green-500 flex-shrink-0 mt-1" />
                    <p className="text-xl text-gray-700">
                      {solutions[currentIndex]}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Static Solutions List */}
              <div className="space-y-3">
                {solutions.map((solution, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: 20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.6, delay: index * 0.1 }}
                    viewport={{ once: true }}
                    className="flex items-start gap-3 text-gray-700"
                  >
                    <Check className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <span>{solution}</span>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Before/After Illustration */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              viewport={{ once: true }}
              className="mt-12 p-8 bg-gradient-to-br from-blue-50 to-purple-50 rounded-2xl border border-blue-200"
            >
              <div className="text-center space-y-4">
                <div className="flex items-center justify-center gap-8">
                  <div className="text-center">
                    <div className="text-2xl mb-2">⏱️</div>
                    <div className="text-sm text-gray-600">Before</div>
                    <div className="text-lg text-gray-900">Hours of conflicts</div>
                  </div>
                  <ArrowRight className="h-6 w-6 text-gray-400" />
                  <div className="text-center">
                    <div className="text-2xl mb-2">⚡</div>
                    <div className="text-sm text-gray-600">After</div>
                    <div className="text-lg text-gray-900">Instant collaboration</div>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}