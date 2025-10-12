/**
 * Local Test Script for Email Service
 * 
 * This script allows testing the email service function locally
 * without deploying to Firebase Cloud Functions.
 */

import { sendInvitations } from './src/email-service.js';

// Test configuration
const testRequest = {
  body: {
    recipients: ['test@example.com'],
    projectName: 'CodeCollab Test Project',
    projectId: 'test-project-123',
    senderName: 'Test Developer',
    senderEmail: 'sender@example.com',
    customMessage: 'Please join my awesome coding project!',
    subject: 'Invitation to Collaborate on CodeCollab'
  }
};

// Mock response object
const testResponse = {
  status: (code) => ({
    json: (data) => {
      console.log(`Status: ${code}`);
      console.log('Response:', JSON.stringify(data, null, 2));
    }
  })
};

async function runTest() {
  console.log('🧪 Testing Email Service Function...\n');
  
  console.log('📧 Test Request:');
  console.log(JSON.stringify(testRequest.body, null, 2));
  console.log('\n⚡ Processing...\n');
  
  try {
    await sendInvitations(testRequest, testResponse);
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Environment check
console.log('🔧 Environment Check:');
console.log('SMTP_HOST:', process.env.SMTP_HOST || 'Not configured');
console.log('SMTP_PORT:', process.env.SMTP_PORT || 'Not configured');
console.log('SMTP_USER:', process.env.SMTP_USER || 'Not configured');
console.log('SMTP_PASS:', process.env.SMTP_PASS ? '***configured***' : 'Not configured');
console.log('\n');

// Run the test
if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
  runTest();
} else {
  console.log('⚠️  SMTP not configured. Please set up environment variables:');
  console.log('   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS');
  console.log('\n📝 Example for Gmail:');
  console.log('   SMTP_HOST=smtp.gmail.com');
  console.log('   SMTP_PORT=587');
  console.log('   SMTP_USER=youremail@gmail.com');
  console.log('   SMTP_PASS=your-app-password');
  console.log('\n💡 Create a .env file in functions/ directory with these values.');
}