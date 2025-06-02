class TechbookSwipe {
  constructor() {
    this.books = [];
    this.currentIndex = 0;
    this.swipeContainer = null;
    this.swipeHistory = {};
    this.init();
  }

  async init() {
    await this.loadSwipeHistory();
    this.markSwipedBooks();
    chrome.runtime.onMessage.addListener((request) => {
      if (request.action === 'startSwipeMode') {
        this.startSwipeMode();
      }
    });
  }

  async loadSwipeHistory() {
    const result = await chrome.storage.local.get(['swipeHistory']);
    this.swipeHistory = result.swipeHistory || {};
  }

  async saveSwipeHistory() {
    await chrome.storage.local.set({ swipeHistory: this.swipeHistory });
  }

  markSwipedBooks() {
    const bookLinks = document.querySelectorAll('a[href*="/product/"]');
    bookLinks.forEach(link => {
      const href = link.getAttribute('href');
      const bookId = this.extractBookId(href);
      
      if (this.swipeHistory[bookId]) {
        const status = this.swipeHistory[bookId];
        const bookCard = link.closest('li, div');
        
        if (bookCard) {
          if (status === 'dislike') {
            bookCard.style.display = 'none';
          } else if (status === 'like') {
            const heartIcon = document.createElement('span');
            heartIcon.className = 'techbook-heart-icon';
            heartIcon.innerHTML = '❤️';
            heartIcon.style.cssText = 'position: absolute; top: 10px; right: 10px; font-size: 24px; z-index: 10;';
            bookCard.style.position = 'relative';
            bookCard.appendChild(heartIcon);
          }
        }
      }
    });
  }

  extractBookId(href) {
    const match = href.match(/\/product\/([^\/\?]+)/);
    return match ? match[1] : href;
  }

  isPriceText(text) {
    // 価格らしいテキストかどうかを判定
    const pricePatterns = [
      /¥[\d,]+/,           // ¥1000, ¥1,000
      /￥[\d,]+/,          // ￥1000
      /\d+円/,             // 1000円
      /\d+[\s]*yen/i,      // 1000 yen
      /price[\s]*:[\s]*¥?[\d,]+/i,  // Price: ¥1000
      /価格[\s]*:?[\s]*¥?[\d,]+/,   // 価格: ¥1000
      /^¥[\d,]+$/,         // 純粋な価格表示
      /^[\d,]+円$/         // 純粋な価格表示
    ];
    
    return pricePatterns.some(pattern => pattern.test(text));
  }

  startSwipeMode() {
    this.collectBooks();
    if (this.books.length === 0) {
      alert('表示されている書籍が見つかりませんでした。');
      return;
    }
    
    this.createSwipeUI();
    this.showCurrentBook();
  }

  collectBooks() {
    const bookLinks = document.querySelectorAll('a[href*="/product/"]');
    const uniqueBooks = new Map();
    
    bookLinks.forEach(link => {
      const href = link.getAttribute('href');
      const bookId = this.extractBookId(href);
      
      if (!this.swipeHistory[bookId] || this.swipeHistory[bookId] !== 'dislike') {
        const bookCard = link.closest('li, div');
        
        // Try to find image URL from multiple sources
        let imageUrl = '';
        let title = '';
        
        // First try: look for img element
        const imgElement = link.querySelector('img');
        if (imgElement) {
          imageUrl = imgElement.src || '';
          title = imgElement.alt || '';
        }
        
        // Second try: look for div with background-image style
        if (!imageUrl) {
          const divWithBg = link.querySelector('div[style*="background-image"]');
          if (divWithBg) {
            const bgStyle = divWithBg.style.backgroundImage;
            const urlMatch = bgStyle.match(/url\(['"]?([^'")]+)['"]?\)/);
            if (urlMatch && urlMatch[1]) {
              imageUrl = urlMatch[1];
            }
          }
        }
        
        // Try to get title from card structure (outside of link)
        if (!title && bookCard) {
          // 書籍カード内でタイトルらしい要素を探す
          const titleCandidates = bookCard.querySelectorAll('div[dir="auto"]');
          for (const candidate of titleCandidates) {
            const text = candidate.textContent?.trim();
            // 価格ではないテキストをタイトルとして採用
            if (text && !this.isPriceText(text) && text.length > 2) {
              title = text;
              break;
            }
          }
        }
        
        // Third try: check if the link itself has background-image
        if (!imageUrl) {
          const bgStyle = window.getComputedStyle(link).backgroundImage;
          if (bgStyle && bgStyle !== 'none') {
            const urlMatch = bgStyle.match(/url\(['"]?([^'")]+)['"]?\)/);
            if (urlMatch && urlMatch[1]) {
              imageUrl = urlMatch[1];
            }
          }
        }
        
        // Get title if not already found
        if (!title) {
          // linkのテキストから価格部分を除外してタイトルを取得
          let linkText = link.textContent?.trim() || '';
          
          // 価格パターンを除外
          if (linkText && this.isPriceText(linkText)) {
            // 価格が含まれている場合、最初の価格より前の部分をタイトルとする
            const priceMatch = linkText.match(/[¥￥]\d+|[\d,]+円/);
            if (priceMatch && priceMatch.index > 0) {
              title = linkText.substring(0, priceMatch.index).trim();
            }
          }
          
          // それでもタイトルが取得できない場合
          if (!title) {
            // alt属性やaria-label属性を探す
            const img = link.querySelector('img');
            if (img && img.alt) {
              title = img.alt;
            } else {
              const ariaLabel = link.getAttribute('aria-label');
              if (ariaLabel) {
                title = ariaLabel;
              } else {
                title = 'タイトル不明';
              }
            }
          }
        }
        
        // 一覧ページから価格を取得
        let listPrice = '';
        if (bookCard) {
          // 価格らしいテキストを探す
          const priceElements = bookCard.querySelectorAll('div[dir="auto"], span, div');
          for (const el of priceElements) {
            const text = el.textContent?.trim();
            if (text && this.isPriceText(text) && text.length < 20) {
              listPrice = text;
              break;
            }
          }
        }
        
        if (!uniqueBooks.has(bookId)) {
          uniqueBooks.set(bookId, {
            id: bookId,
            href: href.startsWith('http') ? href : `${window.location.origin}${href}`,
            title: title,
            imageUrl: imageUrl,
            listPrice: listPrice, // 一覧ページの価格
            element: link
          });
        }
      }
    });
    
    this.books = Array.from(uniqueBooks.values());
    this.shuffleArray(this.books);
  }

  shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }

  createSwipeUI() {
    this.swipeContainer = document.createElement('div');
    this.swipeContainer.className = 'techbook-swipe-container';
    this.swipeContainer.innerHTML = `
      <div class="swipe-overlay"></div>
      <div class="swipe-modal">
        <button class="swipe-close">✕</button>
        <div class="swipe-header">
          <span class="swipe-counter"></span>
        </div>
        <div class="swipe-card-container">
          <div class="swipe-card">
            <div class="swipe-card-image"></div>
            <div class="swipe-card-content">
              <h3 class="swipe-card-title"></h3>
              <div class="swipe-card-description">
                <div class="loading">詳細を読み込み中...</div>
              </div>
            </div>
          </div>
          <div class="swipe-indicators">
            <div class="like-indicator">❤️ LIKE</div>
            <div class="nope-indicator">✕ NOPE</div>
          </div>
        </div>
        <div class="swipe-buttons">
          <button class="swipe-button dislike-button">✕</button>
          <button class="swipe-button like-button">❤️</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(this.swipeContainer);
    
    this.setupEventListeners();
  }

  setupEventListeners() {
    const closeButton = this.swipeContainer.querySelector('.swipe-close');
    const likeButton = this.swipeContainer.querySelector('.like-button');
    const dislikeButton = this.swipeContainer.querySelector('.dislike-button');
    const card = this.swipeContainer.querySelector('.swipe-card');
    
    closeButton.addEventListener('click', () => this.closeSwipeMode());
    likeButton.addEventListener('click', () => this.swipe('like'));
    dislikeButton.addEventListener('click', () => this.swipe('dislike'));
    
    this.setupSwipeGestures(card);
    
    document.addEventListener('keydown', (e) => {
      if (!this.swipeContainer) return;
      
      if (e.key === 'ArrowLeft') {
        this.swipe('dislike');
      } else if (e.key === 'ArrowRight') {
        this.swipe('like');
      } else if (e.key === 'Escape') {
        this.closeSwipeMode();
      }
    });
  }

  setupSwipeGestures(card) {
    let startX = 0;
    let currentX = 0;
    let isDragging = false;
    
    const handleStart = (e) => {
      isDragging = true;
      startX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
      card.style.transition = 'none';
    };
    
    const handleMove = (e) => {
      if (!isDragging) return;
      
      currentX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
      const deltaX = currentX - startX;
      const rotation = deltaX * 0.1;
      
      card.style.transform = `translateX(${deltaX}px) rotate(${rotation}deg)`;
      
      const likeIndicator = this.swipeContainer.querySelector('.like-indicator');
      const nopeIndicator = this.swipeContainer.querySelector('.nope-indicator');
      
      if (deltaX > 50) {
        likeIndicator.style.opacity = Math.min(1, deltaX / 150);
        nopeIndicator.style.opacity = 0;
      } else if (deltaX < -50) {
        nopeIndicator.style.opacity = Math.min(1, Math.abs(deltaX) / 150);
        likeIndicator.style.opacity = 0;
      } else {
        likeIndicator.style.opacity = 0;
        nopeIndicator.style.opacity = 0;
      }
    };
    
    const handleEnd = () => {
      if (!isDragging) return;
      isDragging = false;
      
      const deltaX = currentX - startX;
      card.style.transition = 'transform 0.3s ease-out';
      
      if (Math.abs(deltaX) > 100) {
        if (deltaX > 0) {
          this.swipe('like');
        } else {
          this.swipe('dislike');
        }
      } else {
        card.style.transform = 'translateX(0) rotate(0)';
        this.swipeContainer.querySelector('.like-indicator').style.opacity = 0;
        this.swipeContainer.querySelector('.nope-indicator').style.opacity = 0;
      }
    };
    
    card.addEventListener('mousedown', handleStart);
    card.addEventListener('mousemove', handleMove);
    card.addEventListener('mouseup', handleEnd);
    card.addEventListener('mouseleave', handleEnd);
    
    card.addEventListener('touchstart', handleStart);
    card.addEventListener('touchmove', handleMove);
    card.addEventListener('touchend', handleEnd);
  }

  async showCurrentBook() {
    if (this.currentIndex >= this.books.length) {
      this.showComplete();
      return;
    }
    
    const book = this.books[this.currentIndex];
    const counter = this.swipeContainer.querySelector('.swipe-counter');
    const imageContainer = this.swipeContainer.querySelector('.swipe-card-image');
    const titleElement = this.swipeContainer.querySelector('.swipe-card-title');
    const descriptionElement = this.swipeContainer.querySelector('.swipe-card-description');
    const card = this.swipeContainer.querySelector('.swipe-card');
    
    counter.textContent = `${this.currentIndex + 1} / ${this.books.length}`;
    titleElement.textContent = book.title;
    
    if (book.imageUrl) {
      imageContainer.style.backgroundImage = `url(${book.imageUrl})`;
    } else {
      imageContainer.style.backgroundImage = 'none';
      imageContainer.style.backgroundColor = '#f0f0f0';
    }
    
    card.style.transform = 'translateX(0) rotate(0)';
    this.swipeContainer.querySelector('.like-indicator').style.opacity = 0;
    this.swipeContainer.querySelector('.nope-indicator').style.opacity = 0;
    
    descriptionElement.innerHTML = '<div class="loading">詳細を読み込み中...</div>';
    
    await this.loadBookDetails(book, descriptionElement);
  }

  async loadBookDetails(book, descriptionElement) {
    try {
      const response = await fetch(book.href);
      if (!response.ok) throw new Error('Failed to fetch');
      
      const html = await response.text();
      const bookData = this.parseBookData(html);
      
      // 詳細ページから取得したタイトルがある場合、カードのタイトルを更新
      if (bookData.title && bookData.title !== book.title) {
        const titleElement = this.swipeContainer.querySelector('.swipe-card-title');
        if (titleElement) {
          titleElement.textContent = bookData.title;
        }
      }
      
      // 高解像度の画像が取得できた場合、カードの画像を更新
      if (bookData.imageUrl && bookData.imageUrl !== book.imageUrl) {
        const imageContainer = this.swipeContainer.querySelector('.swipe-card-image');
        if (imageContainer) {
          imageContainer.style.backgroundImage = `url(${bookData.imageUrl})`;
        }
      }
      
      let content = '';
      
      // 価格を表示
      const priceToShow = bookData.price || book.listPrice;
      if (priceToShow) {
        content += '<div class="techbook-info">';
        content += `<span class="techbook-price">${this.escapeHtml(priceToShow)}</span>`;
        content += '</div>';
      }
      
      if (bookData.author) {
        content += `<div class="author">著者: ${this.escapeHtml(bookData.author)}</div>`;
      }
      
      if (bookData.description) {
        content += `<div class="description">${this.parseMarkdown(bookData.description)}</div>`;
      }
      if (bookData.tags.length > 0) {
        content += `<div class="tags">${bookData.tags.map(tag => 
          `<span class="tag">${this.escapeHtml(tag)}</span>`
        ).join('')}</div>`;
      }
      
      descriptionElement.innerHTML = content || '<div class="no-description">詳細情報がありません</div>';
    } catch (error) {
      console.error('Failed to load book details:', error);
      descriptionElement.innerHTML = '<div class="error">詳細情報を取得できませんでした</div>';
    }
  }

  parseBookData(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    // 詳細ページから正確なタイトルを取得
    const title = this.extractText(doc, [
      'h1',
      'title',
      '.book-title',
      '.product-title',
      '[data-testid="book-title"]',
      'meta[property="og:title"]'
    ]);
    
    const author = this.extractText(doc, [
      '.author',
      '.circle-name',
      '[data-testid="circle-name"]',
      '.book-author'
    ]);
    
    const description = this.extractText(doc, [
      '.description',
      '.book-description',
      '[data-testid="description"]',
      'meta[property="og:description"]',
      '.summary'
    ]);
    
    const price = this.extractPrice(doc);
    
    const tags = this.extractTags(doc);
    
    // 高解像度の画像URLを取得
    const imageUrl = this.extractHighResImage(doc);
    
    return { title, author, description, price, tags, imageUrl };
  }

  extractText(doc, selectors) {
    for (const selector of selectors) {
      const element = doc.querySelector(selector);
      if (element) {
        if (element.tagName === 'META') {
          return element.getAttribute('content');
        }
        return element.textContent?.trim();
      }
    }
    return null;
  }

  extractTags(doc) {
    const tagSelectors = ['.tag', '.tags .tag', '.category', '.genre'];
    const tags = [];
    
    tagSelectors.forEach(selector => {
      const elements = doc.querySelectorAll(selector);
      elements.forEach(el => {
        const text = el.textContent?.trim();
        if (text && !tags.includes(text)) {
          tags.push(text);
        }
      });
    });
    
    return tags;
  }

  extractPrice(doc) {
    // 技術書典の詳細ページから価格情報を取得
    const prices = [];
    
    // 技術書典の価格構造: buttonタグ内のdiv[dir="auto"]に価格が含まれる
    const priceButtons = doc.querySelectorAll('button');
    for (const button of priceButtons) {
      const divs = button.querySelectorAll('div[dir="auto"]');
      for (const div of divs) {
        const text = div.textContent?.trim();
        if (text && this.isPriceText(text)) {
          prices.push(text);
        }
      }
    }
    
    // ボタン以外の場所にある価格も探す（会場版など）
    const allDivs = doc.querySelectorAll('div[dir="auto"]');
    for (const div of allDivs) {
      const text = div.textContent?.trim();
      if (text && this.isPriceText(text) && !prices.includes(text)) {
        prices.push(text);
      }
    }
    
    // 価格が複数ある場合は最も安い価格を返す
    if (prices.length > 0) {
      // 価格を数値に変換してソート
      const sortedPrices = prices.sort((a, b) => {
        const priceA = this.extractPriceNumber(a);
        const priceB = this.extractPriceNumber(b);
        return priceA - priceB;
      });
      return sortedPrices[0];
    }
    
    // フォールバック: より一般的なセレクタで検索
    const priceSelectors = [
      '.price',
      '.book-price',
      '.product-price',
      '[data-testid="price"]',
      '[class*="price"]'
    ];
    
    for (const selector of priceSelectors) {
      const elements = doc.querySelectorAll(selector);
      for (const element of elements) {
        const text = element.textContent?.trim();
        if (text && this.isPriceText(text)) {
          return text;
        }
      }
    }
    
    return null;
  }

  extractPriceNumber(priceText) {
    // 価格文字列から数値を抽出
    const match = priceText.match(/[\d,]+/);
    if (match) {
      return parseInt(match[0].replace(/,/g, ''));
    }
    return 999999; // 解析できない場合は大きな値を返す
  }

  extractHighResImage(doc) {
    // OGP画像を優先的に取得
    const ogImage = doc.querySelector('meta[property="og:image"]');
    if (ogImage) {
      return ogImage.getAttribute('content');
    }
    
    // 詳細ページの画像要素を探す
    const imageSelectors = [
      '.book-cover img',
      '.product-image img',
      '.main-image img',
      'img[alt*="表紙"]',
      'img[alt*="cover"]',
      '.book-image img',
      'main img',
      'article img'
    ];
    
    for (const selector of imageSelectors) {
      const img = doc.querySelector(selector);
      if (img && img.src) {
        // より高解像度のバージョンがあるかチェック
        let imageUrl = img.src;
        if (imageUrl.includes('size=')) {
          // size=160 を size=640 などに変更
          imageUrl = imageUrl.replace(/size=\d+/, 'size=640');
        }
        return imageUrl;
      }
    }
    
    // 背景画像として設定されている場合
    const divWithBgImage = doc.querySelector('div[style*="background-image"]');
    if (divWithBgImage) {
      const style = divWithBgImage.getAttribute('style');
      const match = style.match(/url\(['"]?([^'")]+)['"]?\)/);
      if (match && match[1]) {
        let imageUrl = match[1];
        if (imageUrl.includes('size=')) {
          imageUrl = imageUrl.replace(/size=\d+/, 'size=640');
        }
        return imageUrl;
      }
    }
    
    return null;
  }

  async swipe(direction) {
    const book = this.books[this.currentIndex];
    const card = this.swipeContainer.querySelector('.swipe-card');
    
    card.style.transition = 'transform 0.5s ease-out';
    
    if (direction === 'like') {
      card.style.transform = 'translateX(150%) rotate(30deg)';
      this.swipeHistory[book.id] = 'like';
      
      setTimeout(() => {
        // バックグラウンドで新しいタブを開く
        chrome.runtime.sendMessage({
          action: 'openInBackground',
          url: book.href
        });
      }, 300);
    } else {
      card.style.transform = 'translateX(-150%) rotate(-30deg)';
      this.swipeHistory[book.id] = 'dislike';
    }
    
    await this.saveSwipeHistory();
    
    setTimeout(() => {
      this.currentIndex++;
      this.showCurrentBook();
    }, 500);
  }

  showComplete() {
    const modal = this.swipeContainer.querySelector('.swipe-modal');
    modal.innerHTML = `
      <button class="swipe-close">✕</button>
      <div class="complete-message">
        <h2>すべての書籍を確認しました！</h2>
        <p>いいねした書籍: ${Object.values(this.swipeHistory).filter(s => s === 'like').length}冊</p>
        <p>スキップした書籍: ${Object.values(this.swipeHistory).filter(s => s === 'dislike').length}冊</p>
        <button class="reset-button">履歴をリセット</button>
      </div>
    `;
    
    this.swipeContainer.querySelector('.swipe-close').addEventListener('click', () => this.closeSwipeMode());
    this.swipeContainer.querySelector('.reset-button').addEventListener('click', () => this.resetHistory());
  }

  async resetHistory() {
    this.swipeHistory = {};
    await this.saveSwipeHistory();
    location.reload();
  }

  closeSwipeMode() {
    if (this.swipeContainer) {
      this.swipeContainer.remove();
      this.swipeContainer = null;
    }
    this.markSwipedBooks();
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  parseMarkdown(text) {
    if (!text) return '';
    
    let html = this.escapeHtml(text);
    html = html.replace(/\n/g, '<br>');
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>');
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    html = html.replace(/(?<!_)_([^_]+)_(?!_)/g, '<em>$1</em>');
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    
    return html;
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new TechbookSwipe();
  });
} else {
  new TechbookSwipe();
}