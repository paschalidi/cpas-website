import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, CheckCircle } from 'lucide-react';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { sendContactEmail } from '../services/email';
import { AuroraBackground } from './AuroraBackground';
import { Navbar } from './Navbar';
import { Footer } from './Footer';


type FormData = {
  firstName: string;
  lastName: string;
  email: string;
  message: string;
  interests: string[];
};

const interestOptions = [
  { id: 'consulting', label: 'Consulting' },
  { id: 'fullstack', label: 'Fullstack Development' },
  { id: 'ai', label: 'AI & Agents' },
  { id: 'architecture', label: 'Architecture Review' },
  { id: 'team', label: 'Team Leadership' },
  { id: 'other', label: 'Something Else' },
];

export function ContactPage() {
  const [formData, setFormData] = useState<FormData>({
    firstName: '',
    lastName: '',
    email: '',
    message: '',
    interests: []
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});

  const toggleInterest = (interestId: string) => {
    setFormData(prev => ({
      ...prev,
      interests: prev.interests.includes(interestId)
        ? prev.interests.filter(i => i !== interestId)
        : [...prev.interests, interestId]
    }));
  };

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof FormData, string>> = {};
    
    if (!formData.firstName.trim()) newErrors.firstName = 'First name is required';
    if (!formData.lastName.trim()) newErrors.lastName = 'Last name is required';
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(formData.email)) {
      newErrors.email = 'Invalid email address';
    }
    if (!formData.message.trim()) newErrors.message = 'Message is required';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setIsSubmitting(true);
    
    try {
      const result = await sendContactEmail(formData);
      if (result.success) {
        setIsSuccess(true);
        setFormData({ firstName: '', lastName: '', email: '', message: '', interests: [] });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateField = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  return (
    <div className="relative text-[#0d2418]">
      <div className="fixed inset-0">
        <AuroraBackground />
      </div>
      
      <div className="relative z-10">
        <Navbar />
        
        <div className="max-w-5xl mx-auto px-6 md:px-12 py-32 md:py-40">
        {/* Header Section */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="mb-16 md:mb-24 relative"
        >
          <p className="text-sm font-medium mb-4 text-[#0d2418]/60">
            Get in touch
          </p>
          <div className="relative overflow-visible">
            <h1 className="font-sans text-5xl md:text-7xl lg:text-8xl font-light tracking-tight leading-[1.05] mb-6 pr-16 md:pr-24">
              Let&apos;s get<br />
              <span className="font-semibold">the ball</span> rolling
            </h1>
            {/* Rolling asterisk */}
            <motion.span
              className="absolute bottom-2 left-[280px] md:left-[420px] lg:left-[520px] text-[rgb(243,198,173)] text-4xl md:text-6xl lg:text-7xl font-light select-none"
              style={{ lineHeight: 1 }}
              animate={{
                x: [0, 100, 0],
                rotate: [0, 360, 720],
              }}
              transition={{
                duration: 16,
                ease: "linear",
                repeat: Infinity,
              }}
            >
              ✻
            </motion.span>
          </div>
          <p className="text-lg md:text-xl text-[#0d2418]/60 max-w-lg leading-relaxed">
            Have a project in mind? Need help with architecture, AI, or fullstack development? 
            Let&apos;s talk.
          </p>
        </motion.div>

        <AnimatePresence mode="wait">
          {isSuccess ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.5 }}
              className="flex flex-col items-center justify-center py-16 border border-[#0d2418]/10 rounded-3xl bg-white/50 backdrop-blur-sm"
            >
              <div className="text-[#0d2418] mb-6">
                <CheckCircle size={64} />
              </div>
              <h3 className="text-3xl font-semibold mb-3">Message Sent!</h3>
              <p className="text-[#0d2418]/60 text-center max-w-md mb-8">
                Thanks for reaching out. I&apos;ll get back to you within 24 hours.
              </p>
              <button
                onClick={() => setIsSuccess(false)}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#0d2418] text-white hover:bg-[#0d2418]/80 hover:-translate-y-0.5 transition-all duration-300"
                style={{ cursor: 'none' }}
              >
                Send Another Message
              </button>
            </motion.div>
          ) : (
            <motion.form
              key="form"
              onSubmit={handleSubmit}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-12"
            >
              {/* Interest Section */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
              >
                <h2 className="text-xl md:text-2xl mb-6 text-[#0d2418]/80 font-medium">
                  I am interested in:
                </h2>
                <div className="flex flex-wrap gap-3">
                  {interestOptions.map((option) => (
                    <motion.button
                      key={option.id}
                      type="button"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => toggleInterest(option.id)}
                      className={`border rounded-full px-5 py-2.5 text-sm transition-all duration-300 flex items-center gap-2 ${
                        formData.interests.includes(option.id)
                          ? 'bg-[#0d2418] border-[#0d2418] text-white'
                          : 'border-[#0d2418]/20 text-[#0d2418]/60 hover:border-[#0d2418]/40 hover:text-[#0d2418]'
                      }`}
                      style={{ cursor: 'none' }}
                    >
                      {formData.interests.includes(option.id) && (
                        <span className="inline-block w-1.5 h-1.5 bg-white rounded-full" />
                      )}
                      {option.label}
                    </motion.button>
                  ))}
                </div>
              </motion.div>

              {/* Form Fields */}
              <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.3 }}
                  >
                    <Input
                      variant="light"
                      label="First name *"
                      value={formData.firstName}
                      onChange={(e) => updateField('firstName', e.target.value)}
                      placeholder="John"
                    />
                    {errors.firstName && (
                      <p className="text-red-600 text-sm mt-2">{errors.firstName}</p>
                    )}
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.4 }}
                  >
                    <Input
                      variant="light"
                      label="Last name *"
                      value={formData.lastName}
                      onChange={(e) => updateField('lastName', e.target.value)}
                      placeholder="Doe"
                    />
                    {errors.lastName && (
                      <p className="text-red-600 text-sm mt-2">{errors.lastName}</p>
                    )}
                  </motion.div>
                </div>

                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.5 }}
                >
                  <Input
                    variant="light"
                    label="Email *"
                    type="email"
                    value={formData.email}
                    onChange={(e) => updateField('email', e.target.value)}
                    placeholder="john@example.com"
                  />
                  {errors.email && (
                    <p className="text-red-600 text-sm mt-2">{errors.email}</p>
                  )}
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.6 }}
                >
                  <Textarea
                    variant="light"
                    label="Message *"
                    value={formData.message}
                    onChange={(e) => updateField('message', e.target.value)}
                    placeholder="Tell me about your project..."
                  />
                  {errors.message && (
                    <p className="text-red-600 text-sm mt-2">{errors.message}</p>
                  )}
                </motion.div>
              </div>

              {/* Submit Button */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.8 }}
                className="flex justify-start"
              >
                <motion.button
                  type="submit"
                  disabled={isSubmitting}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-[#0d2418] text-white hover:bg-[#0d2418]/80 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
                  style={{ cursor: 'none' }}
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      Send Message
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </motion.button>
              </motion.div>
            </motion.form>
          )}
        </AnimatePresence>
      </div>
      </div>

      <Footer />
    </div>
  );
}
