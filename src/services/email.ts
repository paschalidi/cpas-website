import { Resend } from 'resend';

// Initialize Resend with API key
// User should set VITE_RESEND_API_KEY in their environment
const resendApiKey = import.meta.env.VITE_RESEND_API_KEY || '';

const resend = resendApiKey ? new Resend(resendApiKey) : null;

export interface ContactFormData {
  firstName: string;
  lastName: string;
  email: string;
  message: string;
  interests: string[];
}

/**
 * Send contact form email
 * NOTE: This requires a Resend API key to be configured.
 * For now, it logs to console if no API key is set.
 */
export async function sendContactEmail(data: ContactFormData): Promise<{ success: boolean; message: string }> {
  try {
    // Log form data for debugging (remove in production)
    console.log('Contact form submitted:', data);

    if (!resend) {
      console.warn('Resend API key not configured. Set VITE_RESEND_API_KEY environment variable.');
      // Return success anyway for demo purposes - user will configure Resend later
      return {
        success: true,
        message: 'Message sent successfully! (Demo mode - configure VITE_RESEND_API_KEY for real sending)'
      };
    }

    // Send email to yourself
    await resend.emails.send({
      from: 'contact@yourdomain.com', // Update this with your verified domain
      to: 'paschalidi@outlook.com',
      subject: `New Contact Form Submission from ${data.firstName} ${data.lastName}`,
      html: `
        <h2>New Contact Form Submission</h2>
        <p><strong>Name:</strong> ${data.firstName} ${data.lastName}</p>
        <p><strong>Email:</strong> ${data.email}</p>
        <p><strong>Interests:</strong> ${data.interests.join(', ') || 'None specified'}</p>
        <p><strong>Message:</strong></p>
        <p>${data.message}</p>
      `
    });

    return {
      success: true,
      message: 'Message sent successfully! I\'ll get back to you soon.'
    };
  } catch (error) {
    console.error('Error sending email:', error);
    return {
      success: false,
      message: 'Failed to send message. Please try again later.'
    };
  }
}
