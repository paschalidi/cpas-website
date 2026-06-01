import { Resend } from 'resend';

export default async function handler(req, res) {
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Log all requests for debugging
  console.log(`[API] ${req.method} ${req.url} - Headers:`, JSON.stringify(req.headers));

  // Health check endpoint
  if (req.method === 'GET') {
    return res.status(200).json({ 
      status: 'ok',
      message: 'Contact API is running',
      env: {
        hasResendKey: !!process.env.RESEND_API_KEY,
        fromEmail: process.env.FROM_EMAIL || 'not set',
        toEmail: process.env.TO_EMAIL || 'not set'
      }
    });
  }

  // Accept POST requests
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST', 'GET', 'OPTIONS']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('[API] Request body:', JSON.stringify(req.body));

    const { firstName, lastName, email, message, interests } = req.body || {};

    // Basic validation
    if (!firstName?.trim() || !lastName?.trim() || !email?.trim() || !message?.trim()) {
      console.log('[API] Validation failed - missing fields');
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check if Resend is configured
    const apiKey = process.env.RESEND_API_KEY;
    console.log('[API] RESEND_API_KEY exists:', !!apiKey);
    
    if (!apiKey) {
      console.warn('[API] RESEND_API_KEY not configured');
      return res.status(500).json({ 
        error: 'Email service not configured',
        message: 'Demo mode: Would have sent email' 
      });
    }

    // Initialize Resend lazily
    const resend = new Resend(apiKey);

    // Send email via Resend
    console.log('[API] Sending email...');
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

    console.log('[API] Email sent successfully');
    return res.status(200).json({ 
      success: true,
      message: 'Message sent successfully!' 
    });

  } catch (error) {
    console.error('[API] Error sending email:', error);
    return res.status(500).json({ 
      error: 'Failed to send email',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
