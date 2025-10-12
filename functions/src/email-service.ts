import { onRequest } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import * as nodemailer from 'nodemailer';

// SMTP configuration - these should be set as environment variables
const SMTP_CONFIG = {
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER || 'codecollab33@gmail.com',
    pass: process.env.SMTP_PASS || 'your-app-password'
  }
};

interface InvitationRequest {
  recipients: string[] | Array<{ email: string; name?: string }>;
  subject: string;
  customMessage: string;
  projectUrl?: string;
  projectName: string;
  projectId: string;
  senderName: string;
  senderEmail: string;
}

export const sendInvitations = onRequest(
  { 
    cors: ['http://localhost:3000', 'http://localhost:3001', 'https://codecollab-v2.web.app'],
    maxInstances: 10,
    timeoutSeconds: 60,
    memory: '256MiB'
  },
  async (request, response) => {
    // Set CORS headers explicitly for better compatibility
    const origin = request.get('origin');
    const allowedOrigins = ['http://localhost:3000', 'http://localhost:3001', 'https://codecollab-v2.web.app'];
    
    if (origin && allowedOrigins.includes(origin)) {
      response.set('Access-Control-Allow-Origin', origin);
    } else {
      response.set('Access-Control-Allow-Origin', 'http://localhost:3001');
    }
    
    response.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    response.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    response.set('Access-Control-Max-Age', '3600');

    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      response.status(204).send('');
      return;
    }

    // Only allow POST requests
    if (request.method !== 'POST') {
      response.status(405).json({ error: 'Method not allowed' });
      return;
    }

    try {
      const {
        recipients,
        subject,
        customMessage,
        projectName,
        projectId,
        senderName,
        senderEmail
      }: InvitationRequest = request.body;

      // Validate required fields
      if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
        response.status(400).json({ error: 'Recipients are required' });
        return;
      }

      if (!subject || !customMessage || !projectName) {
        response.status(400).json({ error: 'Missing required fields' });
        return;
      }

      // Normalize recipients to array of strings
      const emailList: string[] = recipients.map(r => 
        typeof r === 'string' ? r : r.email
      );

      // Validate email addresses
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const invalidEmails = emailList.filter(email => !emailRegex.test(email));
      if (invalidEmails.length > 0) {
        response.status(400).json({ 
          error: 'Invalid email addresses found',
          invalidEmails
        });
        return;
      }

      // Create SMTP transporter
      const transporter = nodemailer.createTransport(SMTP_CONFIG);

      // Verify SMTP connection
      try {
        await transporter.verify();
        logger.info('SMTP connection verified successfully');
      } catch (error) {
        logger.error('SMTP connection failed:', error);
        response.status(500).json({ error: 'Email service configuration error' });
        return;
      }

      // Prepare email template - only includes project ID
      const createEmailHtml = (recipientEmail: string) => `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Project Collaboration Invitation</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
            .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; }
            .project-info { background: white; padding: 20px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #4f46e5; }
            .project-id-box { background: #f0f0f0; border: 2px solid #4f46e5; padding: 15px; border-radius: 8px; text-align: center; margin: 20px 0; }
            .project-id { font-family: 'Courier New', monospace; font-size: 24px; font-weight: bold; color: #4f46e5; letter-spacing: 2px; }
            .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🚀 You're Invited to Collaborate!</h1>
              <p>Join a live coding session</p>
            </div>
            <div class="content">
              <h2>Hi there!</h2>
              
              <p>${customMessage.replace(/\n/g, '<br>')}</p>
              
              <div class="project-info">
                <h3>📂 Join Using Project ID</h3>
                <p><strong>Invited by:</strong> ${senderName}</p>
                <p><strong>Invitation sent to:</strong> ${recipientEmail}</p>
              </div>
              
              <div class="project-id-box">
                <p style="margin: 0 0 5px 0; font-size: 16px; font-weight: bold; color: #333;">Project ID:</p>
                <div class="project-id" style="font-family: 'Courier New', monospace; font-size: 28px; font-weight: bold; color: #4f46e5; letter-spacing: 2px; margin-top: 10px;">${projectId}</div>
              </div>
              
              <p><strong>How to join:</strong></p>
              <ol>
                <li>Go to CodeCollab platform</li>
                <li>Click on "Join by Project ID"</li>
                <li>Enter the Project ID shown above</li>
                <li>Start collaborating!</li>
              </ol>
              
              <p><strong>What you can do:</strong></p>
              <ul>
                <li>✏️ Edit code in real-time with other collaborators</li>
                <li>💬 Chat with team members</li>
                <li>🔍 See live cursors and edits from others</li>
                <li>▶️ Run code in multiple programming languages</li>
                <li>📁 Manage project files together</li>
              </ul>
            </div>
            <div class="footer">
              <p>This invitation was sent by ${senderName} (${senderEmail})</p>
              <p>Powered by CodeCollab - Collaborative Coding Platform</p>
            </div>
          </div>
        </body>
        </html>
      `;

      // Send emails to all recipients - only includes project ID
      const sendPromises = emailList.map(async (recipientEmail) => {
        const mailOptions = {
          from: {
            name: `${senderName} via CodeCollab`,
            address: SMTP_CONFIG.auth.user
          },
          to: recipientEmail,
          subject: subject,
          text: `${customMessage}\n\n===================\nPROJECT ID: ${projectId}\n===================\n\nTo join:\n1. Go to CodeCollab platform\n2. Click "Join by Project ID"\n3. Enter the Project ID: ${projectId}\n4. Start collaborating!`,
          html: createEmailHtml(recipientEmail),
          replyTo: senderEmail
        };

        try {
          const result = await transporter.sendMail(mailOptions);
          logger.info(`Email sent successfully to ${recipientEmail}:`, result.messageId);
          return { email: recipientEmail, status: 'sent', messageId: result.messageId };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          logger.error(`Failed to send email to ${recipientEmail}:`, error);
          return { email: recipientEmail, status: 'failed', error: errorMessage };
        }
      });

      // Wait for all emails to be processed
      const results = await Promise.all(sendPromises);
      
      const successCount = results.filter(r => r.status === 'sent').length;
      const failureCount = results.filter(r => r.status === 'failed').length;

      logger.info(`Email sending completed: ${successCount} sent, ${failureCount} failed`);

      // Return results
      response.status(200).json({
        success: true,
        message: `Successfully sent ${successCount} invitation${successCount !== 1 ? 's' : ''}`,
        results: {
          total: recipients.length,
          sent: successCount,
          failed: failureCount,
          details: results
        }
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Error in sendInvitations function:', error);
      response.status(500).json({ 
        error: 'Internal server error',
        message: errorMessage
      });
    }
  }
);