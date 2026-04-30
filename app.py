import gradio as gr
import cv2
import torch
import numpy as np
import segmentation_models_pytorch as smp

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# 加载模型
model = smp.Unet(encoder_name="resnet34", encoder_weights=None, in_channels=3, classes=1)
model.load_state_dict(torch.load("best_unet_model.pth", map_location=DEVICE))
model.to(DEVICE)
model.eval()

# 升级版推理函数：加入了阈值控制和透明度控制
def predict_tumor(image, threshold, alpha):
    if image is None:
        return None, "请先上传图片"
        
    img_resized = cv2.resize(image, (256, 256))
    input_tensor = img_resized.astype(np.float32) / 255.0
    input_tensor = torch.from_numpy(input_tensor).permute(2, 0, 1).unsqueeze(0).to(DEVICE)

    with torch.no_grad():
        pred_mask = model(input_tensor)
        pred_mask = torch.sigmoid(pred_mask)
        # 根据用户拖动的滑块来决定判定阈值
        pred_mask = (pred_mask > threshold).float() 
        pred_mask = pred_mask.squeeze().cpu().numpy()

    # 计算肿瘤面积 (简单统计像素点)
    tumor_pixels = np.sum(pred_mask)
    area_ratio = (tumor_pixels / (256 * 256)) * 100
    info_text = f"**诊断信息：**\n- 发现疑似病灶\n- 肿瘤相对面积占比：{area_ratio:.2f}%\n- 当前敏感度阈值：{threshold}" if tumor_pixels > 0 else "**诊断信息：**\n- 未见明显异常病灶"

    blended_img = img_resized.copy()
    red_layer = np.zeros_like(img_resized)
    red_layer[:, :, 0] = 255 

    tumor_region = pred_mask > 0 
    
    # 根据用户拖动的滑块决定红色遮罩的透明度
    blended_img[tumor_region] = cv2.addWeighted(
        img_resized[tumor_region], 1 - alpha, 
        red_layer[tumor_region], alpha, 0
    )

    return blended_img, info_text

# 搭建升级版 UI
with gr.Blocks(theme=gr.themes.Soft()) as interface: # 换用更现代的 Soft 主题
    gr.Markdown("# 🧠 跨学科视觉智能特遣队 - 脑肿瘤精准筛查工作站")
    
    with gr.Row():
        with gr.Column(scale=1):
            input_img = gr.Image(type="numpy", label="上传原图")
            # 增加两个交互滑块
            threshold_slider = gr.Slider(minimum=0.1, maximum=0.9, value=0.5, step=0.1, label="AI 判定敏感度 (阈值)")
            alpha_slider = gr.Slider(minimum=0.1, maximum=1.0, value=0.5, step=0.1, label="高亮不透明度")
            submit_btn = gr.Button("开始 AI 分析", variant="primary")
            
        with gr.Column(scale=1):
            output_img = gr.Image(type="numpy", label="AI 融合渲染结果")
            output_text = gr.Markdown("等待分析...")

    # 绑定点击事件
    submit_btn.click(
        fn=predict_tumor, 
        inputs=[input_img, threshold_slider, alpha_slider], 
        outputs=[output_img, output_text]
    )

if __name__ == "__main__":
    interface.launch(share=False)