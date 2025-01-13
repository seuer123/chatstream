document.addEventListener('DOMContentLoaded', function() {
    const socket = io();
    const messagesDiv = document.getElementById('messages');
    const chatForm = document.getElementById('chat-form');
    const userInput = document.getElementById('user-input');
    let keywords = [];
    let currentResponse = '';
    let contexts = [];  // 存储上下文信息
    
    socket.on('connect', function() {
        console.log('Connected to server');
    });
    
    socket.on('keywords', function(data) {
        keywords = data;
    });
    
    socket.on('contexts', function(data) {
        contexts = data;
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
        // 先处理引用
        let processedText = text.replace(/【(.*?)】\^(\d+)/g, (match, content, index) => {
            const contextIndex = parseInt(index) - 1;
            const tooltip = contexts[contextIndex] ? contexts[contextIndex].text : '未找到原文';
            return `<span class="reference" title="${tooltip}">【${content}】</span>`;
        });
        
        // 再处理关键词高亮
        keywords.forEach(keyword => {
            if (keyword && keyword.length > 0) {
                let parts = processedText.split(keyword);
                processedText = parts.join(`<span class="highlight">${keyword}</span>`);
            }
        });
        
        return processedText;
    }
}); 