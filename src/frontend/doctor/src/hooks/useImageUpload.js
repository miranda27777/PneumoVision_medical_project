import { useState } from 'react';
import { uploadApi } from '../api';

export const useImageUpload = () => {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState(null);

  const uploadImage = async (file, caseId) => {
    setUploading(true);
    setUploadProgress(0);
    setUploadError(null);

    try {
      // 模拟上传进度
      const interval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(interval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      const result = await uploadApi.uploadImage(file, caseId);
      
      clearInterval(interval);
      setUploadProgress(100);
      setTimeout(() => setUploadProgress(0), 1000);
      
      return result;
    } catch (error) {
      setUploadError(error.message);
      throw error;
    } finally {
      setUploading(false);
    }
  };

  return {
    uploading,
    uploadProgress,
    uploadError,
    uploadImage
  };
};