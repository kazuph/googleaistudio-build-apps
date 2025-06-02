class TechbookPreview {
  constructor() {
    this.popup = null;
    this.currentHoveredElement = null;
    this.hideTimeout = null;
    this.cache = new Map();
    this.isOverBook = false;
    this.isOverPopup = false;
    this.init();
  }

  init() {
    this.createPopup();
    this.attachEventListeners();
  }

  createPopup() {
    this.popup = document.createElement('div');
    this.popup.className = 'techbook-preview-popup';
    document.body.appendChild(this.popup);
  }

  attachEventListeners() {
    // 技術書典の本詳細ページ (/product/) へのリンクを検出
    const bookSelector = 'a[href*="/product/"]';

    // mouseenterとmouseleaveを使用（バブリングしない）
    document.addEventListener('mouseenter', (e) => {
      // e.targetがElementであることを確認
      if (!e.target || typeof e.target.closest !== 'function') return;
      
      const bookLink = e.target.closest(bookSelector);
      if (bookLink && this.isBookLink(bookLink)) {
        this.isOverBook = true;
        this.handleMouseEnter(bookLink, e);
      }
    }, true);

    document.addEventListener('mouseleave', (e) => {
      // e.targetがElementであることを確認
      if (!e.target || typeof e.target.closest !== 'function') return;
      
      const bookLink = e.target.closest(bookSelector);
      if (bookLink && this.currentHoveredElement === bookLink) {
        this.isOverBook = false;
        this.checkAndHide();
      }
    }, true);

    // プレビューポップアップ専用のイベントリスナーを追加
    this.setupPopupEventListeners();
  }

  setupPopupEventListeners() {
    // ポップアップが作成された後に直接イベントリスナーを追加
    this.popup.addEventListener('mouseenter', () => {
      this.isOverPopup = true;
      this.clearHideTimeout();
    });

    this.popup.addEventListener('mouseleave', () => {
      this.isOverPopup = false;
      this.checkAndHide();
    });
  }

  checkAndHide() {
    this.clearHideTimeout();
    this.hideTimeout = setTimeout(() => {
      if (!this.isOverBook && !this.isOverPopup) {
        this.hidePopup();
      }
    }, 300);
  }

  clearHideTimeout() {
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
      this.hideTimeout = null;
    }
  }

  scheduleHide() {
    // checkAndHideに統合されたため、この関数は不要になりましたが、
    // 互換性のために残しておきます
    this.checkAndHide();
  }

  isBookLink(element) {
    const href = element.getAttribute('href');
    if (!href) return false;
    
    // 技術書典の本詳細ページのURLパターンを判定 (/product/ を含む)
    return href.includes('/product/');
  }

  handleMouseEnter(element, event) {
    this.clearHideTimeout();
    this.currentHoveredElement = element;
    
    // ポップアップの位置を設定（書籍カードに隣接させる）
    this.positionPopupNearElement(element);
    
    // 詳細情報を取得して表示
    this.loadBookDetails(element);
  }

  positionPopupNearElement(element) {
    const elementRect = element.getBoundingClientRect();
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const popupWidth = 380; // max-width from CSS
    const maxPopupHeight = 400; // max-height from CSS
    
    // 要素の絶対位置（スクロールを考慮）
    const elementAbsoluteLeft = elementRect.left + scrollLeft;
    const elementAbsoluteTop = elementRect.top + scrollTop;
    const elementAbsoluteRight = elementRect.right + scrollLeft;
    const elementAbsoluteBottom = elementRect.bottom + scrollTop;
    
    let left, top, availableHeight;
    
    // デフォルトは要素の右側に表示（隙間を縮小）
    left = elementAbsoluteRight + 2;
    top = elementAbsoluteTop;
    
    // ビューポート内での利用可能な高さを計算
    const viewportTop = scrollTop;
    const viewportBottom = scrollTop + viewportHeight;
    availableHeight = viewportBottom - Math.max(elementAbsoluteTop, viewportTop) - 16;
    
    // 右側に表示しきれない場合は左側に
    if (left + popupWidth > scrollLeft + viewportWidth - 16) {
      left = elementAbsoluteLeft - popupWidth - 2;
    }
    
    // 左側にも表示しきれない場合は要素の下に
    if (left < scrollLeft + 16) {
      left = elementAbsoluteLeft;
      top = elementAbsoluteBottom + 2;
      availableHeight = viewportBottom - Math.max(elementAbsoluteBottom + 2, viewportTop) - 16;
    }
    
    // 下に十分なスペースがない場合は要素の上に
    if (availableHeight < 200) {
      top = Math.max(viewportTop + 16, elementAbsoluteTop - maxPopupHeight - 2);
      availableHeight = Math.min(elementAbsoluteTop, viewportBottom) - Math.max(top, viewportTop) - 16;
    }
    
    // 最終的に画面内に収まるよう調整
    left = Math.max(scrollLeft + 16, Math.min(left, scrollLeft + viewportWidth - popupWidth - 16));
    top = Math.max(viewportTop + 16, Math.min(top, viewportBottom - 200)); // 最低200pxは確保
    
    // 利用可能な高さに基づいてポップアップの最大高さを動的に設定
    const finalHeight = Math.min(maxPopupHeight, Math.max(200, availableHeight));
    
    // 位置に応じてクラスを追加（CSSの橋の向きを制御）
    this.popup.classList.remove('popup-right', 'popup-left', 'popup-bottom', 'popup-top');
    
    if (left > elementAbsoluteRight) {
      this.popup.classList.add('popup-right');
    } else if (left < elementAbsoluteLeft) {
      this.popup.classList.add('popup-left');
    } else if (top > elementAbsoluteBottom) {
      this.popup.classList.add('popup-bottom');
    } else {
      this.popup.classList.add('popup-top');
    }
    
    this.popup.style.left = `${left}px`;
    this.popup.style.top = `${top}px`;
    this.popup.style.maxHeight = `${finalHeight}px`;
    
    // コンテンツエリアの高さも調整
    const contentElement = this.popup.querySelector('.techbook-preview-popup-content');
    if (contentElement) {
      contentElement.style.maxHeight = `${finalHeight - 4}px`; // border分を引く
    }
  }

  async loadBookDetails(element) {
    const href = element.getAttribute('href');
    if (!href) return;
    
    const fullUrl = href.startsWith('http') ? href : `${window.location.origin}${href}`;
    
    // キャッシュをチェック
    if (this.cache.has(fullUrl)) {
      this.showPopup(this.cache.get(fullUrl));
      return;
    }
    
    // ローディング表示
    this.popup.innerHTML = '<div class="techbook-preview-popup-content"><div class="loading">読み込み中...</div></div>';
    this.popup.classList.add('show');
    
    try {
      const response = await fetch(fullUrl);
      if (!response.ok) throw new Error('Failed to fetch');
      
      const html = await response.text();
      const bookData = this.parseBookData(html, element);
      
      // キャッシュに保存
      this.cache.set(fullUrl, bookData);
      
      // 現在もホバー中の場合のみ表示
      if (this.currentHoveredElement === element) {
        this.showPopup(bookData);
      }
    } catch (error) {
      console.error('Failed to load book details:', error);
      if (this.currentHoveredElement === element) {
        this.popup.innerHTML = '<div class="techbook-preview-popup-content"><div class="error">詳細情報を取得できませんでした</div></div>';
      }
    }
  }

  parseBookData(html, linkElement) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    // 一般的な要素から情報を抽出（実際のサイト構造に応じて調整が必要）
    const title = this.extractText(doc, [
      'h1',
      '.book-title',
      '[data-testid="book-title"]',
      'meta[property="og:title"]'
    ]) || this.extractTextFromLink(linkElement);
    
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
    
    const price = this.extractText(doc, [
      '.price',
      '.book-price',
      '[data-testid="price"]'
    ]);
    
    const tags = this.extractTags(doc);
    
    return {
      title,
      author,
      description,
      price,
      tags
    };
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

  extractTextFromLink(linkElement) {
    // リンク要素自体から本のタイトルを推測
    const img = linkElement.querySelector('img');
    if (img?.alt) return img.alt;
    
    const textContent = linkElement.textContent?.trim();
    if (textContent) return textContent;
    
    return null;
  }

  extractTags(doc) {
    const tagSelectors = [
      '.tag',
      '.tags .tag',
      '.category',
      '.genre'
    ];
    
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

  showPopup(bookData) {
    const content = `
      ${bookData.title ? `<h3>${this.escapeHtml(bookData.title)}</h3>` : ''}
      ${bookData.author ? `<div class="author">著者: ${this.escapeHtml(bookData.author)}</div>` : ''}
      ${bookData.price ? `<div class="price">${this.escapeHtml(bookData.price)}</div>` : ''}
      ${bookData.description ? `<div class="description">${this.parseMarkdown(bookData.description)}</div>` : ''}
      ${bookData.tags.length > 0 ? `
        <div class="tags">
          ${bookData.tags.map(tag => `<span class="tag">${this.escapeHtml(tag)}</span>`).join('')}
        </div>
      ` : ''}
    `;
    
    this.popup.innerHTML = `<div class="techbook-preview-popup-content">${content}</div>`;
    this.popup.classList.add('show');
  }

  hidePopup() {
    this.popup.classList.remove('show');
    this.currentHoveredElement = null;
    this.isOverBook = false;
    this.isOverPopup = false;
    this.clearHideTimeout();
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  parseMarkdown(text) {
    if (!text) return '';
    
    // HTMLエスケープ
    let html = this.escapeHtml(text);
    
    // 改行を保持
    html = html.replace(/\n/g, '<br>');
    
    // 基本的なマークダウン記法を解釈
    // 太字 **text** または __text__
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>');
    
    // イタリック *text* または _text_
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    html = html.replace(/(?<!_)_([^_]+)_(?!_)/g, '<em>$1</em>');
    
    // インラインコード `code`
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    
    // リンク [text](url)
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    
    // 見出し（行頭のみ）
    html = html.replace(/^(#{1,6})\s+(.+)$/gm, (match, hashes, content) => {
      const level = hashes.length;
      return `<h${level + 3}>${content}</h${level + 3}>`;
    });
    
    // リスト項目
    html = html.replace(/^[*+-]\s+(.+)$/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
    
    // 番号付きリスト
    html = html.replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>)(?!.*<ul>)/s, '<ol>$1</ol>');
    
    return html;
  }
}

// DOMが読み込まれたら初期化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new TechbookPreview();
  });
} else {
  new TechbookPreview();
}