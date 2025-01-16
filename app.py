from flask import Flask, render_template
from flask_socketio import SocketIO, emit
import dashscope
import time
import weaviate
from sentence_transformers import SentenceTransformer
import os

app = Flask(__name__)

socketio = SocketIO(app, 
                   cors_allowed_origins="*",
                   async_mode='threading',
                   ping_timeout=60)

dashscope.api_key = "sk-d6947f9dfbe04c068a6aea1bfe13461c"

@app.route('/')
def index():
    return render_template('index.html')
dashscope.api_key = "sk-d6947f9dfbe04c068a6aea1bfe13461c"
LOCAL_MODEL_PATH = os.path.join(os.path.dirname(__file__), 'text2vec-base-chinese')
print("正在加载本地模型，请稍候...")
encoder = SentenceTransformer(LOCAL_MODEL_PATH)
print("模型加载完成！")

# 初始化 Weaviate 客户端
client = weaviate.Client(
    url="https://fkhgubqizv2nljs0szw.c0.asia-southeast1.gcp.weaviate.cloud",
    auth_client_secret=weaviate.AuthApiKey(api_key="xSWuSvixMYCEjELdhhM9nRd10SUk7gDcu967"),
    startup_period=30,  # 增加启动等待时间
    timeout_config=(5, 60)
)

def create_schema():
    schema = {
        "class": "Document",
        "vectorizer": "text2vec-base-chinese",  # 使用默认的向量化器
        "properties": [
            {
                "name": "content",
                "dataType": ["text"],
                "description": "The content of the document"
            },
            {
                "name": "source",
                "dataType": ["string"],
                "description": "The source or title of the document"
            }
        ]
    }
    
    try:
        client.schema.create_class(schema)
        print("Schema created successfully")
    except Exception as e:
        print(f"Schema might already exist: {e}")

# 调用创建 schema
create_schema()

def search_knowledge_base(query, limit=5):
    try:
        # 使用 encoder 生成查询向量
        query_vector = encoder.encode(query).tolist()
        
        # 在 Weaviate 中搜索相似内容
        result = (
            client.query
            .get("Document", ["content", "source"])
            .with_near_vector({
                "vector": query_vector,
                "certainty": 0.85  # 相似度阈值
            })
            .with_limit(limit)
            .do()
        )
        
        # 提取搜索结果
        if "data" in result and "Get" in result["data"]:
            docs = result["data"]["Get"]["Document"]
            return docs
        return []
    except Exception as e:
        print(f"Search error: {e}")
        return []

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
        # 提取关键词
        keywords = extract_keywords(question)
        emit('keywords', keywords)
        
        # 搜索知识库
        relevant_docs = search_knowledge_base(question)
        
        # 发送参考文档到前端（即使为空）
        emit('references', relevant_docs)
        
        if relevant_docs:  # 如果找到相关文档
            # 构建包含知识库内容的提示词
            context = "\n\n".join([f"参考文档{i+1}：{doc['content']}" 
                                for i, doc in enumerate(relevant_docs)])
            
            prompt = f"""基于以下参考文档回答问题。要求：
                        1. 如果答案中包含参考文档的内容，请用[数字]的格式标注，数字表示是第几个参考文档
                        2. 如果问题无法从参考文档中得到完整答案，可以结合你的知识进行补充
                        3. 答案要准确、内容要丰富

                        参考文档：
                        {context}

                        问题：{question}"""
            response = dashscope.Generation.call(
                model='qwen-turbo',
                prompt=prompt,
                stream=True
            )
        else:  # 如果没有找到相关文档
            response = dashscope.Generation.call(
                model='qwen-turbo',
                prompt=question,
                stream=True
            )
        # 流式输出
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