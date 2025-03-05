
chrome.runtime.onInstalled.addListener(() => {
    console.log("Fake News Detector Installed and Running");
});





console.log('Background script initialized');

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'openPopup') {
        chrome.action.openPopup();
    }
});

