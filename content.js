console.log("Fake News Detector is running...");


function extractPosts() {
    let posts = document.querySelectorAll('div[data-ad-comet-preview="message"]');
    posts.forEach(post => {
        let textContent = post.innerText || post.textContent;
        if (textContent.length > 20) {
            checkFakeNews(textContent, post);
        }
    });
}


function checkFakeNews(text, postElement) {
}



setInterval(extractPosts, 3000);
