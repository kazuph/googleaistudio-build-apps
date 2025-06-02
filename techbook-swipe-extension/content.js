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
    
    // Check if we're on a product detail page
    if (this.isProductDetailPage()) {
      this.initProductDetailPage();
    } else {
      // ページ読み込み時に履歴を反映
      this.applySwipeHistoryToPage();
      
      // DOM変更を監視して、新しく追加された書籍にも履歴を反映
      this.observePageChanges();
    }
    
    chrome.runtime.onMessage.addListener((request) => {
      if (request.action === 'startSwipeMode') {
        this.startSwipeMode();
      } else if (request.action === 'showRatingInterface') {
        this.showRatingInterface();
      } else if (request.action === 'updateRating') {
        this.handleDirectRating(request.rating);
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

  applySwipeHistoryToPage() {
    const bookLinks = document.querySelectorAll('a[href*="/product/"]');
    bookLinks.forEach(link => {
      const href = link.getAttribute('href');
      const bookId = this.extractBookId(href);
      
      if (this.swipeHistory[bookId]) {
        const status = this.swipeHistory[bookId];
        
        // より外側の要素を探す（padding-rightやmargin-bottomがある要素）
        let elementToHide = link.closest('div[tabindex="0"]');
        if (elementToHide && elementToHide.parentElement) {
          const parent = elementToHide.parentElement;
          // padding-rightやmargin-bottomのスタイルがある親要素を探す
          if (parent.style.paddingRight || parent.style.marginBottom) {
            elementToHide = parent;
          }
        }
        
        // フォールバック：見つからない場合は従来の方法
        if (!elementToHide) {
          elementToHide = link.closest('li, div');
        }
        
        if (elementToHide && !elementToHide.dataset.swipeProcessed) {
          elementToHide.dataset.swipeProcessed = 'true';
          
          if (status === 'dislike') {
            elementToHide.style.display = 'none';
          } else if (status === 'like') {
            // ハートアイコンを追加する要素を決定
            const bookCard = link.closest('div[tabindex="0"]') || link.closest('li, div');
            if (bookCard && !bookCard.querySelector('.techbook-heart-icon')) {
              // ハートアイコンを追加
              const heartIcon = document.createElement('span');
              heartIcon.className = 'techbook-heart-icon';
              heartIcon.innerHTML = '❤️';
              heartIcon.style.cssText = 'position: absolute; top: 10px; right: 10px; font-size: 24px; z-index: 10;';
              bookCard.style.position = 'relative';
              bookCard.appendChild(heartIcon);
              
              // ピンクの枠を追加
              const bookImage = bookCard.querySelector('button, div[style*="box-shadow"]');
              if (bookImage && !bookImage.classList.contains('techbook-liked')) {
                bookImage.classList.add('techbook-liked');
                bookImage.style.border = '3px solid #FF69B4';
                bookImage.style.borderRadius = '4px';
                bookImage.style.boxSizing = 'border-box';
              }
            }
          }
        }
      }
    });
  }

  observePageChanges() {
    // MutationObserverで動的に追加される書籍を監視
    const observer = new MutationObserver((mutations) => {
      // 新しい書籍が追加されたかチェック
      let hasNewBooks = false;
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === 1 && (node.querySelector && node.querySelector('a[href*="/product/"]'))) {
            hasNewBooks = true;
          }
        });
      });
      
      // 新しい書籍があれば履歴を適用
      if (hasNewBooks) {
        setTimeout(() => this.applySwipeHistoryToPage(), 100);
      }
    });
    
    // body全体を監視
    observer.observe(document.body, {
      childList: true,
      subtree: true
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
      
      // Store the detailed book data in the book object for later use
      book.detailedData = bookData;
      
      // 詳細ページから取得したタイトルがある場合、カードのタイトルを更新
      if (bookData.title && bookData.title !== book.title) {
        const titleElement = this.swipeContainer.querySelector('.swipe-card-title');
        if (titleElement) {
          titleElement.textContent = bookData.title;
        }
        book.title = bookData.title; // Update the book object
      }
      
      // 高解像度の画像が取得できた場合、カードの画像を更新
      if (bookData.imageUrl && bookData.imageUrl !== book.imageUrl) {
        const imageContainer = this.swipeContainer.querySelector('.swipe-card-image');
        if (imageContainer) {
          imageContainer.style.backgroundImage = `url(${bookData.imageUrl})`;
        }
        book.imageUrl = bookData.imageUrl; // Update the book object
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
      
      // Store detailed book data for export
      await this.saveBookData(book);
      
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
        <p class="complete-note">履歴のリセットは拡張機能のポップアップから行えます</p>
      </div>
    `;
    
    this.swipeContainer.querySelector('.swipe-close').addEventListener('click', () => this.closeSwipeMode());
  }

  closeSwipeMode() {
    if (this.swipeContainer) {
      this.swipeContainer.remove();
      this.swipeContainer = null;
    }
    this.applySwipeHistoryToPage();
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

  async saveBookData(book) {
    const result = await chrome.storage.local.get(['likedBooksData']);
    const likedBooksData = result.likedBooksData || {};
    
    const detailedData = book.detailedData || {};
    
    likedBooksData[book.id] = {
      title: book.title,
      description: detailedData.description || '',
      price: detailedData.price || book.listPrice || '',
      imageUrl: book.imageUrl || '',
      url: book.href,
      author: detailedData.author || '',
      tags: detailedData.tags || []
    };
    
    await chrome.storage.local.set({ likedBooksData });
  }

  isProductDetailPage() {
    return window.location.pathname.includes('/product/');
  }

  initProductDetailPage() {
    // Apply visual indication if this book is already rated
    this.applyProductPageRating();
  }

  applyProductPageRating() {
    const bookId = this.extractBookIdFromUrl(window.location.href);
    if (!bookId) return;

    const status = this.swipeHistory[bookId];
    if (!status) return;

    // Add visual indicator to the page
    const indicator = document.createElement('div');
    indicator.className = 'techbook-rating-indicator';
    indicator.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 16px;
      border-radius: 8px;
      color: white;
      font-weight: bold;
      font-size: 16px;
      z-index: 10000;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    `;

    if (status === 'like') {
      indicator.textContent = '❤️ いいね済み';
      indicator.style.backgroundColor = '#ff4458';
    } else if (status === 'dislike') {
      indicator.textContent = '❌ 済み';
      indicator.style.backgroundColor = '#6c757d';
    }

    document.body.appendChild(indicator);
  }

  extractBookIdFromUrl(url) {
    const match = url.match(/\/product\/([^\/\?]+)/);
    return match ? match[1] : null;
  }

  async showRatingInterface() {
    const bookId = this.extractBookIdFromUrl(window.location.href);
    if (!bookId) {
      alert('書籍IDを取得できませんでした。');
      return;
    }

    const currentStatus = this.swipeHistory[bookId];
    
    // Create rating modal
    const modal = document.createElement('div');
    modal.className = 'techbook-rating-modal';
    modal.innerHTML = `
      <div class="rating-overlay"></div>
      <div class="rating-modal-content">
        <button class="rating-close">✕</button>
        <h2>この書籍を評価</h2>
        <div class="current-rating">
          ${currentStatus ? `現在の評価: ${currentStatus === 'like' ? '❤️ いいね' : '❌'}` : '未評価'}
        </div>
        <div class="rating-buttons">
          <button class="rating-button like-btn ${currentStatus === 'like' ? 'active' : ''}">
            ❤️ いいね
          </button>
          <button class="rating-button dislike-btn ${currentStatus === 'dislike' ? 'active' : ''}">
            ❌
          </button>
          ${currentStatus ? '<button class="rating-button remove-btn">🗑️ 評価を削除</button>' : ''}
        </div>
      </div>
    `;

    // Add styles
    const style = document.createElement('style');
    style.textContent = `
      .techbook-rating-modal {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 10000;
      }
      
      .rating-overlay {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
      }
      
      .rating-modal-content {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        padding: 32px;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        min-width: 320px;
        text-align: center;
      }
      
      .rating-close {
        position: absolute;
        top: 16px;
        right: 16px;
        background: none;
        border: none;
        font-size: 20px;
        cursor: pointer;
        color: #666;
      }
      
      .rating-modal-content h2 {
        margin: 0 0 16px 0;
        color: #333;
      }
      
      .current-rating {
        margin-bottom: 24px;
        padding: 12px;
        background: #f8f9fa;
        border-radius: 6px;
        color: #666;
        font-size: 14px;
      }
      
      .rating-buttons {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      
      .rating-button {
        padding: 16px 24px;
        border: 2px solid #ddd;
        border-radius: 8px;
        background: white;
        cursor: pointer;
        font-size: 16px;
        font-weight: 500;
        transition: all 0.2s ease;
      }
      
      .rating-button:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      }
      
      .like-btn {
        border-color: #ff4458;
        color: #ff4458;
      }
      
      .like-btn:hover, .like-btn.active {
        background: #ff4458;
        color: white;
      }
      
      .dislike-btn {
        border-color: #6c757d;
        color: #6c757d;
      }
      
      .dislike-btn:hover, .dislike-btn.active {
        background: #6c757d;
        color: white;
      }
      
      .remove-btn {
        border-color: #dc3545;
        color: #dc3545;
      }
      
      .remove-btn:hover {
        background: #dc3545;
        color: white;
      }
    `;

    document.head.appendChild(style);
    document.body.appendChild(modal);

    // Event listeners
    const closeBtn = modal.querySelector('.rating-close');
    const overlay = modal.querySelector('.rating-overlay');
    const likeBtn = modal.querySelector('.like-btn');
    const dislikeBtn = modal.querySelector('.dislike-btn');
    const removeBtn = modal.querySelector('.remove-btn');

    const closeModal = () => {
      modal.remove();
      style.remove();
      // Refresh rating indicator
      const existingIndicator = document.querySelector('.techbook-rating-indicator');
      if (existingIndicator) {
        existingIndicator.remove();
      }
      this.applyProductPageRating();
    };

    closeBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', closeModal);

    likeBtn.addEventListener('click', async () => {
      await this.updateBookRating(bookId, 'like');
      closeModal();
    });

    dislikeBtn.addEventListener('click', async () => {
      await this.updateBookRating(bookId, 'dislike');
      closeModal();
    });

    if (removeBtn) {
      removeBtn.addEventListener('click', async () => {
        await this.updateBookRating(bookId, null);
        closeModal();
      });
    }
  }

  async updateBookRating(bookId, rating) {
    if (rating === null) {
      // Remove rating
      delete this.swipeHistory[bookId];
      
      // Also remove from liked books data
      const result = await chrome.storage.local.get(['likedBooksData']);
      const likedBooksData = result.likedBooksData || {};
      delete likedBooksData[bookId];
      await chrome.storage.local.set({ likedBooksData });
    } else {
      // Update rating
      this.swipeHistory[bookId] = rating;
      
      if (rating === 'like') {
        // Save book data for liked books
        const bookData = await this.extractCurrentPageBookData();
        if (bookData) {
          const result = await chrome.storage.local.get(['likedBooksData']);
          const likedBooksData = result.likedBooksData || {};
          likedBooksData[bookId] = bookData;
          await chrome.storage.local.set({ likedBooksData });
        }
      } else {
        // Remove from liked books data if changed to dislike
        const result = await chrome.storage.local.get(['likedBooksData']);
        const likedBooksData = result.likedBooksData || {};
        delete likedBooksData[bookId];
        await chrome.storage.local.set({ likedBooksData });
      }
    }

    await this.saveSwipeHistory();
  }

  async extractCurrentPageBookData() {
    try {
      const bookId = this.extractBookIdFromUrl(window.location.href);
      const title = this.extractText(document, [
        'h1',
        'title',
        '.book-title',
        '.product-title',
        '[data-testid="book-title"]',
        'meta[property="og:title"]'
      ]);
      
      const description = this.extractText(document, [
        '.description',
        '.book-description',
        '[data-testid="description"]',
        'meta[property="og:description"]',
        '.summary'
      ]);

      const price = this.extractPrice(document);
      
      const imageUrl = this.extractHighResImage(document);
      
      const author = this.extractText(document, [
        '.author',
        '.circle-name',
        '[data-testid="circle-name"]',
        '.book-author'
      ]);

      const tags = this.extractTags(document);

      return {
        title: title || 'タイトル不明',
        description: description || '',
        price: price || '',
        imageUrl: imageUrl || '',
        url: window.location.href,
        author: author || '',
        tags: tags || []
      };
    } catch (error) {
      console.error('Failed to extract book data:', error);
      return null;
    }
  }

  async handleDirectRating(rating) {
    const bookId = this.extractBookIdFromUrl(window.location.href);
    if (!bookId) {
      alert('書籍IDを取得できませんでした。');
      return;
    }

    await this.updateBookRating(bookId, rating);
    
    // Refresh rating indicator
    const existingIndicator = document.querySelector('.techbook-rating-indicator');
    if (existingIndicator) {
      existingIndicator.remove();
    }
    this.applyProductPageRating();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new TechbookSwipe();
  });
} else {
  new TechbookSwipe();
}