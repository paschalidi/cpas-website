import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  // Only accept POST requests
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { firstName, lastName, email, message, interests } = req.body;

    // Basic validation
    if (!firstName?.trim() || !lastName?.trim() || !email?.trim() || !message?.trim()) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check if Resend is configured
    if (!process.env.RESEND_API_KEY) {
      console.warn('RESEND_API_KEY not configured');
      return res.status(500).json({ 
        error: 'Email service not configured',
        message: 'Demo mode: Would have sent email' 
      });
    }

    // Send email via Resend
    await resend.emails.send({
      from: process.env.FROM_EMAIL || 'onboarding@resend.dev',
      to: process.env.TO_EMAIL || 'paschalidi@outlook.com',
      subject: `New Contact Form: ${firstName} ${lastName}`,
      replyTo: email,
      html: `
        <h2>New Contact Form Submission</h2>
        <p><strong>Name:</strong> ${firstName} ${lastName}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Interests:</strong> ${interests?.join(', ') || 'None specified'}</p>
        <p><strong>Message:</strong></p>
        <p>${message}</p>
      `,
    });

    return res.status(200).json({ 
      success: true,
      message: 'Message sent successfully!' 
    });

  } catch (error) {
    console.error('Error sending email:', error);
    return res.status(500).json({ 
      error: 'Failed to send email',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
