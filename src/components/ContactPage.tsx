import React, { useState, useEffect, useRef } from 'react';
import { AnimatePresence } from 'framer-motion';
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
  const successRef = useRef<HTMLDivElement>(null);

  // Scroll to success message when form is submitted (50px offset for navbar)
  useEffect(() => {
    if (isSuccess && successRef.current) {
      const element = successRef.current;
      const offset = 100;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.scrollY - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
  }, [isSuccess]);

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
    <div className="relative text-forest-700">
      <div className="fixed inset-0">
        <AuroraBackground />
      </div>
      
      <div className="relative z-10">
        <Navbar />
        
        <div className="max-w-5xl mx-auto px-6 md:px-12 py-32 md:py-40">
          {/* Header Section */}
          <div className="mb-16 md:mb-24 relative">
            <div className="relative overflow-visible">
              <h1 className="font-sans text-5xl md:text-7xl lg:text-8xl font-light tracking-tight leading-[1.05] mb-6 pr-24 md:pr-36 lg:pr-48">
                Let&apos;s get<br />
                <span className="font-semibold">the ball</span> rolling
              </h1>
              {/* Rolling asterisk */}
              <span
                className="hidden md:block absolute bottom-2 left-[300px] md:left-[440px] lg:left-[560px] text-blog-surface text-5xl md:text-7xl lg:text-8xl font-light select-none doodle-rolling-asterisk"
                style={{ lineHeight: 1 }}
              >
                ✻
              </span>
            </div>
            <p className="text-xl md:text-2xl text-forest-700/70 max-w-lg leading-relaxed">
              Have a project in mind? Need help with architecture, AI, or fullstack development? 
              <br/>Let&apos;s talk.
            </p>
          </div>

          <AnimatePresence mode="wait">
            {isSuccess ? (
              <div ref={successRef} className="flex flex-col items-center justify-center py-16 border border-forest-700/10 rounded-3xl bg-white/50 backdrop-blur-sm">
                <div className="text-forest-700 mb-6">
                  <CheckCircle size={64} />
                </div>
                <h3 className="text-3xl font-semibold mb-3">Message Sent!</h3>
                <p className="text-forest-700/60 text-center max-w-md mb-8">
                  Thanks for reaching out. I&apos;ll get back to you within 24 hours.
                </p>
                <button
                  onClick={() => setIsSuccess(false)}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-forest-700 text-white hover:bg-forest-700/80 hover:-translate-y-0.5 transition-all duration-300"
                  style={{ cursor: 'none' }}
                >
                  Send Another Message
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-12">
                {/* Interest Section */}
                <div>
                  <h2 className="text-xl md:text-2xl mb-6 text-forest-700/80 font-medium">
                    I am interested in:
                  </h2>
                  <div className="flex flex-wrap gap-3">
                    {interestOptions.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => toggleInterest(option.id)}
                        className={`rounded-full px-5 py-2.5 text-sm transition-all duration-300 flex items-center gap-2 backdrop-blur-md ${
                          formData.interests.includes(option.id)
                            ? 'bg-forest-700/90 border border-forest-700 text-white shadow-lg'
                            : 'bg-white/50 border border-white/60 text-forest-700/80 hover:bg-white/70 hover:border-white/80 hover:text-forest-700 shadow-sm'
                        }`}
                        style={{ cursor: 'none' }}
                      >
                        {formData.interests.includes(option.id) && (
                          <span className="inline-block w-1.5 h-1.5 bg-white rounded-full" />
                        )}
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Form Fields */}
                <div className="p-6 md:p-8 rounded-3xl bg-white/30 backdrop-blur-md border border-white/20 shadow-sm space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
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
                    </div>

                    <div>
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
                    </div>
                  </div>

                  <div>
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
                  </div>

                  <div>
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
                  </div>
                </div>

                {/* Submit Button */}
                <div className="flex justify-start">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-forest-700 text-white hover:bg-forest-700/80 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
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
                  </button>
                </div>
              </form>
            )}
          </AnimatePresence>
        </div>
      </div>

      <Footer />
    </div>
  );
}
