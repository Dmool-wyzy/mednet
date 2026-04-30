import os
import glob
import cv2
import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader
import segmentation_models_pytorch as smp
from sklearn.model_selection import train_test_split
from tqdm import tqdm

# ==========================================
# 1. 定义数据加载器 (Dataset)
# ==========================================
class BrainMRIDataset(Dataset):
    def __init__(self, image_paths):
        """
        接收已经划分好的原图路径列表
        """
        self.image_paths = image_paths

    def __len__(self):
        return len(self.image_paths)

    def __getitem__(self, idx):
        # 原图路径
        img_path = self.image_paths[idx]
        # 对应的 Mask 路径 (把 .tif 替换为 _mask.tif)
        mask_path = img_path.replace('.tif', '_mask.tif')

        # 读取原图 (转为 RGB)
        image = cv2.imread(img_path)
        image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        
        # 读取 Mask (单通道灰度图)
        mask = cv2.imread(mask_path, cv2.IMREAD_GRAYSCALE)

        # 统一缩放尺寸 (确保显存不会因为尺寸不一报错)
        image = cv2.resize(image, (256, 256))
        mask = cv2.resize(mask, (256, 256), interpolation=cv2.INTER_NEAREST)

        # 归一化 (0~255 -> 0~1)
        image = image.astype(np.float32) / 255.0
        mask = mask.astype(np.float32) / 255.0

        # 维度转换以适配 PyTorch: [H, W, C] -> [C, H, W]
        image = torch.from_numpy(image).permute(2, 0, 1)
        mask = torch.from_numpy(mask).unsqueeze(0) # [1, H, W]

        return image, mask

# ==========================================
# 2. 核心功能：按病例(文件夹)划分数据集
# ==========================================
def get_train_val_loaders(data_root, batch_size=8):
    # 获取所有的病例文件夹路径 (排除非文件夹的文件)
    patient_folders = [f.path for f in os.scandir(data_root) if f.is_dir()]
    
    # 按照 8:2 的比例划分训练集和验证集的病例
    train_folders, val_folders = train_test_split(patient_folders, test_size=0.2, random_state=42)
    
    print(f"总病例数: {len(patient_folders)} | 训练病例: {len(train_folders)} | 验证病例: {len(val_folders)}")

    def get_images_from_folders(folders):
        images = []
        for folder in folders:
            # 找到文件夹下所有 .tif 原图 (排除 _mask.tif)
            files = glob.glob(os.path.join(folder, "*.tif"))
            files = [f for f in files if "_mask" not in f]
            images.extend(files)
        return images

    train_images = get_images_from_folders(train_folders)
    val_images = get_images_from_folders(val_folders)

    print(f"训练图片数: {len(train_images)} | 验证图片数: {len(val_images)}")

    # 创建 Dataset 和 DataLoader
    train_dataset = BrainMRIDataset(train_images)
    val_dataset = BrainMRIDataset(val_images)

    train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True, num_workers=4)
    val_loader = DataLoader(val_dataset, batch_size=batch_size, shuffle=False, num_workers=4)

    return train_loader, val_loader

# ==========================================
# 3. 训练主循环
# ==========================================
def train_model():
    # ---------- 配置区 ----------
    # 【注意！】把这里的路径换成你电脑里 kaggle_3m 文件夹的绝对路径
    DATA_ROOT = r"D:\mednet\archive\kaggle_3m" 
    BATCH_SIZE = 16  # 4070 显卡可以轻松吃下 16 的 Batch Size
    EPOCHS = 20
    LEARNING_RATE = 1e-4
    # ---------------------------

    # 判断是否使用 GPU
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"当前使用的计算设备: {device}")

    # 获取数据
    train_loader, val_loader = get_train_val_loaders(DATA_ROOT, BATCH_SIZE)

    # 初始化 U-Net 模型
    print("正在加载预训练 U-Net 模型...")
    model = smp.Unet(
        encoder_name="resnet34",        # 使用经典的 ResNet34 作为特征提取器
        encoder_weights="imagenet",     # 使用 ImageNet 预训练权重，加速收敛
        in_channels=3,                  # 输入为 RGB 三通道图片
        classes=1,                      # 输出为 1 个通道 (是/否为肿瘤)
    )
    model.to(device)

    # 定义优化器和损失函数 (DiceLoss 处理极度样本不平衡)
    optimizer = torch.optim.Adam(model.parameters(), lr=LEARNING_RATE)
    criterion = smp.losses.DiceLoss(smp.losses.BINARY_MODE, from_logits=True)

    best_val_loss = float('inf')

    # 开始训练迭代
    for epoch in range(EPOCHS):
        print(f"\nEpoch {epoch+1}/{EPOCHS}")
        print("-" * 30)

        # 训练阶段
        model.train()
        train_loss = 0.0
        # tqdm 进度条
        progress_bar = tqdm(train_loader, desc="Training", leave=False)
        for images, masks in progress_bar:
            images, masks = images.to(device), masks.to(device)

            optimizer.zero_grad()
            outputs = model(images)
            loss = criterion(outputs, masks)
            loss.backward()
            optimizer.step()

            train_loss += loss.item()
            progress_bar.set_postfix(loss=loss.item())

        avg_train_loss = train_loss / len(train_loader)

        # 验证阶段
        model.eval()
        val_loss = 0.0
        with torch.no_grad():
            for images, masks in val_loader:
                images, masks = images.to(device), masks.to(device)
                outputs = model(images)
                loss = criterion(outputs, masks)
                val_loss += loss.item()

        avg_val_loss = val_loss / len(val_loader)
        print(f"Train Dice Loss: {avg_train_loss:.4f} | Val Dice Loss: {avg_val_loss:.4f}")

        # 保存最优模型
        if avg_val_loss < best_val_loss:
            best_val_loss = avg_val_loss
            torch.save(model.state_dict(), "best_unet_model.pth")
            print("🚀 发现更好模型，已保存至 'best_unet_model.pth'")

    print("\n🎉 训练全部完成！")

if __name__ == '__main__':
    # 针对 Windows 多线程 DataLoader 的安全机制
    train_model()
