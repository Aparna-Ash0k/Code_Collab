/**
 * Firebase Function Test Script
 * 
 * This script tests the sendInvitations function with sample data
 * to ensure it works correctly before deployment.
 */

const { sendInvitations } = require('./src/email-service');

// Mock request object
const mockRequest = {
  method: 'POST',
  body: {
    recipients: ['test1@example.com', 'test2@example.com'],
    subject: 'Invitation to CodeCollab Project',
    customMessage: 'Hi! Please join my coding project. We\'re building something amazing together!',
    projectName: 'Awesome React App',
    projectId: 'project-abc-123',
    senderName: 'John Developer',
    senderEmail: 'john@example.com'
  }
};

// Mock response object
const mockResponse = {
  status: function(code) {
    console.log(`Response Status: ${code}`);
    return {
      json: function(data) {
        console.log('Response Data:', JSON.stringify(data, null, 2));
      }
    };
  }
};

// Test function
async function testEmailFunction() {
  console.log('🧪 Testing sendInvitations function...\n');
  
  console.log('📧 Test Request Data:');
  console.log(JSON.stringify(mockRequest.body, null, 2));
  console.log('\n🔧 Environment Variables:');
  console.log('SMTP_HOST:', process.env.SMTP_HOST || 'Using default: smtp.gmail.com');
  console.log('SMTP_PORT:', process.env.SMTP_PORT || 'Using default: 587');
  console.log('SMTP_USER:', process.env.SMTP_USER || 'Using default: codecollab33@gmail.com');
  console.log('SMTP_PASS:', process.env.SMTP_PASS ? '***configured***' : 'Using default: your-app-password');
  
  console.log('\n⚡ Processing email function...\n');
  
  try {
    await sendInvitations(mockRequest, mockResponse);
    console.log('\n✅ Function test completed successfully!');
  } catch (error) {
    console.error('\n❌ Function test failed:', error);
  }
}

// Environment warning
if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
  console.log('⚠️  Warning: SMTP environment variables not fully configured.');
  console.log('   The function will use default values (codecollab33@gmail.com)');
  console.log('   For production, configure these environment variables:');
  console.log('   - SMTP_HOST');
  console.log('   - SMTP_PORT'); 
  console.log('   - SMTP_USER');
  console.log('   - SMTP_PASS');
  console.log('');
}

// Run the test
testEmailFunction();