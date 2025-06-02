// Since we now have a popup, the action.onClicked event won't fire
// The popup.js will handle sending messages to content script

// バックグラウンドでタブを開くためのメッセージリスナー
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'openInBackground' && request.url && sender.tab) {
    // 現在のタブの右隣にバックグラウンドで新しいタブを開く
    chrome.tabs.create({
      url: request.url,
      active: false,  // これによりタブはバックグラウンドで開かれる
      index: sender.tab.index + 1  // 現在のタブの右隣に配置
    });
  }
});