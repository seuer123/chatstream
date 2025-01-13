import jieba
import dashscope
dashscope.api_key = "sk-d6947f9dfbe04c068a6aea1bfe13461c"
text = "介绍一下字节跳动和他的创始人"

seg_list = jieba.cut(text, cut_all=False)
print(" / ".join(seg_list))
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

print(extract_keywords(text))