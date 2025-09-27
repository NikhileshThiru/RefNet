#!/usr/bin/env node

// Test script for Mastra backend
const testMastraBackend = async () => {
  console.log('🧪 Testing Mastra Backend');
  console.log('========================');
  
  try {
    // Test the health endpoint
    const healthResponse = await fetch('http://localhost:4111/health');
    if (healthResponse.ok) {
      const health = await healthResponse.json();
      console.log('✅ Mastra backend is running');
      console.log('📊 Health status:', health);
    } else {
      throw new Error(`Health check failed: ${healthResponse.status}`);
    }
    
    // Test the chat endpoint
    const chatResponse = await fetch('http://localhost:4111/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: 'What do you know about these papers?',
        additionalContext: {
          selectedPapers: [
            {
              title: 'Test Paper 1',
              authors: ['John Doe'],
              year: 2023,
              citations: 50,
              topics: ['AI', 'Machine Learning'],
              abstract: 'This is a test paper about artificial intelligence and machine learning applications.'
            }
          ],
          graphData: {
            totalNodes: 1,
            totalLinks: 0
          }
        }
      })
    });
    
    if (chatResponse.ok) {
      const chatResult = await chatResponse.json();
      console.log('✅ Chat endpoint working');
      console.log('💬 Response preview:', chatResult.content?.substring(0, 200) + '...');
    } else {
      throw new Error(`Chat test failed: ${chatResponse.status}`);
    }
    
    console.log('\n🎉 Mastra backend test completed successfully!');
    return true;
    
  } catch (error) {
    console.error('❌ Mastra backend test failed:', error.message);
    console.log('\n💡 Make sure to start the Mastra backend first:');
    console.log('   cd mastra-backend && npm start');
    return false;
  }
};

// Run the test
testMastraBackend().then(success => {
  process.exit(success ? 0 : 1);
});
