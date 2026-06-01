import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, CheckCircle } from 'lucide-react';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { sendContactEmail } from '../services/email';

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
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      {/* Subtle background gradient */}
      <div 
        className="absolute top-0 left-0 right-0 h-[60vh] pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at 30% 20%, rgb(243 198 173 / 0.08) 0%, transparent 60%)',
        }}
      />

      <div className="relative max-w-5xl mx-auto px-6 md:px-12 py-24 md:py-32">
        {/* Header Section */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="mb-16 md:mb-24"
        >
          <p className="text-sm font-medium text-[rgb(243,198,173)] tracking-widest uppercase mb-4">
            GET IN TOUCH
          </p>
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-light tracking-tight leading-[1.05] mb-6">
            LET&apos;S GET<br />
            <span className="text-[rgb(243,198,173)]">THE BALL</span> ROLLING
          </h1>
          <p className="text-lg md:text-xl text-white/50 max-w-lg leading-relaxed">
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
              className="flex flex-col items-center justify-center py-16 border border-white/10 rounded-3xl bg-white/[0.02]"
            >
              <div className="text-[rgb(243,198,173)] mb-6">
                <CheckCircle size={64} />
              </div>
              <h3 className="text-3xl font-semibold mb-3">Message Sent!</h3>
              <p className="text-white/50 text-center max-w-md mb-8">
                Thanks for reaching out. I&apos;ll get back to you within 24 hours.
              </p>
              <button
                onClick={() => setIsSuccess(false)}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white/10 text-white hover:bg-white/20 hover:-translate-y-0.5 transition-all duration-300"
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
                <h2 className="text-xl md:text-2xl mb-6 text-white/80 font-medium">
                  I AM INTERESTED IN:
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
                          ? 'bg-white/10 border-[rgb(243,198,173)] text-[rgb(243,198,173)]'
                          : 'border-white/20 text-white/50 hover:border-white/40 hover:text-white/80'
                      }`}
                      style={{ cursor: 'none' }}
                    >
                      {formData.interests.includes(option.id) && (
                        <span className="inline-block w-1.5 h-1.5 bg-[rgb(243,198,173)] rounded-full" />
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
                      label="First name *"
                      value={formData.firstName}
                      onChange={(e) => updateField('firstName', e.target.value)}
                      placeholder="John"
                    />
                    {errors.firstName && (
                      <p className="text-red-400 text-sm mt-2">{errors.firstName}</p>
                    )}
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.4 }}
                  >
                    <Input
                      label="Last name *"
                      value={formData.lastName}
                      onChange={(e) => updateField('lastName', e.target.value)}
                      placeholder="Doe"
                    />
                    {errors.lastName && (
                      <p className="text-red-400 text-sm mt-2">{errors.lastName}</p>
                    )}
                  </motion.div>
                </div>

                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.5 }}
                >
                  <Input
                    label="Email *"
                    type="email"
                    value={formData.email}
                    onChange={(e) => updateField('email', e.target.value)}
                    placeholder="john@example.com"
                  />
                  {errors.email && (
                    <p className="text-red-400 text-sm mt-2">{errors.email}</p>
                  )}
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.6 }}
                >
                  <Textarea
                    label="Message *"
                    value={formData.message}
                    onChange={(e) => updateField('message', e.target.value)}
                    placeholder="Tell me about your project..."
                  />
                  {errors.message && (
                    <p className="text-red-400 text-sm mt-2">{errors.message}</p>
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
                  className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-white/10 text-white hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
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
  );
}
