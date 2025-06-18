const buildTree = (files) => {
  const root = [];
  const folderMap = new Map();

  files.forEach(({ id, filename, project_id }) => {
    const parts = (project_id || '').split('/').filter(Boolean);
    let currentPath = '';
    let currentChildren = root;

    for (const part of parts) {
      currentPath = currentPath ? `${currentPath}/${part}` : part;

      if (!folderMap.has(currentPath)) {
        const node = {
          key: `folder-${currentPath}`,
          label: part,
          data: { path: currentPath, isFolder: true },
          children: []
        };
        folderMap.set(currentPath, node);
        currentChildren.push(node);
      }

      currentChildren = folderMap.get(currentPath).children;
    }

    const ext = filename.includes('.') ? filename.split('.').pop() : 'txt';

    currentChildren.push({
      key: `file-${id}`,
      label: filename,
      data: { id, name: filename, project_id, extension: ext },
      leaf: true
    });
  });

  return root;
};

export default buildTree;
