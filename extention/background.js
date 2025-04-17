
chrome.runtime.onInstalled.addListener(() => {
    console.log("Fake News Detector Installed and Running");
});





console.log('Background script initialized');

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'openPopup') {
        chrome.action.openPopup();
    }
});




chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'openAnalysisPopup') {
        console.debug('[FakeZero] Switching popup to post-analysis...');

        // 1. Set post-analysis popup
        chrome.action.setPopup({ popup: 'post-analysis/post-analysis.html' }, () => {
            // 2. Open it
            chrome.action.openPopup(() => {
                console.debug('[FakeZero] Popup opened');

                // 3. Wait briefly, then revert popup back to default
                setTimeout(() => {
                    chrome.action.setPopup({ popup: 'popup/popup.html' });
                    console.debug('[FakeZero] Popup reverted to default');
                }, 3000); // adjust timing if needed
            });
        });
    }
});


