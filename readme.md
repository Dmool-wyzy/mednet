## 项目简介

MedVision AI 是一套全栈式医疗影像辅助诊断系统。系统采用前后端分离架构，核心算法层搭载基于 PyTorch 框架构建的 U-Net 深度神经网络，实现对脑部 MRI 影像的像素级精准分割。

系统遵循“医生在环（Human-in-the-Loop）”的医疗伦理设计，AI 仅承担初步特征提取与高风险预警，最终裁定权归属执业医师。为保证临床统计数据的严谨性，系统内所有核心指标测算与展示均已作保留整数的精度控制。

## 技术栈架构

**Frontend (前端交互中心):**
- React 18 + Next.js 14
- Tailwind CSS (样式渲染)
- Lucide React (矢量 UI 图标)

**Backend (AI 神经中枢):**
- Python 3.9+
- FastAPI + Uvicorn (高性能接口服务)
- PyTorch + segmentation-models-pytorch (U-Net 模型推理)
- OpenCV (影像预处理与格式桥接)

## 快速启动指南

为了在本地完整运行该项目，您需要分别启动前端界面与后端 AI 服务。

### 1. 后端服务

请确保您的电脑已配置 Python 环境，并推荐使用 Conda 虚拟环境。

```bash
# 1. 激活虚拟环境 (示例)
conda activate mednet

# 2. 安装核心依赖
pip install fastapi uvicorn python-multipart opencv-python torch segmentation-models-pytorch

# 3. 进入项目根目录，启动 FastAPI 服务器
python server.py
```

当看到 *Uvicorn running on http://0.0.0.0:8000* 时，说明后端算力已就位。

### 2. 前端服务

请确保您的电脑已安装Node.js(LTS版本)。

```bash
# 1. 进入前端目录
cd med-front

# 2. 安装前端组件依赖(安装时可能需要以管理员身份打开cmd)
npm install 

# 3. 启动本地开发服务器
npm run dev
```

启动成功后，在浏览器中访问*http://localhost:3000*即可开始体验。

## 注意
**前端页面中仅上传图片，AI分析有完整的流程，其余部分如不同患者记录等只有前端展示，并无详细逻辑**
**模型只进行了基础的训练，U-NET作为专业医学影像模型已经足够强大，若想求精可以再优化一下**