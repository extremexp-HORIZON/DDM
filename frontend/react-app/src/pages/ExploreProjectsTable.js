import { TreeTable } from 'primereact/treetable';
import { Column } from 'primereact/column';
import { Button } from 'primereact/button';
import { useState, useEffect } from 'react';
import { getFileIcon } from '../utils/icons';
import { CATALOG_API } from '../api/catalog';
import { FILES_API } from '../api/files';
import { useTheme } from "../context/ThemeContext";
import { showMessage } from '../utils/messages';
import { showConfirm } from "../components/ConfirmDialog";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { useToast } from '../context/ToastContext';

const ExploreProjectsTable = () => {
  const { isDarkMode } = useTheme();
  const toast = useToast();
  const [nodes, setNodes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [totalRecords, setTotalRecords] = useState(0);
  const [first, setFirst] = useState(0);
  const [rows, setRows] = useState(10);
  const [expandedKeys, setExpandedKeys] = useState({});
  const [filters, setFilters] = useState({});
  const [sortField, setSortField] = useState(null);
  const [sortOrder, setSortOrder] = useState(null);

 const loadNodes = async (parentKey = null, page = 0, rows = 10) => {
    setLoading(true);

    const updateTreeWithChildren = (tree, parentKey, children) => {
      return tree.map((node) => {
        if (node.key === parentKey) {
          return { ...node, children }; // inject children here
        }
        if (node.children) {
          return { ...node, children: updateTreeWithChildren(node.children, parentKey, children) };
        }
        return node;
      });
    };

    const injectChildren = (nodes, parentKey, children) => {
      console.log("Injecting into:", parentKey, "children:", children);
      let found = false;
      const recur = (list) => {
        return list.map((node) => {
          if (node.key === parentKey) {
            found = true;
            return { ...node, children };
          }
          if (node.children) {
            return { ...node, children: recur(node.children) };
          }
          return node;
        });
      };
      const newNodes = recur(nodes);
      if (!found) console.warn("Parent key not found:", parentKey);
      return newNodes;
    };




    try {
      const cleanedFilters = {};
      Object.entries(filters).forEach(([key, { value }]) => {
        if (value) {
          const cleanKey = key.replace(/^data\./, '');
          cleanedFilters[cleanKey] = value;
        }
      });

      


      const sort = sortField
        ? `${sortField.replace('data.', '')},${sortOrder > 0 ? 'asc' : 'desc'}`
        : undefined;

      const res = await CATALOG_API.fetchTree({
        parent: parentKey?.replace(/^folder-/, ''),
        page,
        perPage: rows,
        ...cleanedFilters,
        sort
      });

     
       if (!res || !res.nodes) {
          console.error('Invalid response from API:', res);
          return;
        }


      if (parentKey) {
        const cloned = JSON.parse(JSON.stringify(nodes));
        const updatedTree = injectChildren(cloned, parentKey, res.nodes);

        setNodes(updatedTree);
      } else {
        setNodes(res.nodes);
        setTotalRecords(res.totalRecords);
      }

    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const page = Math.floor(first / rows);
    loadNodes(null, page, rows);
  }, [first, filters, sortField, sortOrder]);



  const onPage = (e) => {
    setFirst(e.first);
    setRows(e.rows); // update page size if user changes it
  };



  const onExpand = (e) => {
    const rawKey = e.node.key;
    loadNodes(rawKey);
    setExpandedKeys((prev) => ({ ...prev, [rawKey]: true }));
  };



  const onFilter = (e) => {
    setFilters(e.filters);
    setFirst(0);
  };

  const onSort = (e) => {
    setSortField(e.sortField);
    setSortOrder(e.sortOrder);
    setFirst(0);
  };

  const tableClass = isDarkMode ? "p-datatable p-datatable-dark" : "p-datatable p-datatable-light";

  return (
    <div className={`dataset-container ${isDarkMode ? "dark-mode" : "light-mode"}`}>
      <h2>Projects</h2>
      <ConfirmDialog />
      <TreeTable
        value={nodes}
        lazy
        paginator
        rows={10}
        totalRecords={totalRecords}
        first={first}
        onPage={onPage}
        onExpand={onExpand}
        expandedKeys={expandedKeys}
        onToggle={(e) => setExpandedKeys(e.value)}
        loading={loading}
        tableStyle={{ minWidth: '50rem' }}
        filters={filters}
        onFilter={onFilter}
        onSort={onSort}
        sortField={sortField}
        sortOrder={sortOrder}
        resizableColumns
      >
      <Column
        field="name" 
        header="Name"
        expander
        sortable
        filter
        filterPlaceholder="Filter by name"
        body={(node) => node.data?.name}
      />

      <Column
        field="size"
        header="Size"
        sortable
        filter
        filterPlaceholder="Filter by size"
        body={(node) => node.data?.size}
      />

      <Column
        field="type"
        header="Type"
        sortable
        filter
        filterPlaceholder="Filter by type"
        body={(node, options) => {
          const isFile = node.leaf === true;
          const icon = isFile ? getFileIcon(node.data) : <i className="pi pi-folder text-gray-700" />;

          return (
            <div className="flex items-center gap-2">
              {options?.expander} {/* <- This preserves indentation + expand icon */}
              <span className="inline-block ">{icon}</span>
              <span className="truncate">{node.data?.type}</span>
            </div>
          );
        }}

      />
      <Column
        header="Actions"
        body={(node) => {
          const isFile = node.leaf === true;
          const isFolder = !isFile;
          const path = isFolder ? node.data?.path : node.data?.project_id;
          const fileId = node.data?.id;

          const handleDownload = async (e) => {
            e.stopPropagation();
            try {
              if (isFolder) {
                await FILES_API.downloadProjectFiles(path);
              } else {
                await FILES_API.downloadFile(fileId, node.data?.name || "file");
              }
            } catch (err) {
              alert("Download failed: " + err.message);
            }
          };

          const handleDelete = async (e) => {
            e.stopPropagation();
            showConfirm({
              message: `Are you sure you want to delete this ${isFolder ? "folder" : "file"}?`,
              header: `Delete ${isFolder ? "Folder" : "File"}`,
              icon: "pi pi-exclamation-triangle",
              accept: async () => {
                try {
                  if (isFile) {
                    await FILES_API.deleteFile(fileId);
                  } else {
                    alert("Folder deletion is not implemented yet.");
                    return;
                  }
                  showMessage(toast, "success", `${isFolder ? "Folder" : "File"} deleted successfully`);
                  loadNodes(); // Refresh tree
                } catch (err) {
                  showMessage(toast, "error", `Delete failed: ${err.message}`);
                }
              },
              reject: () => {
                showMessage(toast, "info", "Deletion cancelled");
              },
              isDarkMode
            });


            try {
              if (isFile) {
                await FILES_API.deleteFile(fileId);
              } else {
                showMessage(toast, "info", "Folder deletion is not implemented yet.");
              }
              loadNodes(); // Optionally refresh
            } catch (err) {
              showMessage(toast, "error", `Delete failed: ${err.message}`);
            }
          };

          return (
            <div className="flex items-center gap-2">
              <Button
                icon="pi pi-download"
                className="p-button-text p-button-sm"
                onClick={handleDownload}
                tooltip="Download"
              />
              <Button
                icon="pi pi-trash"
                className="p-button-text p-button-sm text-red-500 hover:text-red-600"
                onClick={handleDelete}
                tooltip="Delete"
              />
            </div>
          );
        }}
        style={{ width: '8rem' }}
      />


      </TreeTable>
    </div>
  );
};

export default ExploreProjectsTable;
