import React, { useState, useEffect, useCallback } from 'react';
import { modelApi } from '../../../api';
import TopNotice from '../../../components/common/TopNotice';
import './ModelComparison.css';

const ModelComparison = () => {
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingModel, setEditingModel] = useState(null);
  const [editParams, setEditParams] = useState({
    conf: 0.5,
    iou: 0.45,
    max_det: 5,
    top_k: 5
  });

  const [notice, setNotice] = useState({
    visible: false,
    message: '',
    type: 'info'
  });

  const showNotice = (message, type = 'info') => {
    setNotice({
      visible: true,
      message,
      type
    });
  };

  const closeNotice = useCallback(() => {
    setNotice({
      visible: false,
      message: '',
      type: 'info'
    });
  }, []);

  const loadModels = async () => {
    setLoading(true);

    try {
      const response = await modelApi.getModels();
      console.log('模型列表原始数据:', response);

      if (response.code === 0 && response.data) {
        let modelList = [];

        if (Array.isArray(response.data)) {
          modelList = response.data;
        } else if (response.data.items) {
          modelList = response.data.items;
        } else {
          modelList = Object.keys(response.data).map((key) => ({
            model_id: key,
            ...response.data[key],
            id: key,
            name: key,
            enabled: response.data[key].enabled ?? true
          }));
        }

        setModels(modelList);
        console.log('处理后的模型列表:', modelList);
      } else {
        showNotice('加载模型失败', 'error');
      }
    } catch (error) {
      console.error('加载模型失败:', error);
      showNotice('加载模型失败：AI端服务器未联通', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadModels();
  }, []);

  const handleToggleStatus = async (model) => {
    try {
      let response;

      if (model.enabled) {
        response = await modelApi.disableModel(model.model_id);
      } else {
        response = await modelApi.enableModel(model.model_id);
      }

      if (response.code === 0) {
        showNotice(`${model.name || model.model_id} ${model.enabled ? '已禁用' : '已启用'}`, 'success');
        loadModels();
      } else {
        showNotice('操作失败：' + (response?.message || '未知错误'), 'error');
      }
    } catch (error) {
      showNotice('操作失败：' + (error?.message || '未知错误'), 'error');
    }
  };

  const handleEditParams = (model) => {
    setEditingModel(model);
    setEditParams({
      conf: model.params?.conf ?? 0.5,
      iou: model.params?.iou ?? 0.45,
      max_det: model.params?.max_det ?? 5,
      top_k: model.params?.top_k ?? 5
    });
  };

  // ========== 关键修改：参数名转换 ==========
  const handleSaveParams = async () => {
    if (!editingModel) return;

    try {
      // 将参数名转换为后端接口要求的格式
      // max_det -> maxDet, top_k -> topK
      const paramsForBackend = {
        conf: editParams.conf,
        iou: editParams.iou,
        maxDet: editParams.max_det,
        topK: editParams.top_k
      };
      
      const response = await modelApi.updateParams(editingModel.model_id, paramsForBackend);

      if (response.code === 0) {
        showNotice('参数更新成功', 'success');
        setEditingModel(null);
        loadModels();
      } else {
        showNotice('更新失败：' + (response?.message || '未知错误'), 'error');
      }
    } catch (error) {
      showNotice('更新失败：' + (error?.message || '未知错误'), 'error');
    }
  };

  const validateParam = (name, value) => {
    switch (name) {
      case 'conf':
        return Math.max(0, Math.min(1, value));
      case 'iou':
        return Math.max(0, Math.min(1, value));
      case 'max_det':
        return Math.max(1, Math.min(10, value));
      case 'top_k':
        return Math.max(1, Math.min(10, value));
      default:
        return value;
    }
  };

  const handleParamChange = (name, value) => {
    const numValue = parseFloat(value);
    const validValue = validateParam(name, Number.isNaN(numValue) ? 0 : numValue);

    setEditParams((prev) => ({
      ...prev,
      [name]: validValue
    }));
  };

  const getStatusBadge = (enabled) => {
    if (enabled) {
      return <span className="model-status-badge model-status-enabled">已启用</span>;
    }

    return <span className="model-status-badge model-status-disabled">已禁用</span>;
  };

  return (
    <div className="model-management-container">
      <TopNotice
        visible={notice.visible}
        message={notice.message}
        type={notice.type}
        onClose={closeNotice}
      />

      <div className="model-header">
        <h3>🤖 模型配置管理</h3>

        <button type="button" className="model-refresh-btn" onClick={loadModels}>
          🔄 刷新
        </button>
      </div>

      {loading ? (
        <div className="model-loading">加载中...</div>
      ) : models.length === 0 ? (
        <div className="model-empty">暂无模型数据</div>
      ) : (
        <div className="models-grid">
          {models.map((model) => (
            <div key={model.model_id} className="model-card">
              <div className="model-card-header">
                <div className="model-title">
                  <span className="model-icon">🤖</span>
                  <span className="model-name">{model.name || model.model_id}</span>
                </div>

                {getStatusBadge(model.enabled)}
              </div>

              <div className="model-info">
                <div className="model-info-row">
                  <span className="model-info-label">模型ID：</span>
                  <span className="model-info-value">{model.model_id}</span>
                </div>
              </div>

              <div className="model-params">
                <div className="model-params-title">当前参数</div>

                <div className="model-params-grid">
                  <div className="model-param-item">
                    <span className="model-param-label">置信度阈值</span>
                    <span className="model-param-value">{(model.params?.conf ?? 0.5).toFixed(2)}</span>
                  </div>

                  <div className="model-param-item">
                    <span className="model-param-label">IoU阈值</span>
                    <span className="model-param-value">{(model.params?.iou ?? 0.45).toFixed(2)}</span>
                  </div>

                  <div className="model-param-item">
                    <span className="model-param-label">最大检测框</span>
                    <span className="model-param-value">{model.params?.max_det ?? 5}</span>
                  </div>

                  <div className="model-param-item">
                    <span className="model-param-label">返回结果数</span>
                    <span className="model-param-value">{model.params?.top_k ?? 5}</span>
                  </div>
                </div>
              </div>

              <div className="model-actions">
                <button
                  type="button"
                  className="model-action-btn model-edit-btn"
                  onClick={() => handleEditParams(model)}
                >
                  ✏️ 编辑参数
                </button>

                <button
                  type="button"
                  className={`model-action-btn ${model.enabled ? 'model-disable-btn' : 'model-enable-btn'}`}
                  onClick={() => handleToggleStatus(model)}
                >
                  {model.enabled ? '🔴 禁用' : '🟢 启用'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editingModel && (
        <div className="model-modal-overlay" onClick={() => setEditingModel(null)}>
          <div className="model-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="model-modal-header">
              <h3>编辑参数 - {editingModel.name || editingModel.model_id}</h3>

              <button
                type="button"
                className="model-modal-close-btn"
                onClick={() => setEditingModel(null)}
              >
                ✕
              </button>
            </div>

            <div className="model-modal-body">
              <div className="model-param-edit-group">
                <label>置信度阈值 (conf)</label>

                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={editParams.conf}
                  onChange={(e) => handleParamChange('conf', e.target.value)}
                />

                <span className="model-param-value-display">{editParams.conf.toFixed(2)}</span>

                <div className="model-param-hint">范围: 0 ~ 1，越高检测越严格</div>
              </div>

              <div className="model-param-edit-group">
                <label>IoU 阈值 (iou)</label>

                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={editParams.iou}
                  onChange={(e) => handleParamChange('iou', e.target.value)}
                />

                <span className="model-param-value-display">{editParams.iou.toFixed(2)}</span>

                <div className="model-param-hint">范围: 0 ~ 1，用于去除重叠框</div>
              </div>

              <div className="model-param-edit-group">
                <label>最大检测框数 (max_det)</label>

                <input
                  type="range"
                  min="1"
                  max="10"
                  step="1"
                  value={editParams.max_det}
                  onChange={(e) => handleParamChange('max_det', e.target.value)}
                />

                <span className="model-param-value-display">{editParams.max_det}</span>

                <div className="model-param-hint">范围: 1 ~ 10，模型内部保留的最大框数</div>
              </div>

              <div className="model-param-edit-group">
                <label>返回结果数 (top_k)</label>

                <input
                  type="range"
                  min="1"
                  max="10"
                  step="1"
                  value={editParams.top_k}
                  onChange={(e) => handleParamChange('top_k', e.target.value)}
                />

                <span className="model-param-value-display">{editParams.top_k}</span>

                <div className="model-param-hint">范围: 1 ~ 10，最终返回的结果数量</div>
              </div>
            </div>

            <div className="model-modal-footer">
              <button
                type="button"
                className="model-cancel-btn"
                onClick={() => setEditingModel(null)}
              >
                取消
              </button>

              <button
                type="button"
                className="model-save-btn"
                onClick={handleSaveParams}
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ModelComparison;