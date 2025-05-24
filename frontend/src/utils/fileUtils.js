export const getFileTypeInfo = (filename) => {
  const ext = filename.split('.').pop().toLowerCase();
  switch (ext) {
    case 'dwg':
      return { type: 'CAD 도면', color: '#4CAF50', icon: '📐' };
    case 'jpg':
    case 'jpeg':
      return { type: 'JPEG 이미지', color: '#FF9800', icon: '🖼️' };
    case 'png':
      return { type: 'PNG 이미지', color: '#2196F3', icon: '🖼️' };
    case 'pdf':
      return { type: 'PDF 문서', color: '#F44336', icon: '📄' };
    default:
      return { type: '파일', color: '#666', icon: '📁' };
  }
};

export const downloadFile = (url, filename) => {
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const exportData = (data, filename) => {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
  downloadFile(dataStr, filename);
}; 