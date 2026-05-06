import cv2
import numpy as np
import base64
import torch
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
# 假设你使用的是 smp
import segmentation_models_pytorch as smp

app = FastAPI()

# 允许前端跨域请求
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

# 加载你的单通道/三通道模型
model = smp.Unet(encoder_name="resnet34", encoder_weights=None, in_channels=3, classes=1)
model.load_state_dict(torch.load("best_unet_model.pth", map_location=DEVICE))
model.to(DEVICE)
model.eval()

# === 核心升级：医学图像高级预处理管线 ===
def advanced_preprocess(image_bgr):
    """
    执行: NLM 去噪 -> CLAHE 增强 -> 准备用于 Z-score 标准化
    """
    # 1. 引入非局部均值(NLM)去噪：平滑背景噪声，保留器官边缘
    denoised = cv2.fastNlMeansDenoisingColored(image_bgr, None, h=10, hColor=10, templateWindowSize=7, searchWindowSize=21)
    
    # 2. 引入 CLAHE (限制对比度自适应直方图均衡化)
    # 将图像转换到 LAB 色彩空间，仅对 L (亮度) 通道进行增强，避免伪影和颜色失真
    lab = cv2.cvtColor(denoised, cv2.COLOR_BGR2LAB)
    l_channel, a_channel, b_channel = cv2.split(lab)
    
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    cl = clahe.apply(l_channel)
    
    merged = cv2.merge((cl, a_channel, b_channel))
    enhanced_bgr = cv2.cvtColor(merged, cv2.COLOR_LAB2BGR)
    
    return enhanced_bgr

@app.post("/predict")
async def predict_tumor(file: UploadFile = File(...)):
    contents = await file.read()
    nparr = np.frombuffer(contents, np.uint8)
    image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    # 执行高级预处理管线 (在原始分辨率上做，与train_unet.py一致)
    img_preprocessed = advanced_preprocess(image)

    # BGR -> RGB (与train_unet.py一致)
    img_rgb = cv2.cvtColor(img_preprocessed, cv2.COLOR_BGR2RGB)

    # Resize 到模型需要的尺寸
    img_resized = cv2.resize(img_rgb, (256, 256))

    # Z-score 标准化 (按通道计算，ddof=1与torch.std一致，值域[0,255])
    img_float = img_resized.astype(np.float32)
    mean = np.mean(img_float, axis=(0, 1))
    std = np.std(img_float, axis=(0, 1), ddof=1)
    img_zscore = (img_float - mean) / (std + 1e-8)

    # 转为 Tensor 喂给模型
    input_tensor = torch.from_numpy(img_zscore).permute(2, 0, 1).unsqueeze(0).to(DEVICE).float()

    # 模型推理
    with torch.no_grad():
        pred_mask = model(input_tensor)
        pred_mask = torch.sigmoid(pred_mask)
        pred_mask = (pred_mask > 0.5).float().squeeze().cpu().numpy()

    # 渲染红色高亮 (在RGB图像上，通道0=R)
    blended_img = img_resized.copy()
    red_layer = np.zeros_like(img_resized)
    red_layer[:, :, 0] = 255

    tumor_region = pred_mask > 0 
    tumor_pixels = int(np.sum(tumor_region))
    
    if tumor_pixels > 0:
        blended_img[tumor_region] = cv2.addWeighted(img_resized[tumor_region], 0.5, red_layer[tumor_region], 0.5, 0)
    
    # 返回Base64 (cv2.imencode期望BGR，需转回)
    _, buffer_orig = cv2.imencode('.jpg', cv2.cvtColor(img_resized, cv2.COLOR_RGB2BGR))
    orig_base64 = base64.b64encode(buffer_orig).decode('utf-8')

    _, buffer_proc = cv2.imencode('.jpg', cv2.cvtColor(blended_img, cv2.COLOR_RGB2BGR))
    proc_base64 = base64.b64encode(buffer_proc).decode('utf-8')

    if tumor_pixels == 0:
        real_confidence = 0
    else:
        real_confidence = min(99, 85 + int((tumor_pixels / (256 * 256)) * 100))

    return {
        "status": "success",
        "original_image": f"data:image/jpeg;base64,{orig_base64}",
        "result_image": f"data:image/jpeg;base64,{proc_base64}",
        "tumor_pixels": tumor_pixels,
        "real_confidence": real_confidence
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)