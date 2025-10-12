import { aiService } from '../services/aiService';

// Test the AI service integration
export async function testAIService() {
  try {
    console.log('Testing AI Service...');
    
    // Test 1: Parse AI query
    const query = '?gptoss write a simple React component';
    const parsed = aiService.parseAIQuery(query);
    console.log('Parsed query:', parsed);
    
    if (parsed) {
      // Test 2: Query AI model
      const response = await aiService.queryAI(parsed.modelId, parsed.query);
      console.log('AI Response:', response);
      return response;
    }
    
    return null;
  } catch (error) {
    console.error('AI Service test failed:', error);
    return null;
  }
}

// Example usage in console:
// import { testAIService } from './utils/testAI';
// testAIService().then(console.log);