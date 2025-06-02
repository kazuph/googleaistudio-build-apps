document.addEventListener('DOMContentLoaded', async () => {
  const notTechbookDiv = document.getElementById('not-techbook');
  const techbookContentDiv = document.getElementById('techbook-content');
  const startSwipeButton = document.getElementById('start-swipe');
  const resetHistoryButton = document.getElementById('reset-history');
  const messageDiv = document.getElementById('message');
  const likedCountSpan = document.getElementById('liked-count');
  const dislikedCountSpan = document.getElementById('disliked-count');
  
  // Get current tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  // Check if we're on techbookfest.org
  if (!tab.url || !tab.url.includes('techbookfest.org/event/') || !tab.url.includes('/market/')) {
    notTechbookDiv.style.display = 'block';
    techbookContentDiv.style.display = 'none';
    return;
  }
  
  // Show techbook content
  notTechbookDiv.style.display = 'none';
  techbookContentDiv.style.display = 'block';
  
  // Load and display statistics
  await updateStats();
  
  // Start swipe mode
  startSwipeButton.addEventListener('click', async () => {
    chrome.tabs.sendMessage(tab.id, { action: 'startSwipeMode' });
    window.close();
  });
  
  // Reset history
  resetHistoryButton.addEventListener('click', async () => {
    if (confirm('本当に履歴をリセットしますか？\nこの操作は取り消せません。')) {
      await chrome.storage.local.clear();
      showMessage('履歴をリセットしました', 'success');
      await updateStats();
      
      // Reload the current tab to reflect changes
      chrome.tabs.reload(tab.id);
    }
  });
  
  async function updateStats() {
    const result = await chrome.storage.local.get(['swipeHistory']);
    const swipeHistory = result.swipeHistory || {};
    
    const likedCount = Object.values(swipeHistory).filter(s => s === 'like').length;
    const dislikedCount = Object.values(swipeHistory).filter(s => s === 'dislike').length;
    
    likedCountSpan.textContent = `${likedCount}冊`;
    dislikedCountSpan.textContent = `${dislikedCount}冊`;
  }
  
  function showMessage(text, type) {
    messageDiv.textContent = text;
    messageDiv.className = `message ${type}`;
    messageDiv.style.display = 'block';
    
    setTimeout(() => {
      messageDiv.style.display = 'none';
    }, 3000);
  }
});