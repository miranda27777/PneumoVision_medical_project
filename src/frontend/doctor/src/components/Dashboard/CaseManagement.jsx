import React from 'react';
import CasesTable from './CasesTable';
import ImagePreview from './ImagePreview';
import QuickActions from './QuickActions';
import './CaseManagement.css';

const CaseManagement = ({ 
  cases, 
  imagePreviews,
  recentUploads,
  onRefresh, 
  onUpdateCaseTaskId,
  onAddUploadedImage
}) => {
  return (
    <div className="case-management-container">
      {/* 快捷操作区域 */}
      <QuickActions onRefresh={onRefresh} />
      
      {/* 两列布局：病例列表 + 影像预览 */}
      <div className="two-column-layout">
        <div className="left-column">
          <CasesTable 
            cases={cases} 
            onRefresh={onRefresh}
            onUpdateCaseTaskId={onUpdateCaseTaskId}
          />
        </div>
        <div className="right-column">
          <ImagePreview 
            images={imagePreviews} 
            cases={cases}
            recentUploads={recentUploads}
            onImageUpload={onAddUploadedImage}
          />
        </div>
      </div>
    </div>
  );
};

export default CaseManagement;