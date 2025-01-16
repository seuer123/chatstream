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
        
        // 处理引用标记
        processedText = processedText.replace(/\[(\d+)\]/g, (match, num) => {
            const index = parseInt(num) - 1;
            if (index >= 0 && index < references.length) {
                return `<span class="reference" data-index="${index}">${match}</span>`;
            }
            return match;
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
    
    // 添加引用点击事件处理
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('reference')) {
            const index = parseInt(e.target.getAttribute('data-index'));
            if (index >= 0 && index < references.length) {
                const referenceContent = document.getElementById('reference-content');
                referenceContent.innerHTML = `
                    <div class="reference-item">
                        <div class="reference-number">引用 ${index + 1}</div>
                        <div class="reference-text">${references[index].content}</div>
                    </div>
                `;
            }
        }
    });
});