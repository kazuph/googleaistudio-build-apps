document.addEventListener('DOMContentLoaded', async () => {
  const notTechbookDiv = document.getElementById('not-techbook');
  const techbookContentDiv = document.getElementById('techbook-content');
  const startSwipeButton = document.getElementById('start-swipe');
  const resetHistoryButton = document.getElementById('reset-history');
  const downloadCsvButton = document.getElementById('download-csv');
  const copyToClipboardButton = document.getElementById('copy-to-clipboard');
  const messageDiv = document.getElementById('message');
  const likedCountSpan = document.getElementById('liked-count');
  const dislikedCountSpan = document.getElementById('disliked-count');
  
  // Get current tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  // Check if we're on techbookfest.org
  const isMarketPage = tab.url && tab.url.includes('techbookfest.org/event/') && tab.url.includes('/market/');
  const isProductPage = tab.url && tab.url.includes('techbookfest.org/product/');
  
  if (!isMarketPage && !isProductPage) {
    notTechbookDiv.style.display = 'block';
    techbookContentDiv.style.display = 'none';
    return;
  }
  
  // Show techbook content
  notTechbookDiv.style.display = 'none';
  techbookContentDiv.style.display = 'block';
  
  // Load and display statistics
  await updateStats();
  
  // Load and display recent books
  await updateRecentBooks();
  
  // Handle different page types
  if (isProductPage) {
    // Product detail page - replace start button with rating buttons
    startSwipeButton.style.display = 'none';
    
    // Get current rating first
    const result = await chrome.storage.local.get(['swipeHistory']);
    const swipeHistory = result.swipeHistory || {};
    
    // Extract book ID from current tab URL
    const bookId = extractBookIdFromTabUrl(tab.url);
    const currentRating = bookId ? swipeHistory[bookId] : null;
    
    // Create rating buttons container
    const ratingContainer = document.createElement('div');
    ratingContainer.className = 'rating-buttons-container';
    ratingContainer.style.cssText = 'display: flex; gap: 8px; margin-bottom: 12px;';
    
    const likeBtn = document.createElement('button');
    likeBtn.className = 'rating-btn like-btn';
    likeBtn.innerHTML = '❤️';
    
    const dislikeBtn = document.createElement('button');
    dislikeBtn.className = 'rating-btn dislike-btn';
    dislikeBtn.innerHTML = '❌';
    
    // Set initial styles based on current rating
    updateButtonStyles(likeBtn, dislikeBtn, currentRating);
    
    // Add hover effects
    const addHoverEffect = (btn, isActive) => {
      btn.addEventListener('mouseenter', () => {
        if (!isActive) {
          btn.style.transform = 'translateY(-1px)';
          btn.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
        }
      });
      btn.addEventListener('mouseleave', () => {
        if (!isActive) {
          btn.style.transform = 'translateY(0)';
          btn.style.boxShadow = 'none';
        }
      });
    };
    
    addHoverEffect(likeBtn, currentRating === 'like');
    addHoverEffect(dislikeBtn, currentRating === 'dislike');
    
    ratingContainer.appendChild(likeBtn);
    ratingContainer.appendChild(dislikeBtn);
    
    // Insert before the start button
    startSwipeButton.parentNode.insertBefore(ratingContainer, startSwipeButton);
    
    // Add event listeners
    likeBtn.addEventListener('click', async () => {
      chrome.tabs.sendMessage(tab.id, { action: 'updateRating', rating: 'like' });
      window.close();
    });
    
    dislikeBtn.addEventListener('click', async () => {
      chrome.tabs.sendMessage(tab.id, { action: 'updateRating', rating: 'dislike' });
      window.close();
    });
  } else {
    // Market page - start swipe mode
    startSwipeButton.addEventListener('click', async () => {
      chrome.tabs.sendMessage(tab.id, { action: 'startSwipeMode' });
      window.close();
    });
  }
  
  // Download CSV
  downloadCsvButton.addEventListener('click', async () => {
    await downloadLikedBooksAsCsv();
  });

  // Copy to clipboard
  copyToClipboardButton.addEventListener('click', async () => {
    await copyLikedBooksToClipboard();
  });

  // Reset history
  resetHistoryButton.addEventListener('click', async () => {
    if (confirm('本当に履歴をリセットしますか？\nこの操作は取り消せません。')) {
      await chrome.storage.local.clear();
      showMessage('履歴をリセットしました', 'success');
      await updateStats();
      await updateRecentBooks();
      
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
    
    // Enable/disable export buttons based on liked books count
    const hasLikedBooks = likedCount > 0;
    downloadCsvButton.disabled = !hasLikedBooks;
    copyToClipboardButton.disabled = !hasLikedBooks;
  }
  
  function showMessage(text, type) {
    messageDiv.textContent = text;
    messageDiv.className = `message ${type}`;
    messageDiv.style.display = 'block';
    
    setTimeout(() => {
      messageDiv.style.display = 'none';
    }, 3000);
  }

  async function downloadLikedBooksAsCsv() {
    try {
      const likedBooks = await getLikedBooksData();
      if (likedBooks.length === 0) {
        showMessage('いいねした書籍がありません', 'error');
        return;
      }

      const csvContent = generateCsv(likedBooks);
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
      const filename = `techbook-liked-books-${timestamp}.csv`;
      
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      showMessage(`CSVファイルをダウンロードしました (${likedBooks.length}冊)`, 'success');
    } catch (error) {
      console.error('CSV download error:', error);
      showMessage('CSVダウンロードに失敗しました', 'error');
    }
  }

  async function copyLikedBooksToClipboard() {
    try {
      const likedBooks = await getLikedBooksData();
      if (likedBooks.length === 0) {
        showMessage('いいねした書籍がありません', 'error');
        return;
      }

      const csvContent = generateCsv(likedBooks);
      await navigator.clipboard.writeText(csvContent);
      showMessage(`クリップボードにコピーしました (${likedBooks.length}冊)`, 'success');
    } catch (error) {
      console.error('Clipboard copy error:', error);
      showMessage('クリップボードへのコピーに失敗しました', 'error');
    }
  }

  async function getLikedBooksData() {
    const [likedBooksData, swipeHistory] = await Promise.all([
      chrome.storage.local.get(['likedBooksData']),
      chrome.storage.local.get(['swipeHistory'])
    ]);

    const likedBooks = likedBooksData.likedBooksData || {};
    const history = swipeHistory.swipeHistory || {};
    
    // Filter only liked books
    const likedBookIds = Object.keys(history).filter(id => history[id] === 'like');
    
    return likedBookIds.map(id => likedBooks[id]).filter(book => book);
  }

  function generateCsv(books) {
    const headers = ['タイトル', '概要', '価格', 'OGP画像URL', 'URL'];
    const csvRows = [headers.join(',')];
    
    books.forEach(book => {
      const row = [
        escapeCsvField(book.title || ''),
        escapeCsvField(book.description || ''),
        escapeCsvField(book.price || ''),
        escapeCsvField(book.imageUrl || ''),
        escapeCsvField(book.url || '')
      ];
      csvRows.push(row.join(','));
    });
    
    return '\uFEFF' + csvRows.join('\n'); // Add BOM for proper UTF-8 encoding
  }

  function escapeCsvField(field) {
    if (typeof field !== 'string') return '';
    
    // Remove newlines and normalize whitespace
    field = field.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
    
    // Escape quotes and wrap in quotes if necessary
    if (field.includes(',') || field.includes('"') || field.includes('\n')) {
      field = '"' + field.replace(/"/g, '""') + '"';
    }
    
    return field;
  }

  function extractBookIdFromTabUrl(url) {
    if (!url) return null;
    const match = url.match(/\/product\/([^\/\?]+)/);
    return match ? match[1] : null;
  }

  function updateButtonStyles(likeBtn, dislikeBtn, currentRating) {
    const baseStyle = 'flex: 1; padding: 12px; border: none; border-radius: 8px; font-size: 24px; cursor: pointer; transition: all 0.2s ease;';
    
    if (currentRating === 'like') {
      // Like is active, dislike is inactive (grayscale)
      likeBtn.style.cssText = baseStyle + ' background-color: #ff4458; color: white; transform: scale(1.1); box-shadow: 0 4px 12px rgba(255, 68, 88, 0.3);';
      dislikeBtn.style.cssText = baseStyle + ' background-color: #f8f9fa; color: #6c757d; filter: grayscale(100%); opacity: 0.6;';
    } else if (currentRating === 'dislike') {
      // Dislike is active, like is inactive (grayscale)
      likeBtn.style.cssText = baseStyle + ' background-color: #f8f9fa; color: #ff69b4; filter: grayscale(100%); opacity: 0.6;';
      dislikeBtn.style.cssText = baseStyle + ' background-color: #6c757d; color: white; transform: scale(1.1); box-shadow: 0 4px 12px rgba(108, 117, 125, 0.3);';
    } else {
      // No rating - both buttons in default state
      likeBtn.style.cssText = baseStyle + ' background-color: #fff0f1; color: #ff4458; border: 2px solid #ff4458;';
      dislikeBtn.style.cssText = baseStyle + ' background-color: #f8f9fa; color: #6c757d; border: 2px solid #6c757d;';
    }
  }

  async function updateRecentBooks() {
    const recentBooksContent = document.getElementById('recent-books-content');
    
    try {
      const likedBooks = await getLikedBooksData();
      
      if (likedBooks.length === 0) {
        recentBooksContent.innerHTML = '<div class="empty-books">まだいいねした書籍がありません</div>';
        return;
      }

      // Sort by most recent (likedAt timestamp) - show all books, don't limit to 10
      const sortedBooks = likedBooks
        .sort((a, b) => (b.likedAt || 0) - (a.likedAt || 0));
      
      const table = document.createElement('table');
      table.className = 'books-table';
      
      const tbody = document.createElement('tbody');
      
      sortedBooks.forEach((book, index) => {
        const row = document.createElement('tr');
        row.addEventListener('click', () => {
          chrome.tabs.create({ url: book.url, active: false });
        });
        
        row.innerHTML = `
          <td class="book-number">${index + 1}</td>
          <td class="book-title" title="${escapeHtml(book.title || '')}">${escapeHtml(truncateText(book.title || 'タイトル不明', 30))}</td>
          <td class="book-price">${escapeHtml(book.price || '')}</td>
        `;
        
        tbody.appendChild(row);
      });
      
      table.appendChild(tbody);
      recentBooksContent.innerHTML = '';
      recentBooksContent.appendChild(table);
      
    } catch (error) {
      console.error('Failed to load recent books:', error);
      recentBooksContent.innerHTML = '<div class="empty-books">書籍の読み込みに失敗しました</div>';
    }
  }

  function truncateText(text, maxLength) {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }

  function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
});