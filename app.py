from flask import Flask, render_template
from flask_socketio import SocketIO, emit
import dashscope
import time

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your-secret-key'
socketio = SocketIO(app, 
                   cors_allowed_origins="*",
                   async_mode='threading',
                   ping_timeout=60)

dashscope.api_key = "sk-d6947f9dfbe04c068a6aea1bfe13461c"

@app.route('/')
def index():
    return render_template('index.html')

def extract_keywords(text):
    prompt = f"""请从以下文本中提取关键词，严格要求：
1. 必须是原文中完整出现的词语或短语
2. 关键词之间用英文逗号分隔
3. 不要添加任何其他字符或解释
4. 优先提取：人名、地名、专有名词、重要短语
5. 返回3-5个关键词
6. 不能返回为空

文本：{text}"""
    response = dashscope.Generation.call(
        model='qwen-turbo',
        prompt=prompt,
        result_format='text'
    )
    
    if response.status_code == 200:
        # 分割关键词并清理
        keywords = [word.strip() for word in response.output.text.split(',') if word.strip()]
        # 确保关键词在原文中存在，使用更宽松的匹配
        filtered_keywords = []
        for k in keywords:
            # 检查关键词是否是其他关键词的一部分
            if not any(k != other and k in other for other in keywords):
                if k in text:
                    filtered_keywords.append(k)
        return filtered_keywords[:5]
    return []

@socketio.on('message')
def handle_message(question):
    try:
        keywords = extract_keywords(question)
        emit('keywords', keywords)
        
        response = dashscope.Generation.call(
            model='qwen-turbo',
            prompt=question,
            stream=True
        )
        last_text = ""
        for chunk in response:
            if chunk.status_code == 200:
                current_text = chunk.output.text
                new_text = current_text[len(last_text):]
                if new_text:
                    for char in new_text:
                        socketio.emit('content', char)
                        time.sleep(0.02)
                last_text = current_text    
    except Exception as e:
        socketio.emit('error', str(e))

if __name__ == '__main__':
    socketio.run(app, debug=True, allow_unsafe_werkzeug=True) 