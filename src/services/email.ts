export interface ContactFormData {
  firstName: string;
  lastName: string;
  email: string;
  message: string;
  interests: string[];
}

interface ApiResponse {
  success: boolean;
  message: string;
  error?: string;
}

/**
 * Send contact form email via API route
 * POSTs to /api/contact which securely uses Resend on the server
 */
export async function sendContactEmail(data: ContactFormData): Promise<{ success: boolean; message: string }> {
  try {
    const response = await fetch('/api/contact', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    const result: ApiResponse = await response.json();

    if (!response.ok) {
      return {
        success: false,
        message: result.message || 'Failed to send message. Please try again.',
      };
    }

    return {
      success: true,
      message: result.message || 'Message sent successfully! I\'ll get back to you soon.',
    };

  } catch (error) {
    console.error('Error sending email:', error);
    return {
      success: false,
      message: 'Failed to send message. Please check your connection and try again.',
    };
  }
}
