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
        if (Array.isArray(data)) {
            keywords = data;  // 预定义关键词
        } else if (data && typeof data === 'object') {
            keywords = data.predefinedKeywords || [];  // 预定义关键词
            window.questionKeywords = data.questionKeywords || [];  // 问题关键词
        }
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
        let currentPosition = 0;
        let citationMap = new Map(); // 存储引用标记与其对应的句子
        
        // 处理引用标记 [1]、[2]、[3] 等
        processedText = processedText.replace(/\[(\d+)\]/g, (match, num, offset) => {
            const index = parseInt(num) - 1;
            if (index >= 0 && index < references.length) {
                // 获取引用标记前的最后一个句子结束符的位置
                const textBeforeMatch = processedText.substring(0, offset);
                let sentenceStart = Math.max(
                    textBeforeMatch.lastIndexOf('。'),
                    textBeforeMatch.lastIndexOf('！'),
                    textBeforeMatch.lastIndexOf('？')
                ) + 1;
                if (sentenceStart === 0) sentenceStart = 0;
                
                // 获取引用标记后的第一个句子结束符的位置
                const textAfterMatch = processedText.substring(offset);
                let sentenceEnd = offset + Math.min(
                    textAfterMatch.indexOf('。') !== -1 ? textAfterMatch.indexOf('。') : Infinity,
                    textAfterMatch.indexOf('！') !== -1 ? textAfterMatch.indexOf('！') : Infinity,
                    textAfterMatch.indexOf('？') !== -1 ? textAfterMatch.indexOf('？') : Infinity
                );
                if (sentenceEnd === offset + Infinity) sentenceEnd = processedText.length;
                
                // 提取完整句子
                const sentence = processedText.substring(sentenceStart, sentenceEnd + 1).trim();
                
                // 存储引用标记与句子的对应关系
                const citationId = `citation-${index}-${currentPosition++}`;
                citationMap.set(citationId, sentence);
                
                return `<span class="reference" data-index="${index}" data-citation-id="${citationId}">${match}</span>`;
            }
            return match;
        });
        
        // 将 citationMap 存储在 window 对象中，以便后续使用
        window.citationMap = citationMap;
        
        // 处理预定义关键词高亮（橙色），按照关键词长度降序排序
        const sortedKeywords = [...keywords].sort((a, b) => b.length - a.length);
        
        sortedKeywords.forEach(keyword => {
            if (keyword && keyword.length > 0) {
                const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const regex = new RegExp(escapedKeyword, 'g');
                processedText = processedText.replace(
                    regex,
                    `<span class="highlight-predefined" title="预定义关键词">${keyword}</span>`
                );
            }
        });
        
        // 处理问题中的关键词高亮（黄色）
        const questionKeywords = window.questionKeywords || [];
        const sortedQuestionKeywords = [...questionKeywords].sort((a, b) => b.length - a.length);
        
        sortedQuestionKeywords.forEach(keyword => {
            if (keyword && keyword.length > 0) {
                const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const regex = new RegExp(escapedKeyword, 'g');
                processedText = processedText.replace(
                    regex,
                    `<span class="highlight-question" title="问题关键词">${keyword}</span>`
                );
            }
        });
        
        return processedText;
    }
    
    // 添加引用点击事件处理
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('reference')) {
            const index = parseInt(e.target.getAttribute('data-index'));
            const citationId = e.target.getAttribute('data-citation-id');
            
            if (index >= 0 && index < references.length && citationId && window.citationMap) {
                const referenceContent = document.getElementById('reference-content');
                const currentSentence = window.citationMap.get(citationId);
                
                if (!currentSentence) return;
                
                // 将引用文本分成句子
                const referenceText = references[index].content;
                const sentences = referenceText.split(/([。！？.!?])/);
                const referenceSentences = [];
                
                // 组合完整句子
                for (let i = 0; i < sentences.length - 1; i += 2) {
                    const sentence = sentences[i] + (sentences[i + 1] || '');
                    if (sentence.trim()) {
                        referenceSentences.push(sentence.trim());
                    }
                }
                
                // 显示加载状态
                referenceContent.innerHTML = `
                    <div class="reference-item">
                        <div class="reference-number">引用 ${index + 1}</div>
                    </div>
                `;
                
                // 发送相似度计算请求
                socket.emit('calculate_similarities', {
                    current_text: currentSentence,
                    sentences: referenceSentences
                });
            }
        }
    });
    
    // 添加相似度结果处理
    socket.on('similarity_results', function(data) {
        const referenceContent = document.getElementById('reference-content');
        if (!referenceContent) return;
        
        let highlightedContent = '';
        const results = data.results;
        
        results.forEach(({sentence, similarity, is_most_similar}) => {
            if (is_most_similar) {
                highlightedContent += `<strong title="相似度: ${(similarity * 100).toFixed(1)}%">${sentence}</strong>`;
            } else {
                highlightedContent += sentence;
            }
        });
        
        // 更新引用内容显示
        const referenceNumber = referenceContent.querySelector('.reference-number')?.textContent || '引用';
        referenceContent.innerHTML = `
            <div class="reference-item">
                <div class="reference-number">${referenceNumber}</div>
                <div class="reference-text">${highlightedContent}</div>
            </div>
        `;
    });
});