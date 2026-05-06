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
import albumentations as A
from albumentations.pytorch import ToTensorV2

# ==========================================
# 1. 定义高级预处理函数 (与 server.py 保持高度一致)
# ==========================================
def apply_medical_preprocessing(image):
    # 1. NLM 去噪
    denoised = cv2.fastNlMeansDenoisingColored(image, None, h=10, hColor=10, templateWindowSize=7, searchWindowSize=21)
    
    # 2. CLAHE 增强
    lab = cv2.cvtColor(denoised, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    cl = clahe.apply(l)
    merged = cv2.merge((cl, a, b))
    enhanced = cv2.cvtColor(merged, cv2.COLOR_LAB2BGR)
    return enhanced

# ==========================================
# 2. 定义数据加载器 (加入数据增强)
# ==========================================
class BrainMRIDataset(Dataset):
    def __init__(self, image_paths, transform=None, is_train=True):
        self.image_paths = image_paths
        self.transform = transform
        self.is_train = is_train

    def __len__(self):
        return len(self.image_paths)

    def __getitem__(self, idx):
        img_path = self.image_paths[idx]
        mask_path = img_path.replace('.tif', '_mask.tif')

        # 读取并执行高级预处理 (预处理在BGR空间进行，与server.py一致)
        image = cv2.imread(img_path)
        image = apply_medical_preprocessing(image)
        image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        
        mask = cv2.imread(mask_path, cv2.IMREAD_GRAYSCALE)
        mask = cv2.resize(mask, (256, 256), interpolation=cv2.INTER_NEAREST)
        image = cv2.resize(image, (256, 256))

        if self.transform:
            augmented = self.transform(image=image, mask=mask)
            image = augmented['image']
            mask = augmented['mask']

        # Z-score 标准化 (按通道计算，与server.py一致)
        image = image.float()
        mean = image.mean(dim=(1, 2), keepdim=True)
        std = image.std(dim=(1, 2), keepdim=True)
        image = (image - mean) / (std + 1e-8)

        mask = (mask > 0).float().unsqueeze(0) # 转换为 0/1 二值 Mask

        return image, mask

# ==========================================
# 3. 数据增强策略
# ==========================================
train_transform = A.Compose([
    A.HorizontalFlip(p=0.5),              # 随机水平翻转
    A.VerticalFlip(p=0.5),                # 随机垂直翻转
    A.RandomRotate90(p=0.5),              # 随机 90 度旋转
    A.ShiftScaleRotate(shift_limit=0.0625, scale_limit=0.1, rotate_limit=15, p=0.5), # 随机缩放位移
    ToTensorV2()
])

val_transform = A.Compose([
    ToTensorV2()
])

# ==========================================
# 4. 训练主循环 (核心逻辑)
# ==========================================
def train_model():
    # ---------- 配置区 ----------
    DATA_ROOT = r"D:\mednet\archive\kaggle_3m" 
    BATCH_SIZE = 16 
    EPOCHS = 30 # 开启数据增强后，建议稍微增加 Epoch 提升上限
    LEARNING_RATE = 1e-4
    # ---------------------------

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    patient_folders = [f.path for f in os.scandir(DATA_ROOT) if f.is_dir()]
    train_folders, val_folders = train_test_split(patient_folders, test_size=0.2, random_state=42)

    def get_images(folders):
        images = []
        for folder in folders:
            files = [f for f in glob.glob(os.path.join(folder, "*.tif")) if "_mask" not in f]
            images.extend(files)
        return images

    train_loader = DataLoader(
        BrainMRIDataset(get_images(train_folders), transform=train_transform, is_train=True),
        batch_size=BATCH_SIZE, shuffle=True, num_workers=0 # Windows下num_workers建议先设0
    )
    val_loader = DataLoader(
        BrainMRIDataset(get_images(val_folders), transform=val_transform, is_train=False),
        batch_size=BATCH_SIZE, shuffle=False, num_workers=0
    )

    model = smp.Unet(encoder_name="resnet34", encoder_weights="imagenet", in_channels=3, classes=1).to(device)
    optimizer = torch.optim.Adam(model.parameters(), lr=LEARNING_RATE)
    criterion = smp.losses.DiceLoss(smp.losses.BINARY_MODE, from_logits=True)

    best_dice = 0.0

    for epoch in range(EPOCHS):
        model.train()
        train_loss = 0.0
        pbar = tqdm(train_loader, desc=f"Epoch {epoch+1}/{EPOCHS}")
        for images, masks in pbar:
            images, masks = images.to(device), masks.to(device)
            optimizer.zero_grad()
            outputs = model(images)
            loss = criterion(outputs, masks)
            loss.backward()
            optimizer.step()
            train_loss += loss.item()
            pbar.set_postfix(loss=loss.item())

        # 验证并保存
        model.eval()
        val_loss = 0.0
        with torch.no_grad():
            for images, masks in val_loader:
                images, masks = images.to(device), masks.to(device)
                outputs = model(images)
                val_loss += criterion(outputs, masks).item()
        
        avg_val_loss = val_loss / len(val_loader)
        current_dice = 1 - avg_val_loss
        print(f"Validation Dice Score: {current_dice:.4f}")

        if current_dice > best_dice:
            best_dice = current_dice
            torch.save(model.state_dict(), "best_unet_model_v2.pth")
            print("🌟 性能突破！保存新权重...")

if __name__ == '__main__':
    train_model()