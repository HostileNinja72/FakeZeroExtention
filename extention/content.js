class FakeNewsDetector {
    constructor() {
        this.observer = null;
        this.extensionEnabled = true;
        this.processedPosts = new WeakSet();
        this.fakeNewsCount = 0; // 🔥 Counter for detected fake news
        this.platformConfig = this.detectPlatform();
        this.initialize();
    }


    async initialize() {
        console.log('Initializing detector...');
        await this.loadExtensionState();
        this.setupObservers();
        this.setupMessageListener();
        if (this.extensionEnabled) {
            this.scanInitialPosts(); // 🔥 Ensures warnings appear when activated
        }
    }

    detectPlatform() {
        const hostname = window.location.hostname;
        const config = {
            selectors: {
                post: '',
                adMarker: '',
                content: ''
            },
            isFacebook: false,
            isInstagram: false,
            isTwitter: false
        };

        if (hostname.includes('facebook.com')) {
            config.selectors = {
                post: 'div[data-ad-comet-preview="message"]',
                adMarker: '[aria-label="Sponsored"]',
                content: 'div.xdj266r'
            };
            config.isFacebook = true;
        } else if (hostname.includes('instagram.com')) {
            config.selectors = {
                post: 'article._aatb',
                adMarker: 'div._aaaw',
                content: 'div._a9zs'
            };
            config.isInstagram = true;
        } else if (hostname.includes('twitter.com') || hostname.includes('x.com')) {
            config.selectors = {
                post: 'article[data-testid="tweet"]',
                adMarker: 'div[data-testid="badge"]',
                content: 'div[data-testid="tweetText"]'
            };
            config.isTwitter = true;
        }

        console.log(`Detected platform: ${config.isFacebook ? 'Facebook' : config.isInstagram ? 'Instagram' : config.isTwitter ? 'Twitter' : 'Unknown'}`);
        return config;
    }

    async loadExtensionState() {
        const { isActive } = await chrome.storage.local.get('isActive');
        this.extensionEnabled = isActive !== false;
        console.log('Extension state loaded:', this.extensionEnabled);
    }

    teardownObservers() {
        if (this.intersectionObserver) {
            this.intersectionObserver.disconnect();
            this.intersectionObserver = null;
        }
        if (this.mutationObserver) {
            this.mutationObserver.disconnect();
            this.mutationObserver = null;
        }
        this.processedPosts = new WeakSet();
        console.log('Observers torn down');
    }

    setupObservers() {
        console.log('Setting up observers...');
        this.intersectionObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && this.extensionEnabled) {
                    console.log('Processing post:', entry.target);
                    this.processPost(entry.target);
                }
            });
        }, { rootMargin: '0px 0px 200px 0px' });

        this.mutationObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                this.handleMutation(mutation);
            });
        });

        this.mutationObserver.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    handleMutation(mutation) {
        if (!this.extensionEnabled) {
            return;
        }

        const posts = this.getPostsFromMutation(mutation);
        if (!posts) {
            console.error('[FakeZero] getPostsFromMutation returned undefined or null');
            return;
        }

        posts.forEach(post => {
            if (!this.processedPosts.has(post)) {
                this.intersectionObserver.observe(post);
            }
        });
    }

    getPostsFromMutation(mutation) {
        const posts = [];
        mutation.addedNodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
                
                if (this.platformConfig.isFacebook) {
                    const fbPost = node.matches(this.platformConfig.selectors.post)
                        ? node
                        : node.querySelector(this.platformConfig.selectors.post);
                    if (fbPost) posts.push(fbPost);
                } else if (this.platformConfig.isInstagram) {
                    const igPost = node.closest(this.platformConfig.selectors.post);
                    if (igPost) posts.push(igPost);
                } else if (this.platformConfig.isTwitter) {
                    const twitterPost = node.closest(this.platformConfig.selectors.post);
                    if (twitterPost) posts.push(twitterPost);
                }
            }
        });
        return posts;
    }

    scanInitialPosts() {
        console.log('Scanning initial posts for warnings...');
        const posts = document.querySelectorAll(this.platformConfig.selectors.post);
        posts.forEach(post => {
            this.processPost(post, true); // 🔥 Force reprocessing and restore warnings
        });
    }


    setupMessageListener() {
        console.log('Setting up message listener...');
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            if (request.type === 'EXTENSION_STATE_UPDATE') {
                this.handleExtensionStateUpdate(request);
            }
        });
    }



    extractFullTextFromPost(postElement) {
        let extractedText = new Set(); 
        let textElements;
        if (this.platformConfig.isTwitter) {

            textElements = postElement.querySelectorAll(this.platformConfig.selectors.content);
        } else {
            
            textElements = postElement.querySelectorAll('*');
        }

        textElements.forEach(element => {
        
            if (element.tagName.toLowerCase() !== 'img' && element.getAttribute('role') !== 'button') {
                const textContent = element.textContent.trim();
                if (textContent && !extractedText.has(textContent)) {
                    extractedText.add(textContent); 
                }
            }
        });

        return Array.from(extractedText).join("\n");
    }

    async processPost(post, force = false) {
        if (!this.extensionEnabled) return;
    
        let content = this.extractFullTextFromPost(post);
        if (!content) return;
    
        console.log('[FakeZero] Extracted post content:\n', content);
    
        // Get stored processed posts and count
        chrome.storage.local.get(['processedPosts', 'fakeNewsCount'], (result) => {
            let processedPosts = result.processedPosts || {}; // Store processed posts as an object
            let fakeNewsCount = result.fakeNewsCount || 0;
    
            // Check if this post has already been counted
            if (!processedPosts[content]) { 
                // If post is new, increase count
                fakeNewsCount += 1;
                processedPosts[content] = true; // Mark post as processed
    
                chrome.storage.local.set({ fakeNewsCount, processedPosts }, () => {
                    console.log(`Updated Fake News Count: ${fakeNewsCount}`);
                });
            } else {
                console.log('This post has already been processed, skipping...');
            }
        });
    
        this.addWarningIcon(post);
        this.processedPosts.add(post);
    }
    

    addWarningIcon(post) {
        try {
            // Prevent duplicate warnings
            if (post.querySelector('.fakezero-warning-container')) {
                console.log('Warning already added to this post, skipping...');
                return; // Exit function if warning exists
            }
    
            // Create warning container
            const warningContainer = document.createElement('div');
            warningContainer.classList.add('fakezero-warning-container');
    
            Object.assign(warningContainer.style, {
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                flexWrap: 'wrap',
                width: '100%',
                padding: '5px 0',
                marginTop: '10px' // 🔥 Ensures separation from text
            });
    
            const warningText = document.createElement('span');
            warningText.classList.add('fakezero-warning-text');
            warningText.textContent = '⚠ Warning: This content may contain false information.';
            Object.assign(warningText.style, {
                color: 'red',
                fontWeight: 'bold',
                backgroundColor: '#ffefef',
                padding: '5px',
                borderRadius: '5px',
                flex: '1'
            });
    
            const icon = document.createElement('div');
            icon.classList.add('fakezero-warning-icon');
    
            Object.assign(icon.style, {
                width: '24px',
                height: '24px',
                backgroundColor: '#FF3B30',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '16px',
                fontWeight: 'bold',
                cursor: 'pointer',
                boxShadow: '0 2px 6px rgba(255, 59, 48, 0.5)',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                zIndex: '10'
            });
    
            icon.innerHTML = '&#9888;';
    
            warningContainer.appendChild(icon);
            warningContainer.appendChild(warningText);
    
            // Insert warning after the post
            post.appendChild(warningContainer);
    
            console.log('Warning icon added below post.');
    
            // Handle click event to open analysis
            icon.addEventListener('click', (event) => {
                event.stopPropagation();
                try {
                    chrome.runtime.sendMessage({ action: 'openAnalysisPopup' });
    
                    // Tiny animation
                    icon.style.transform = 'scale(1.1)';
                    setTimeout(() => {
                        icon.style.transform = 'scale(1)';
                    }, 200);
                } catch (error) {
                    console.error('Error opening extension:', error);
                }
            });
    
        } catch (error) {
            console.error('Error adding warning icon:', error);
        }
    }
    



    handleExtensionStateUpdate(request) {
        console.log('Handling extension state update:', request.isActive);
        this.extensionEnabled = request.isActive;
        if (this.extensionEnabled) {
            console.log('Extension activated, resetting state and re-scanning posts...');
            this.processedPosts = new WeakSet();  // 🔥 Reset processed posts
            this.scanInitialPosts();   // 🔥 Reprocess all posts and restore warnings
        } else {
            console.log('Extension deactivated, removing warnings...');
            this.removeAllWarnings();
        }
    }


    removeAllWarnings() {
        document.querySelectorAll('.fakezero-warning-icon').forEach(icon => icon.remove());
        document.querySelectorAll('.fakezero-warning-container').forEach(container => container.remove());
        console.log('All warning icons removed, text remains.');
    }
    

    async checkFakeNews(content) {
       
    }
}

// 🔥 Listen for storage changes to reactivate automatically
chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.isActive) {
        console.log(`Extension state changed: ${changes.isActive.newValue}`);
        this.handleExtensionStateUpdate({ isActive: changes.isActive.newValue });
    }
});


// Add animation for a glowing effect
const styleSheet = document.createElement("style");
styleSheet.innerHTML = `
    @keyframes pulse-glow {
        0% {
            box-shadow: 0 2px 6px rgba(255, 59, 48, 0.4);
        }
        100% {
            box-shadow: 0 4px 12px rgba(255, 59, 48, 0.7);
        }
    }
`;
document.head.appendChild(styleSheet);

new FakeNewsDetector();
