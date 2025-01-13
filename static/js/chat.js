document.addEventListener('DOMContentLoaded', function() {
    const socket = io();
    const messagesDiv = document.getElementById('messages');
    const chatForm = document.getElementById('chat-form');
    const userInput = document.getElementById('user-input');
    let keywords = [];
    let currentResponse = '';
    let references = [];  // 存储参考文档
    
    socket.on('connect', function() {
        console.log('Connected to server');
    });
    
    socket.on('keywords', function(data) {
        keywords = data;
    });
    
    socket.on('references', function(data) {
        references = data;
        // 显示检索结果
        const chunksDiv = document.getElementById('chunks');
        chunksDiv.innerHTML = '';
        
        data.forEach((doc, index) => {
            const chunkDiv = document.createElement('div');
            chunkDiv.className = 'chunk';
            chunkDiv.innerHTML = `
                <div class="chunk-number">参考文档 ${index + 1}</div>
                <div class="chunk-content">${doc.content}</div>
            `;
            chunksDiv.appendChild(chunkDiv);
        });
    });
    
    socket.on('content', function(char) {
        const lastMessage = messagesDiv.lastElementChild;
        if (lastMessage && lastMessage.classList.contains('assistant')) {
            currentResponse += char;
            lastMessage.innerHTML = processResponse(currentResponse);
        } else {
            currentResponse = char;
            addMessage('assistant', char);
        }
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    });
    
    socket.on('error', function(data) {
        console.error('Error:', data);
        addMessage('assistant', '发生错误: ' + data);
    });
    
    chatForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const message = userInput.value.trim();
        if (!message) return;
        
        addMessage('user', message);
        socket.emit('message', message);
        
        userInput.value = '';
        userInput.focus();
    });
    
    function addMessage(role, content) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${role}`;
        messageDiv.innerHTML = role === 'assistant' ? processResponse(content) : content;
        messagesDiv.appendChild(messageDiv);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }
    
    function processResponse(text) {
        // 先获取所有参考文档的内容
        const docContents = references.map(doc => doc.content);
        
        // 处理文本，查找与参考文档匹配的内容
        let processedText = text;
        docContents.forEach((docContent, index) => {
            // 将文档内容分成句子，保留分隔符
            const sentences = docContent.split(/([。！？.!?])/);
            
            // 每两个元素组合成一个完整的句子（包含标点符号）
            for(let i = 0; i < sentences.length - 1; i += 2) {
                const sentence = sentences[i] + (sentences[i + 1] || '');
                if (sentence.trim()) {
                    // 转义正则表达式中的特殊字符
                    const escapedSentence = sentence.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    const regex = new RegExp(escapedSentence, 'g');
                    
                    if (processedText.includes(sentence.trim())) {
                        processedText = processedText.replace(
                            regex,
                            (match) => `<span class="reference" data-reference="${docContent}">${match}<sup>[${index + 1}]</sup></span>`
                        );
                    }
                }
            }
        });
        
        // 处理关键词高亮
        keywords.forEach(keyword => {
            if (keyword && keyword.length > 0) {
                const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const regex = new RegExp(escapedKeyword, 'g');
                processedText = processedText.replace(
                    regex, 
                    `<span class="highlight">${keyword}</span>`
                );
            }
        });
        
        return processedText;
    }
}); 