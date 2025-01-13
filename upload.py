import weaviate
from sentence_transformers import SentenceTransformer
import os
# 使用相对路径
LOCAL_MODEL_PATH = os.path.join(os.path.dirname(__file__), 'text2vec-base-chinese')
print("正在加载本地模型，请稍候...")
encoder = SentenceTransformer(LOCAL_MODEL_PATH)
print("模型加载完成！")
# 初始化 Weaviate 客户端
client = weaviate.Client(
    url="https://fkhgubqizv2nljs0szw.c0.asia-southeast1.gcp.weaviate.cloud",
    auth_client_secret=weaviate.AuthApiKey(api_key="xSWuSvixMYCEjELdhhM9nRd10SUk7gDcu967")
)

def import_documents(documents):
    batch_size = 100
    with client.batch as batch:
        batch.batch_size = batch_size
        for doc in documents:
            properties = {
                "content": doc["content"],
                "source": doc["source"]
            }
            vector = encoder.encode(doc["content"]).tolist()
            batch.add_data_object(
                data_object=properties,
                class_name="Document",
                vector=vector
            )

def upload_markdown_file(file_path):
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        paragraphs = [p.strip() for p in content.split('\n\n') if p.strip()]
        documents = [
            {
                "content": para,
                "source": file_path
            } for para in paragraphs
        ]
        import_documents(documents)
        print(f"Successfully uploaded {len(documents)} paragraphs from {file_path}")
    except Exception as e:
        print(f"Error uploading file: {e}")

# 上传文件
upload_markdown_file('《自然辩证法》读后感.md')