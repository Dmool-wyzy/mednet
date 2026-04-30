import os
import cv2
import torch
import numpy as np
import matplotlib.pyplot as plt
import segmentation_models_pytorch as smp

# 1. 基础配置
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
MODEL_PATH = "best_unet_model.pth"

# 【注意】这里填一张你验证集里带肿瘤的 .tif 图片的绝对路径
# 最好去文件夹里挑一张确认有白色肿瘤斑块的图片来测试效果最明显
TEST_IMG_PATH = r"D:\mednet\archive\kaggle_3m\TCGA_CS_4942_19970222\TCGA_CS_4942_19970222_10.tif"
TEST_MASK_PATH = TEST_IMG_PATH.replace('.tif', '_mask.tif')

# 2. 加载你训练好的模型
print("正在唤醒 AI 大脑...")
model = smp.Unet(
    encoder_name="resnet34",
    encoder_weights=None, # 推理时不需要下载预训练权重了
    in_channels=3,
    classes=1,
)
model.load_state_dict(torch.load(MODEL_PATH, map_location=DEVICE))
model.to(DEVICE)
model.eval() # 开启评估模式！极其重要！

# 3. 读取并处理单张测试图片
image = cv2.imread(TEST_IMG_PATH)
image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
image_resized = cv2.resize(image_rgb, (256, 256))

# 图像预处理 (与训练时保持绝对一致)
input_tensor = image_resized.astype(np.float32) / 255.0
input_tensor = torch.from_numpy(input_tensor).permute(2, 0, 1).unsqueeze(0).to(DEVICE)

# 4. 让模型进行预测
with torch.no_grad():
    # 模型输出的是 logits，需要用 sigmoid 转换成 0~1 的概率值
    pred_mask = model(input_tensor)
    pred_mask = torch.sigmoid(pred_mask)
    
    # 设定阈值，概率大于 0.5 的地方认为是肿瘤 (白色)
    pred_mask = (pred_mask > 0.5).float()
    
    # 转回 numpy 格式用于画图
    pred_mask = pred_mask.squeeze().cpu().numpy()

# 5. 读取真实的医生标注 (Ground Truth)
true_mask = cv2.imread(TEST_MASK_PATH, cv2.IMREAD_GRAYSCALE)
true_mask = cv2.resize(true_mask, (256, 256), interpolation=cv2.INTER_NEAREST)

# 6. 画图展示 (截取这张图放进你的路演 PPT)
plt.figure(figsize=(15, 5))

plt.subplot(1, 3, 1)
plt.title("Original MRI", fontsize=16)
plt.imshow(image_resized)
plt.axis('off')

plt.subplot(1, 3, 2)
plt.title("Doctor Ground Truth", fontsize=16)
plt.imshow(true_mask, cmap='gray')
plt.axis('off')

plt.subplot(1, 3, 3)
plt.title("AI Prediction", fontsize=16)
plt.imshow(pred_mask, cmap='magma') # 用 magma 热力图颜色显得更高级
plt.axis('off')

plt.tight_layout()
plt.show()