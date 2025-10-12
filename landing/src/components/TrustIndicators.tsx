import { motion } from 'motion/react';
import { Star, Users, GitBranch } from 'lucide-react';

export function TrustIndicators() {
  const companies = [
    'Stripe', 'Vercel', 'GitHub', 'Discord', 'Figma', 'Linear'
  ];

  return (
    <section className="py-16 bg-white border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="text-center space-y-12"
        >
          {/* Trust Headline */}
          <div className="space-y-4">
            <p className="text-lg text-gray-600">Trusted by 10,000+ developers worldwide</p>
            
            {/* Live Stats */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-8 text-sm">
              <motion.div 
                className="flex items-center gap-2 text-gray-700"
                whileHover={{ scale: 1.05 }}
              >
                <GitBranch className="h-5 w-5 text-green-600" />
                <span className="text-2xl text-black">4,286</span>
                <span>GitHub Stars</span>
              </motion.div>
              
              <div className="hidden sm:block w-1 h-1 bg-gray-300 rounded-full"></div>
              
              <motion.div 
                className="flex items-center gap-2 text-gray-700"
                whileHover={{ scale: 1.05 }}
              >
                <Users className="h-5 w-5 text-blue-600" />
                <span className="text-2xl text-black">10,542</span>
                <span>Active Users</span>
              </motion.div>
              
              <div className="hidden sm:block w-1 h-1 bg-gray-300 rounded-full"></div>
              
              <motion.div 
                className="flex items-center gap-2 text-gray-700"
                whileHover={{ scale: 1.05 }}
              >
                <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                <span className="text-2xl text-black">4.9</span>
                <span>Average Rating</span>
              </motion.div>
            </div>
          </div>

          {/* Company Logos */}
          <div className="space-y-6">
            <p className="text-sm text-gray-500 uppercase tracking-wider">Used by teams at</p>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-8 items-center">
              {companies.map((company, index) => (
                <motion.div
                  key={company}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                  viewport={{ once: true }}
                  whileHover={{ scale: 1.1 }}
                  className="flex items-center justify-center"
                >
                  <div className="text-gray-400 hover:text-gray-600 transition-colors duration-300 py-4 px-6 rounded-lg bg-gray-50 hover:bg-gray-100">
                    <div className="text-xl">{company}</div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Quick Testimonial Preview */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            viewport={{ once: true }}
            className="bg-gray-50 rounded-2xl p-8 max-w-3xl mx-auto"
          >
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white">
                  JS
                </div>
              </div>
              <div className="text-left">
                <p className="text-gray-700 mb-3">
                  "CodeCollab transformed how our team ships features. We went from weekly deployments to daily releases."
                </p>
                <div className="text-sm text-gray-500">
                  <span>John Smith</span> • <span>Senior Engineer, Stripe</span>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}