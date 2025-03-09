
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
     
        chrome.action.setPopup({ popup: 'post-analysis/post-analysis.html' }, () => {
          
            chrome.action.openPopup(() => {
               
                chrome.action.setPopup({ popup: 'popup/popup.html' });
            });
        });
    }
});

